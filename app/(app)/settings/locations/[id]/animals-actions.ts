"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";

type Result = { error?: string; success?: boolean; id?: string };

export type AnimalRow = {
  id: string;
  animal_id: string;
  name: string | null;
  official_id: string | null;
  registration_number: string | null;
  breed_code: string | null;
  sex: string;
  birth_date: string;
  status: string;
  status_date: string | null;
  origin: string;
  source_farm: string | null;
  entry_date: string;
  current_pen_id: string | null;
  current_group_id: string | null;
  current_lactation: number | null;
  last_calving_date: string | null;
  sire_naab: string | null;
  sire_name: string | null;
  dam_tag_external: string | null;
  notes: string | null;
  life_stage: string | null;
};

const sexEnum = z.enum(["female", "male", "freemartin", "castrated"]);
const statusEnum = z.enum(["active", "sold", "dead", "culled", "reference"]);
const originEnum = z.enum(["born_on_farm", "purchased", "imported", "leased", "other"]);
const lifeStageEnum = z.enum([
  "calf",
  "weaned_heifer",
  "breeding_heifer",
  "bred_heifer",
  "lactating",
  "dry",
  "bull",
  "other",
]);

const baseSchema = z.object({
  location_id: z.uuid(),
  animal_id: z.string().trim().min(1, "Animal ID required."),
  name: z.string().trim().nullable(),
  official_id: z.string().trim().nullable(),
  registration_number: z.string().trim().nullable(),
  breed_code: z.string().trim().nullable(),
  sex: sexEnum,
  birth_date: z.string().min(10),
  entry_date: z.string().min(10),
  origin: originEnum,
  source_farm: z.string().trim().nullable(),
  status: statusEnum,
  status_date: z.string().nullable(),
  current_pen_id: z.string().nullable(),
  current_group_id: z.string().nullable(),
  current_lactation: z.number().int().min(0).max(20).nullable(),
  last_calving_date: z.string().nullable(),
  sire_naab: z.string().trim().nullable(),
  sire_name: z.string().trim().nullable(),
  dam_tag_external: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
  life_stage: lifeStageEnum,
  // Optional pregnancy snapshot — when provided, a repro_events row is
  // inserted alongside the animal so the system knows she's bred.
  is_pregnant: z.boolean().optional().default(false),
  last_breeding_date: z.string().nullable().optional(),
  last_breeding_sire_naab: z.string().trim().nullable().optional(),
  preg_check_date: z.string().nullable().optional(),
  days_pregnant: z.number().int().min(0).max(310).nullable().optional(),
});

const updateSchema = baseSchema.extend({ id: z.uuid() });

async function authorize(locationId: string) {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);
  const admin = createAdminClient();
  const { data } = await admin
    .from("locations")
    .select("id, organization_id")
    .eq("id", locationId)
    .single();
  if (!data) return { error: "Location not found." as const };
  if (role !== RoleSuperAdmin && data.organization_id !== orgId) {
    return { error: "Cross-org access denied." as const };
  }
  return { admin };
}

export async function listAnimals(
  locationId: string,
  status: string | null = null,
): Promise<AnimalRow[]> {
  const authz = await authorize(locationId);
  if ("error" in authz) return [];
  let q = authz.admin
    .from("animals")
    .select(
      "*",
    )
    .eq("location_id", locationId)
    .order("animal_id");
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return (data ?? []) as AnimalRow[];
}

export async function getAnimal(
  locationId: string,
  id: string,
): Promise<AnimalRow | null> {
  const authz = await authorize(locationId);
  if ("error" in authz) return null;
  const { data } = await authz.admin
    .from("animals")
    .select(
      "*",
    )
    .eq("location_id", locationId)
    .eq("id", id)
    .maybeSingle();
  return (data as AnimalRow | null) ?? null;
}

