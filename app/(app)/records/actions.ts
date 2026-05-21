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
  consumeSupply,
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
  }

  const { data: ev, error } = await admin
    .from("events")
    .insert({
      organization_id: orgId,
      subject_id: subjectId,
      event_code: eventCode,
      event_date: eventDate,
      remark: remark || null,
      payload:
        isBreeding && material ? { sire: material, qty: matQty } : {},
      source: "user",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Breeding consumes genetic material — atomic deduction, and roll
  // back the breeding event if stock is short.
  if (isBreeding && material && materialId) {
    const consumed = await consumeSupply(
      admin,
      orgId,
      [{ itemId: materialId, itemName: material, qty: matQty }],
      eventDate,
      { breeding_animal: subjectId, src_event: ev.id },
    );
    if (!consumed.ok) {
      await admin.from("events").delete().eq("id", ev.id);
      return { error: consumed.message };
    }
    revalidatePath(PathSupply);
  }

  revalidatePath(`${PathRecords}/${subjectId}`);
  revalidatePath(PathRecords);
  return { success: true };
}

// Delete an animal event and reverse any stock it auto-consumed
// (treatment/breeding) in one locked transaction. Scoped to the
// org and restricted to events on animal subjects.
export async function deleteAnimalEvent(
  eventId: string,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const admin = createAdminClient();
  const { data: ev } = await admin
    .from("events")
    .select("id, subject_id, subjects!inner(subject_type)")
    .eq("id", eventId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!ev) return { error: "Event not found." };
  const stype = (
    ev as unknown as { subjects: { subject_type: string } }
  ).subjects?.subject_type;
  if (stype !== "animal")
    return { error: "Only animal events can be deleted here." };

  // Events are append-only — corrections happen as new events. The
  // reverse_event RPC appends a CNCL marker on the primary event and
  // a compensating SRCV for every linked auto-stock-usage event, so
  // the ledger rebalances and active views hide the original.
  const { data, error } = await admin.rpc("reverse_event", {
    p_org: orgId,
    p_event_id: eventId,
  });
  if (error) return { error: error.message };
  const res = (data ?? {}) as { ok?: boolean };
  if (!res.ok) return { error: "Event no longer exists." };

  revalidatePath(`${PathRecords}/${ev.subject_id}`);
  revalidatePath(PathRecords);
  revalidatePath(PathSupply);
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

// Editable identity/seed attributes. Empty string clears the key, so
// a blank field reads back as "not set" (null) everywhere — symmetric
// with how unset keys behave. base_lactation / cohort and the event
// stream are NOT touched here; this is metadata only.
const ATTR_KEYS = [
  "breed",
  "pen",
  "eid",
  "dam_id",
  "sire_id",
  "service_sire",
  "registration",
  "entry_reason",
  "entry_date",
  "birth_date",
  "due_date",
  "conception_date",
] as const;

const editAttrsSchema = z.object({
  subjectId: z.uuid(),
  name: z.string().trim().optional(),
  attrs: z.record(z.string(), z.string().trim()),
});

export async function updateAnimalAttrs(
  input: z.infer<typeof editAttrsSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = editAttrsSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { subjectId, name, attrs: incoming } = parsed.data;

  const admin = createAdminClient();
  const { data: subj, error: sErr } = await admin
    .from("subjects")
    .select("attrs")
    .eq("id", subjectId)
    .eq("organization_id", orgId)
    .eq("subject_type", "animal")
    .maybeSingle();
  if (sErr) return { error: sErr.message };
  if (!subj) return { error: "Animal not found." };

  const merged = { ...((subj.attrs ?? {}) as Record<string, unknown>) };
  for (const k of ATTR_KEYS) {
    if (!(k in incoming)) continue;
    const v = incoming[k]?.trim() ?? "";
    if (v === "") delete merged[k];
    else merged[k] = v;
  }

  const { error } = await admin
    .from("subjects")
    .update({
      attrs: merged,
      ...(name !== undefined ? { name: name || null } : {}),
    })
    .eq("id", subjectId)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };

  revalidatePath(PathRecords);
  revalidatePath(`${PathRecords}/${subjectId}`);
  return { success: true };
}
