"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathRecords } from "@/lib/misc";
import { parseCsv } from "@/lib/csv-parse";
import { planSeed, type IntakeSnapshot, type Cohort } from "@/lib/derive/intake";
import { MILK_EC } from "@/lib/derive/production";

export type ImportResult = {
  created: number;
  failed: number;
  errors: string[];
};

const num = (s: string | undefined) =>
  s && s.trim() !== "" ? Number(s) : undefined;

export async function importAnimals(csv: string): Promise<ImportResult> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { created: 0, failed: 0, errors: ["No organization."] };

  const { rows } = parseCsv(csv);
  const admin = createAdminClient();
  let created = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2; // header is line 1
    const animalName = r.name || null;
    const snap: IntakeSnapshot = {
      cohort: (r.cohort || "lactating") as Cohort,
      animalId: r.animalId,
      breed: r.breed || undefined,
      birthDate: r.birthDate || undefined,
      lactation: Number(r.lactation || 0),
      freshDate: r.freshDate || undefined,
      lastBredDate: r.lastBredDate || undefined,
      serviceSire: r.serviceSire || undefined,
      dueDate: r.dueDate || undefined,
      dryOffDate: r.dryOffDate || undefined,
      pen: r.pen || undefined,
      eid: r.eid || undefined,
      damId: r.damId || undefined,
      sireId: r.sireId || undefined,
      registration: r.registration || undefined,
      entryReason: r.entryReason || undefined,
      entryDate:
        r.entryDate || new Date().toISOString().slice(0, 10),
    };
    const plan = planSeed(snap);
    if (plan.problems.length) {
      failed++;
      if (errors.length < 25)
        errors.push(`Line ${line} (${r.animalId || "?"}): ${plan.problems[0]}`);
      continue;
    }
    const { data: subject, error: sErr } = await admin
      .from("subjects")
      .insert({
        organization_id: orgId,
        subject_type: "animal",
        natural_key: snap.animalId,
        name: animalName,
        attrs: plan.attrs,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (sErr || !subject) {
      failed++;
      if (errors.length < 25)
        errors.push(
          `Line ${line} (${r.animalId}): ${
            sErr?.code === "23505" ? "already exists" : sErr?.message
          }`,
        );
      continue;
    }
    if (plan.events.length) {
      await admin.from("events").insert(
        plan.events.map((e) => ({
          organization_id: orgId,
          subject_id: subject.id,
          event_code: e.code,
          event_date: e.date,
          payload: e.payload ?? {},
          source: "integration",
          created_by: user.id,
        })),
      );
    }
    created++;
  }

  revalidatePath(PathRecords);
  return { created, failed, errors };
}

export async function importMilkings(csv: string): Promise<ImportResult> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { created: 0, failed: 0, errors: ["No organization."] };

  const { rows } = parseCsv(csv);
  const admin = createAdminClient();

  const keys = [...new Set(rows.map((r) => r.animalId).filter(Boolean))];
  const { data: subs } = await admin
    .from("subjects")
    .select("id, natural_key")
    .eq("organization_id", orgId)
    .eq("subject_type", "animal")
    .in("natural_key", keys.length ? keys : ["__none"]);
  const idByKey = new Map(
    (subs ?? []).map((s) => [s.natural_key, s.id]),
  );

  const toInsert: Record<string, unknown>[] = [];
  let failed = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2;
    const sid = idByKey.get(r.animalId);
    if (!sid) {
      failed++;
      if (errors.length < 25)
        errors.push(`Line ${line}: animal "${r.animalId}" not found`);
      continue;
    }
    const y = num(r.yield);
    if (y === undefined || !(y > 0)) {
      failed++;
      if (errors.length < 25)
        errors.push(`Line ${line} (${r.animalId}): invalid yield`);
      continue;
    }
    const payload: Record<string, number> = { yield: y };
    if (num(r.fat) !== undefined) payload.fat = num(r.fat)!;
    if (num(r.prot) !== undefined) payload.prot = num(r.prot)!;
    if (num(r.snf) !== undefined) payload.snf = num(r.snf)!;
    if (num(r.ts) !== undefined) payload.ts = num(r.ts)!;
    if (num(r.scc) !== undefined) payload.scc = num(r.scc)!;
    toInsert.push({
      organization_id: orgId,
      subject_id: sid,
      event_code: MILK_EC,
      event_date: r.date || new Date().toISOString().slice(0, 10),
      payload,
      source: "integration",
      created_by: user.id,
    });
  }

  let created = 0;
  if (toInsert.length) {
    const { error } = await admin.from("events").insert(toInsert);
    if (error) return { created: 0, failed: rows.length, errors: [error.message] };
    created = toInsert.length;
  }
  revalidatePath(PathRecords);
  return { created, failed, errors };
}