function toRow(input: z.infer<typeof baseSchema>) {
  return {
    location_id: input.location_id,
    animal_id: input.animal_id,
    name: input.name || null,
    official_id: input.official_id || null,
    registration_number: input.registration_number || null,
    breed_code: input.breed_code || null,
    sex: input.sex,
    birth_date: input.birth_date,
    entry_date: input.entry_date,
    origin: input.origin,
    source_farm: input.source_farm || null,
    status: input.status,
    status_date: input.status_date || null,
    current_pen_id: input.current_pen_id || null,
    current_group_id: input.current_group_id || null,
    current_lactation: input.current_lactation,
    last_calving_date: input.last_calving_date || null,
    sire_naab: input.sire_naab || null,
    sire_name: input.sire_name || null,
    dam_tag_external: input.dam_tag_external || null,
    notes: input.notes || null,
    life_stage: input.life_stage,
  };
}

async function insertPregnancySnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  animalId: string,
  input: z.infer<typeof baseSchema>,
) {
  if (!input.is_pregnant) return;
  const events: Record<string, unknown>[] = [];
  if (input.last_breeding_date) {
    events.push({
      animal_id: animalId,
      event_date: input.last_breeding_date,
      event_type: "breeding",
      sire_naab: input.last_breeding_sire_naab || null,
      source: "import_snapshot",
    });
  }
  if (input.preg_check_date || input.days_pregnant) {
    events.push({
      animal_id: animalId,
      event_date:
        input.preg_check_date ||
        new Date().toISOString().slice(0, 10),
      event_type: "preg_check",
      result: "Pregnant",
      days_pregnant: input.days_pregnant ?? null,
      source: "import_snapshot",
    });
  }
  if (events.length > 0) {
    try {
      await admin.from("repro_events").insert(events);
    } catch {
      // schema not present yet — skip silently
    }
  }
}

export async function createAnimal(
  input: z.infer<typeof baseSchema>,
): Promise<Result> {
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const authz = await authorize(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { data, error } = await authz.admin
    .from("animals")
    .insert(toRow(parsed.data))
    .select("id")
    .single();
  if (error) return { error: error.message };
  const newId = data?.id as string;
  await insertPregnancySnapshot(authz.admin, newId, parsed.data);
  revalidatePath(`/settings/locations/${parsed.data.location_id}/animals`);
  revalidatePath(`/animals`);
  return { success: true, id: newId };
}

export async function updateAnimal(
  input: z.infer<typeof updateSchema>,
): Promise<Result> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const authz = await authorize(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { id, ...rest } = parsed.data;
  const { error } = await authz.admin
    .from("animals")
    .update(toRow(rest))
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/animals`);
  revalidatePath(`/settings/locations/${parsed.data.location_id}/animals/${id}`);
  return { success: true };
}

export async function deleteAnimal(input: {
  id: string;
  location_id: string;
}): Promise<Result> {
  const authz = await authorize(input.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin.from("animals").delete().eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${input.location_id}/animals`);
  return { success: true };
}

export type AnimalEventCounts = {
  lactations: number;
  test_days: number;
  milkings: number;
  repro_events: number;
  calvings: number;
  health_events: number;
  scores: number;
  pen_moves: number;
};

export async function getAnimalEventCounts(
  locationId: string,
  animalId: string,
): Promise<AnimalEventCounts> {
  const authz = await authorize(locationId);
  const empty: AnimalEventCounts = {
    lactations: 0,
    test_days: 0,
    milkings: 0,
    repro_events: 0,
    calvings: 0,
    health_events: 0,
    scores: 0,
    pen_moves: 0,
  };
  if ("error" in authz) return empty;
  const tables = [
    ["lactations", "animal_id"],
    ["test_days", "animal_id"],
    ["milkings", "animal_id"],
    ["repro_events", "animal_id"],
    ["calvings", "dam_animal_id"],
    ["health_events", "animal_id"],
    ["scores", "animal_id"],
    ["pen_moves", "animal_id"],
  ] as const;
  const results = await Promise.all(
    tables.map(([t, col]) =>
      authz.admin
        .from(t)
        .select("id", { count: "exact", head: true })
        .eq(col, animalId)
        .then(({ count }) => count ?? 0),
    ),
  );
  return {
    lactations: results[0],
    test_days: results[1],
    milkings: results[2],
    repro_events: results[3],
    calvings: results[4],
    health_events: results[5],
    scores: results[6],
    pen_moves: results[7],
  };
}

