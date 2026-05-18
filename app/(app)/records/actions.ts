"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathRecords, PathSupply } from "@/lib/misc";
import { planSeed } from "@/lib/derive/intake";
import { MILK_EC } from "@/lib/derive/production";
import { EC } from "@/lib/derive/engine";
import {
  applySupplyMovement,
  checkSupplyShortages,
  shortageMessage,
  resolveSupplyItemId,
} from "@/lib/supply-usage";

type Result = { error?: string; success?: boolean };

const intakeSchema = z.object({
  cohort: z.enum([
    "lactating",
    "dry",
    "bred_heifer",
    "open_heifer",
    "calf",
  ]),
  animalId: z.string().trim().min(1, "Animal ID is required."),
  name: z.string().trim().optional(),
  breed: z.string().trim().optional(),
  birthDate: z.string().trim().optional(),
  lactation: z.coerce.number().int().min(0),
  freshDate: z.string().trim().optional(),
  lastBredDate: z.string().trim().optional(),
  serviceSire: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
  dryOffDate: z.string().trim().optional(),
  pen: z.string().trim().optional(),
  eid: z.string().trim().optional(),
  damId: z.string().trim().optional(),
  sireId: z.string().trim().optional(),
  registration: z.string().trim().optional(),
  entryReason: z.string().trim().optional(),
  entryDate: z.string().trim().min(1, "Entry date is required."),
});

const eventSchema = z.object({
  subjectId: z.uuid(),
  eventCode: z.coerce.number().int(),
  eventDate: z.string().trim().min(1, "Event date is required."),
  remark: z.string().trim().optional(),
  // Breeding only: the genetic material used (a Supply Chain item —
  // a semen straw, an embryo, etc.) and how many units, so stock
  // auto-deducts from one source of truth.
  material: z.string().trim().optional(),
  materialQty: z.coerce.number().positive().optional(),
});

export async function createAnimalIntake(
  input: z.infer<typeof intakeSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = intakeSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { name, ...snap } = parsed.data;
  const plan = planSeed(snap);
  if (plan.problems.length) return { error: plan.problems[0] };

  const admin = createAdminClient();
  const { data: subject, error: sErr } = await admin
    .from("subjects")
    .insert({
      organization_id: orgId,
      subject_type: "animal",
      natural_key: snap.animalId,
      name: name || null,
      attrs: plan.attrs,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (sErr) {
    if (sErr.code === "23505")
      return { error: `Animal ${snap.animalId} already exists.` };
    return { error: sErr.message };
  }

  if (plan.events.length) {
    const { error: eErr } = await admin.from("events").insert(
      plan.events.map((e) => ({
        organization_id: orgId,
        subject_id: subject.id,
        event_code: e.code,
        event_date: e.date,
        payload: e.payload ?? {},
        source: "user",
        created_by: user.id,
      })),
    );
    if (eErr) return { error: eErr.message };
  }

  revalidatePath(PathRecords);
  return { success: true };
}

export async function recordEvent(
  input: z.infer<typeof eventSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = eventSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { subjectId, eventCode, eventDate, remark, material, materialQty } =
    parsed.data;
  const isBreeding = eventCode === EC.BRED;

  const admin = createAdminClient();

  // confirm the subject belongs to this org (no cross-org writes)
  const { data: subj, error: sErr } = await admin
    .from("subjects")
    .select("id")
    .eq("id", subjectId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (sErr) return { error: sErr.message };
  if (!subj) return { error: "Animal not found." };

  const matQty = materialQty ?? 1;
  let materialId: string | null = null;
  if (isBreeding && material) {
    const r = await resolveSupplyItemId(admin, orgId, material);
    if (r.ambiguous)
      return {
        error: `Multiple Supply Chain items named “${material}”. Rename one so stock can be tracked.`,
      };
    if (!r.id)
      return {
        error: `“${material}” is not a Supply Chain item. Add it under Supply Chain first.`,
      };
    materialId = r.id;
    const short = await checkSupplyShortages(admin, orgId, [
      { itemName: material, qty: matQty },
    ]);
    if (short.length) return { error: shortageMessage(short) };
  }

  const { error } = await admin.from("events").insert({
    organization_id: orgId,
    subject_id: subjectId,
    event_code: eventCode,
    event_date: eventDate,
    remark: remark || null,
    payload:
      isBreeding && material ? { sire: material, qty: matQty } : {},
    source: "user",
    created_by: user.id,
  });
  if (error) return { error: error.message };

  // Breeding consumes genetic material from Supply Chain stock.
  if (isBreeding && material) {
    await applySupplyMovement(admin, orgId, {
      itemName: material,
      itemId: materialId ?? undefined,
      qty: matQty,
      date: eventDate,
      direction: "use",
      ref: { breeding_animal: subjectId },
    });
    revalidatePath(PathSupply);
  }

  revalidatePath(`${PathRecords}/${subjectId}`);
  revalidatePath(PathRecords);
  return { success: true };
}

const milkSchema = z.object({
  subjectId: z.uuid(),
  date: z.string().trim().min(1, "Date is required."),
  yieldKg: z.coerce.number().positive("Yield must be > 0."),
  fat: z.coerce.number().min(0).optional(),
  prot: z.coerce.number().min(0).optional(),
  snf: z.coerce.number().min(0).optional(),
  ts: z.coerce.number().min(0).optional(),
  scc: z.coerce.number().min(0).optional(),
});

export async function recordMilking(
  input: z.infer<typeof milkSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = milkSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { subjectId, date, yieldKg, fat, prot, snf, ts, scc } =
    parsed.data;

  const admin = createAdminClient();
  const { data: subj, error: sErr } = await admin
    .from("subjects")
    .select("id")
    .eq("id", subjectId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (sErr) return { error: sErr.message };
  if (!subj) return { error: "Animal not found." };

  const payload: Record<string, number> = { yield: yieldKg };
  if (fat !== undefined) payload.fat = fat;
  if (prot !== undefined) payload.prot = prot;
  if (snf !== undefined) payload.snf = snf;
  if (ts !== undefined) payload.ts = ts;
  if (scc !== undefined) payload.scc = scc;

  const { error } = await admin.from("events").insert({
    organization_id: orgId,
    subject_id: subjectId,
    event_code: MILK_EC,
    event_date: date,
    payload,
    source: "user",
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath(`${PathRecords}/${subjectId}`);
  return { success: true };
}
