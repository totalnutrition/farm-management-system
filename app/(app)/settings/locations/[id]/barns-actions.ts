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
import {
  BarnTypes,
  BarnLayouts,
  ParlorTypes,
  RowConfigurations,
  VentilationTypes,
  type Barn,
} from "@/lib/barns";

type Result = { error?: string; success?: boolean };

const optInt = z.number().int().min(0).max(1_000_000).nullable();
const optNum = z.number().min(0).max(1_000_000).nullable();
const optText = z.string().trim().max(120).nullable();

const baseSchema = z.object({
  location_id: z.uuid(),
  name: z.string().trim().min(1, "Name is required."),
  barn_code: optText.optional(),
  type: z.enum(BarnTypes.map((b) => b.value) as [string, ...string[]]),
  row_configuration: z
    .enum(RowConfigurations.map((r) => r.value) as [string, ...string[]])
    .nullable()
    .optional(),
  length_ft: optNum.optional(),
  width_ft: optNum.optional(),
  layout: z
    .enum(BarnLayouts.map((l) => l.value) as [string, ...string[]])
    .default("double_side"),
  alley_width_ft: optNum.optional(),
  freestall_count: optInt.optional(),
  headlock_count: optInt.optional(),
  loafing_area_sqft: optInt.optional(),
  holding_pen_capacity: optInt.optional(),
  stall_surface: optText.optional(),
  bedding_type: optText.optional(),
  stall_length_ft: optNum.optional(),
  stall_width_in: optNum.optional(),
  neck_rail_height_in: optNum.optional(),
  bunk_type: optText.optional(),
  bunk_total_linear_ft: optNum.optional(),
  floor_type: optText.optional(),
  manure_handling: optText.optional(),
  ventilation_type: z
    .enum(VentilationTypes.map((v) => v.value) as [string, ...string[]])
    .nullable()
    .optional(),
  fan_count: optInt.optional(),
  fan_diameter_in: optNum.optional(),
  soaker_lines_present: z.boolean().default(false),
  soaker_nozzle_height_in: optNum.optional(),
  sprinklers: z.boolean().default(false),
  fans_over_stalls: z.boolean().default(false),
  brushes_count: optInt.optional(),
  footbath_present: z.boolean().default(false),
  parlor_type: z
    .enum(ParlorTypes.map((p) => p.value) as [string, ...string[]])
    .nullable()
    .optional(),
  parlor_stalls: optInt.optional(),
  robot_count: optInt.optional(),
  notes: z.string().trim().nullable().optional(),
});

const updateSchema = baseSchema.extend({ id: z.uuid() });

async function authorize(locationId: string) {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);
  const admin = createAdminClient();
  const { data } = await admin
    .from("locations")
    .select("id, organization_id, manages_livestock")
    .eq("id", locationId)
    .single();
  if (!data) return { error: "Location not found." as const };
  if (role !== RoleSuperAdmin && data.organization_id !== orgId) {
    return { error: "Cross-org access denied." as const };
  }
  return { admin, location: data };
}

export async function listBarns(locationId: string): Promise<Barn[]> {
  const authz = await authorize(locationId);
  if ("error" in authz) return [];
  const { data } = await authz.admin
    .from("barns")
    .select("*")
    .eq("location_id", locationId)
    .order("name");
  return (data ?? []) as Barn[];
}

function toRow(input: z.infer<typeof baseSchema>) {
  return {
    location_id: input.location_id,
    name: input.name,
    barn_code: input.barn_code ?? null,
    type: input.type,
    row_configuration: input.row_configuration ?? null,
    length_ft: input.length_ft ?? null,
    width_ft: input.width_ft ?? null,
    layout: input.layout,
    alley_width_ft: input.alley_width_ft ?? null,
    freestall_count: input.freestall_count ?? null,
    headlock_count: input.headlock_count ?? null,
    loafing_area_sqft: input.loafing_area_sqft ?? null,
    holding_pen_capacity: input.holding_pen_capacity ?? null,
    stall_surface: input.stall_surface ?? null,
    bedding_type: input.bedding_type ?? null,
    stall_length_ft: input.stall_length_ft ?? null,
    stall_width_in: input.stall_width_in ?? null,
    neck_rail_height_in: input.neck_rail_height_in ?? null,
    bunk_type: input.bunk_type ?? null,
    bunk_total_linear_ft: input.bunk_total_linear_ft ?? null,
    floor_type: input.floor_type ?? null,
    manure_handling: input.manure_handling ?? null,
    ventilation_type: input.ventilation_type ?? null,
    fan_count: input.fan_count ?? null,
    fan_diameter_in: input.fan_diameter_in ?? null,
    soaker_lines_present: input.soaker_lines_present,
    soaker_nozzle_height_in: input.soaker_nozzle_height_in ?? null,
    sprinklers: input.sprinklers,
    fans_over_stalls: input.fans_over_stalls,
    brushes_count: input.brushes_count ?? null,
    footbath_present: input.footbath_present,
    parlor_type: input.parlor_type ?? null,
    parlor_stalls: input.parlor_stalls ?? null,
    robot_count: input.robot_count ?? null,
    notes: input.notes ?? null,
  };
}

export async function createBarn(
  input: z.infer<typeof baseSchema>,
): Promise<Result> {
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const authz = await authorize(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin.from("barns").insert(toRow(parsed.data));
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/infrastructure`);
  return { success: true };
}

export async function updateBarn(
  input: z.infer<typeof updateSchema>,
): Promise<Result> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const authz = await authorize(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { id, ...rest } = parsed.data;
  const { error } = await authz.admin.from("barns").update(toRow(rest)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/infrastructure`);
  return { success: true };
}

export async function deleteBarn(input: {
  id: string;
  location_id: string;
}): Promise<Result> {
  const authz = await authorize(input.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin.from("barns").delete().eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${input.location_id}/infrastructure`);
  return { success: true };
}