// ---------------------------------------------------------------------
// Sample-data generator — admin-only seeder for testing
// ---------------------------------------------------------------------

type SampleStage =
  | "calf"
  | "weaned_heifer"
  | "breeding_heifer"
  | "bred_heifer"
  | "lactating"
  | "dry";

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildSampleAnimal(
  locationId: string,
  index: number,
  stage: SampleStage,
): Record<string, unknown> {
  const sireNaabs = ["014HO07419", "029HO19831", "551HO03734", "200HO11314"];
  const breeds = ["HO", "JE", "BS"];

  const animal_id = `S${String(1000 + index)}`;
  const base = {
    location_id: locationId,
    animal_id,
    name: null,
    official_id: null,
    registration_number: null,
    breed_code: pick(breeds),
    sex: "female" as const,
    status: "active" as const,
    status_date: null,
    origin: "born_on_farm" as const,
    source_farm: null,
    current_pen_id: null,
    current_group_id: null,
    sire_naab: pick(sireNaabs),
    sire_name: null,
    dam_tag_external: null,
    notes: "Sample animal — generated for testing",
    life_stage: stage,
  };

  switch (stage) {
    case "calf": {
      const ageDays = 30 + Math.floor(Math.random() * 60);
      return {
        ...base,
        birth_date: daysAgo(ageDays),
        entry_date: daysAgo(ageDays),
        current_lactation: 0,
        last_calving_date: null,
      };
    }
    case "weaned_heifer": {
      const ageMonths = 4 + Math.floor(Math.random() * 6);
      return {
        ...base,
        birth_date: daysAgo(ageMonths * 30),
        entry_date: daysAgo(ageMonths * 30),
        current_lactation: 0,
        last_calving_date: null,
      };
    }
    case "breeding_heifer": {
      const ageMonths = 13 + Math.floor(Math.random() * 6);
      return {
        ...base,
        birth_date: daysAgo(ageMonths * 30),
        entry_date: daysAgo(ageMonths * 30),
        current_lactation: 0,
        last_calving_date: null,
      };
    }
    case "bred_heifer": {
      const ageMonths = 18 + Math.floor(Math.random() * 4);
      return {
        ...base,
        birth_date: daysAgo(ageMonths * 30),
        entry_date: daysAgo(ageMonths * 30),
        current_lactation: 0,
        last_calving_date: null,
      };
    }
    case "lactating": {
      const ageYears = 2 + Math.floor(Math.random() * 5);
      const parity = 1 + Math.floor(Math.random() * 4);
      const dim = 15 + Math.floor(Math.random() * 280);
      return {
        ...base,
        birth_date: daysAgo(ageYears * 365),
        entry_date: daysAgo(ageYears * 365),
        current_lactation: parity,
        last_calving_date: daysAgo(dim),
      };
    }
    case "dry": {
      const ageYears = 3 + Math.floor(Math.random() * 4);
      const parity = 2 + Math.floor(Math.random() * 4);
      // dried off ~30 days ago, was milking before that
      return {
        ...base,
        birth_date: daysAgo(ageYears * 365),
        entry_date: daysAgo(ageYears * 365),
        current_lactation: parity,
        last_calving_date: null,
      };
    }
  }
}

