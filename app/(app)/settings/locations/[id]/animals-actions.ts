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
};

const sexEnum = z.enum(["female", "male", "freemartin", "castrated"]);
const statusEnum = z.enum(["active", "sold", "dead", "culled", "reference"]);
const originEnum = z.enum(["born_on_farm", "purchased", "imported", "leased", "other"]);

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
      "id, animal_id, name, official_id, registration_number, breed_code, sex, birth_date, status, status_date, origin, source_farm, entry_date, current_pen_id, current_group_id, current_lactation, last_calving_date, sire_naab, sire_name, dam_tag_external, notes",
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
      "id, animal_id, name, official_id, registration_number, breed_code, sex, birth_date, status, status_date, origin, source_farm, entry_date, current_pen_id, current_group_id, current_lactation, last_calving_date, sire_naab, sire_name, dam_tag_external, notes",
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
  };
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
  revalidatePath(`/settings/locations/${parsed.data.location_id}/animals`);
  return { success: true, id: data?.id as string };
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
