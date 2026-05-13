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
  DairySettingsDefaults,
  HeatDetectionMethods,
  RfidTagTypes,
  type DairySettings,
} from "@/lib/dairy-settings";

type Result = { error?: string; success?: boolean };

const numOpt = (min: number, max: number) =>
  z.number().min(min).max(max).nullable();
const numReq = (min: number, max: number) => z.number().min(min).max(max);

const schema = z.object({
  location_id: z.uuid(),

  voluntary_waiting_period_days: numReq(0, 200),
  heat_detection_method: z.enum(
    HeatDetectionMethods.map((h) => h.value) as [string, ...string[]],
  ),
  preg_check_initial_days: numReq(14, 90),
  preg_check_confirm_days: numReq(20, 120),
  expected_gestation_days: numReq(250, 310),
  preg_rate_target_pct: numOpt(0, 100),
  conception_rate_target_pct: numOpt(0, 100),
  services_per_conception_target: numOpt(1, 10),
  do_not_breed_days_threshold: numOpt(0, 1000),

  dry_off_dcc_days: numReq(150, 300),
  close_up_dcc_days: numReq(200, 290),
  calving_alert_days_before: numReq(0, 60),

  scc_hospital_threshold: numReq(0, 10_000_000),
  scc_linear_score_hospital: numReq(0, 10),
  fat_target_pct: numOpt(0, 15),
  protein_target_pct: numOpt(0, 10),

  withdrawal_auto_flag: z.boolean(),
  withdrawal_extra_label_multiplier: numReq(0.1, 10),
  withdrawal_lookback_days: numReq(0, 365),

  bulk_tank_reconciliation_threshold_pct: numReq(0, 100),
  bulk_tank_pickup_cadence: z.string().nullable(),

  cull_rate_target_pct: numOpt(0, 100),
  rha_milk_target_kg: numOpt(0, 50_000),

  animal_id_prefix: z.string().nullable(),
  animal_id_padding: numReq(0, 12),
  rfid_type: z.enum(RfidTagTypes.map((r) => r.value) as [string, ...string[]]),
  require_840_id: z.boolean(),

  notes: z.string().nullable(),
});

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
  return { admin };
}

export async function getDairySettings(
  locationId: string,
): Promise<DairySettings> {
  const authz = await authorize(locationId);
  if ("error" in authz) return DairySettingsDefaults;
  const { data } = await authz.admin
    .from("location_dairy_settings")
    .select("*")
    .eq("location_id", locationId)
    .maybeSingle();
  if (!data) return DairySettingsDefaults;
  return {
    voluntary_waiting_period_days: data.voluntary_waiting_period_days as number,
    heat_detection_method: data.heat_detection_method as DairySettings["heat_detection_method"],
    preg_check_initial_days: data.preg_check_initial_days as number,
    preg_check_confirm_days: data.preg_check_confirm_days as number,
    expected_gestation_days: data.expected_gestation_days as number,
    preg_rate_target_pct: data.preg_rate_target_pct === null ? null : Number(data.preg_rate_target_pct),
    conception_rate_target_pct: data.conception_rate_target_pct === null ? null : Number(data.conception_rate_target_pct),
    services_per_conception_target: data.services_per_conception_target === null ? null : Number(data.services_per_conception_target),
    do_not_breed_days_threshold: data.do_not_breed_days_threshold as number | null,
    dry_off_dcc_days: data.dry_off_dcc_days as number,
    close_up_dcc_days: data.close_up_dcc_days as number,
    calving_alert_days_before: data.calving_alert_days_before as number,
    scc_hospital_threshold: data.scc_hospital_threshold as number,
    scc_linear_score_hospital: Number(data.scc_linear_score_hospital),
    fat_target_pct: data.fat_target_pct === null ? null : Number(data.fat_target_pct),
    protein_target_pct: data.protein_target_pct === null ? null : Number(data.protein_target_pct),
    withdrawal_auto_flag: data.withdrawal_auto_flag as boolean,
    withdrawal_extra_label_multiplier: Number(data.withdrawal_extra_label_multiplier),
    withdrawal_lookback_days: data.withdrawal_lookback_days as number,
    bulk_tank_reconciliation_threshold_pct: Number(data.bulk_tank_reconciliation_threshold_pct),
    bulk_tank_pickup_cadence: data.bulk_tank_pickup_cadence as string | null,
    cull_rate_target_pct: data.cull_rate_target_pct === null ? null : Number(data.cull_rate_target_pct),
    rha_milk_target_kg: data.rha_milk_target_kg as number | null,
    animal_id_prefix: data.animal_id_prefix as string | null,
    animal_id_padding: data.animal_id_padding as number,
    rfid_type: data.rfid_type as DairySettings["rfid_type"],
    require_840_id: data.require_840_id as boolean,
    notes: data.notes as string | null,
  };
}

export async function upsertDairySettings(
  input: z.infer<typeof schema>,
): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const authz = await authorize(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin
    .from("location_dairy_settings")
    .upsert(parsed.data, { onConflict: "location_id" });
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/reproduction`);
  revalidatePath(`/settings/locations/${parsed.data.location_id}/quality-withdrawal`);
  revalidatePath(`/settings/locations/${parsed.data.location_id}/bulk-tank`);
  revalidatePath(`/settings/locations/${parsed.data.location_id}/numbering`);
  return { success: true };
}