export async function generateSampleAnimals(
  locationId: string,
  count = 20,
): Promise<Result & { generated?: number; preg_events?: number }> {
  const authz = await authorize(locationId);
  if ("error" in authz) return { error: authz.error };

  if (count < 1 || count > 5000) {
    return { error: "Count must be between 1 and 5000." };
  }

  // Start animal_ids after the largest existing S#### at this location.
  const { data: existing } = await authz.admin
    .from("animals")
    .select("animal_id")
    .eq("location_id", locationId)
    .like("animal_id", "S%");
  let maxN = 999;
  for (const r of existing ?? []) {
    const m = /^S(\d+)$/.exec((r.animal_id as string) ?? "");
    if (m) {
      const n = Number(m[1]);
      if (n > maxN) maxN = n;
    }
  }
  const startIndex = maxN - 999; // legacy seeder started at S1000 (index 0)

  // Distribution that mirrors a real Holstein herd:
  //   65 % lactating      (≈ 50 % of them pregnant)
  //    8 % dry            (≈ 70 % close-up, 30 % far-off, all pregnant)
  //    8 % bred heifers   (all pregnant)
  //    7 % breeding heifers
  //    7 % weaned heifers
  //    5 % calves
  const stages: SampleStage[] = [];
  const lactCount = Math.round(count * 0.65);
  const dryCount = Math.round(count * 0.08);
  const bredHeiferCount = Math.round(count * 0.08);
  const breedingHeiferCount = Math.round(count * 0.07);
  const weanedCount = Math.round(count * 0.07);
  const calfCount = count - lactCount - dryCount - bredHeiferCount - breedingHeiferCount - weanedCount;
  for (let i = 0; i < lactCount; i++) stages.push("lactating");
  for (let i = 0; i < dryCount; i++) stages.push("dry");
  for (let i = 0; i < bredHeiferCount; i++) stages.push("bred_heifer");
  for (let i = 0; i < breedingHeiferCount; i++) stages.push("breeding_heifer");
  for (let i = 0; i < weanedCount; i++) stages.push("weaned_heifer");
  for (let i = 0; i < Math.max(0, calfCount); i++) stages.push("calf");
  // Shuffle so animal_ids don't cluster by stage.
  for (let i = stages.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [stages[i], stages[j]] = [stages[j], stages[i]];
  }

  const rows = stages.map((s, i) => buildSampleAnimal(locationId, startIndex + i, s));

  // Insert in batches of 200 to stay well under PostgREST limits.
  const inserted: { id: string; stage: SampleStage }[] = [];
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { data, error } = await authz.admin
      .from("animals")
      .insert(batch)
      .select("id, life_stage");
    if (error) return { error: error.message };
    for (let k = 0; k < (data?.length ?? 0); k++) {
      inserted.push({ id: data![k].id as string, stage: stages[i + k] });
    }
  }

  // Generate preg-check events so the rule engine + reproduction hub
  // see realistic pregnancy state:
  //   ~50 % of lactating cows  → pregnant, days_pregnant 30-220
  //   100 % of bred heifers    → pregnant, days_pregnant 60-270
  //   100 % of dry cows        → pregnant, days_pregnant 220-270
  const pregEvents: Record<string, unknown>[] = [];
  for (const a of inserted) {
    let dp: number | null = null;
    if (a.stage === "lactating" && Math.random() < 0.5) {
      dp = 30 + Math.floor(Math.random() * 190);
    } else if (a.stage === "bred_heifer") {
      dp = 60 + Math.floor(Math.random() * 210);
    } else if (a.stage === "dry") {
      dp = 220 + Math.floor(Math.random() * 50);
    }
    if (dp === null) continue;
    pregEvents.push({
      animal_id: a.id,
      event_date: daysAgo(Math.floor(Math.random() * 14)),
      event_type: "preg_check",
      result: "pregnant",
      preg_check_method: pick(["palpation", "ultrasound", "blood test"]),
      days_pregnant: dp,
      notes: "Sample preg check — generated for testing",
    });
  }
  if (pregEvents.length > 0) {
    for (let i = 0; i < pregEvents.length; i += 200) {
      const batch = pregEvents.slice(i, i + 200);
      const { error } = await authz.admin.from("repro_events").insert(batch);
      if (error) return { error: error.message };
    }
  }

  revalidatePath(`/animals`);
  revalidatePath(`/settings/locations/${locationId}/animals`);
  revalidatePath(`/`);
  revalidatePath(`/reproduction`);
  revalidatePath(`/group-moves`);
  return { success: true, generated: rows.length, preg_events: pregEvents.length };
}
