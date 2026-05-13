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

export type CropPlan = {
  id: string;
  parcel_id: string;
  crop_type: string;
  variety: string | null;
  planted_at: string | null;
  planned_harvest_at: string | null;
  status: string;
  expected_yield_kg_per_ha: number | null;
  actual_yield_kg_per_ha: number | null;
  notes: string | null;
};

export type CropEvent = {
  id: string;
  plan_id: string;
  event_date: string;
  event_type: string;
  description: string | null;
};

const planSchema = z.object({
  parcel_id: z.uuid(),
  crop_type: z.string().trim().min(1, "Crop type required."),
  variety: z.string().trim().nullable(),
  planted_at: z.string().nullable(),
  planned_harvest_at: z.string().nullable(),
  status: z.enum(["planned", "in_progress", "harvested", "failed", "archived"]),
  expected_yield_kg_per_ha: z.number().min(0).max(1_000_000).nullable(),
  actual_yield_kg_per_ha: z.number().min(0).max(1_000_000).nullable(),
  notes: z.string().trim().nullable(),
});

const updatePlanSchema = planSchema.extend({ id: z.uuid() });

const eventSchema = z.object({
  plan_id: z.uuid(),
  event_date: z.string().min(10),
  event_type: z.enum([
    "planting",
    "irrigation",
    "fertilization",
    "spray",
    "scouting",
    "harvest",
    "residue_management",
    "other",
  ]),
  description: z.string().trim().nullable(),
});

async function authorizeByParcel(parcelId: string) {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);
  const admin = createAdminClient();
  const { data } = await admin
    .from("arable_parcels")
    .select("id, location_id, locations:locations!inner(organization_id)")
    .eq("id", parcelId)
    .single();
  if (!data) return { error: "Parcel not found." as const };
  const orgFromParcel = (data.locations as unknown as { organization_id: string })
    ?.organization_id;
  if (role !== RoleSuperAdmin && orgFromParcel !== orgId) {
    return { error: "Cross-org access denied." as const };
  }
  return { admin, locationId: data.location_id as string };
}

async function authorizeByLocation(locationId: string) {
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

export async function listCropPlansForLocation(
  locationId: string,
): Promise<(CropPlan & { parcel_name: string })[]> {
  const authz = await authorizeByLocation(locationId);
  if ("error" in authz) return [];
  const { data: parcels } = await authz.admin
    .from("arable_parcels")
    .select("id, name")
    .eq("location_id", locationId);
  const parcelIds = (parcels ?? []).map((p) => p.id as string);
  if (parcelIds.length === 0) return [];
  const parcelNameMap = new Map(
    (parcels ?? []).map((p) => [p.id as string, p.name as string]),
  );
  const { data: plans } = await authz.admin
    .from("crop_plans")
    .select(
      "id, parcel_id, crop_type, variety, planted_at, planned_harvest_at, status, expected_yield_kg_per_ha, actual_yield_kg_per_ha, notes",
    )
    .in("parcel_id", parcelIds)
    .order("planted_at", { ascending: false, nullsFirst: true });
  return ((plans ?? []) as CropPlan[]).map((p) => ({
    ...p,
    parcel_name: parcelNameMap.get(p.parcel_id) ?? "(unknown)",
  }));
}

export async function listCropEvents(planId: string): Promise<CropEvent[]> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);
  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("crop_plans")
    .select("id, parcel_id, arable_parcels:arable_parcels!inner(locations:locations!inner(organization_id))")
    .eq("id", planId)
    .single();
  if (!plan) return [];
  const planOrg = (plan.arable_parcels as unknown as { locations: { organization_id: string } })
    ?.locations?.organization_id;
  if (role !== RoleSuperAdmin && planOrg !== orgId) return [];
  const { data } = await admin
    .from("crop_events")
    .select("id, plan_id, event_date, event_type, description")
    .eq("plan_id", planId)
    .order("event_date", { ascending: false });
  return (data ?? []) as CropEvent[];
}

export async function createCropPlan(
  input: z.infer<typeof planSchema>,
): Promise<Result> {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const authz = await authorizeByParcel(parsed.data.parcel_id);
  if ("error" in authz) return { error: authz.error };
  const { data, error } = await authz.admin
    .from("crop_plans")
    .insert({
      ...parsed.data,
      variety: parsed.data.variety || null,
      notes: parsed.data.notes || null,
      planted_at: parsed.data.planted_at || null,
      planned_harvest_at: parsed.data.planned_harvest_at || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${authz.locationId}/crops`);
  return { success: true, id: data?.id as string };
}

export async function updateCropPlan(
  input: z.infer<typeof updatePlanSchema>,
): Promise<Result> {
  const parsed = updatePlanSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const authz = await authorizeByParcel(parsed.data.parcel_id);
  if ("error" in authz) return { error: authz.error };
  const { id, ...rest } = parsed.data;
  const { error } = await authz.admin
    .from("crop_plans")
    .update({
      ...rest,
      variety: rest.variety || null,
      notes: rest.notes || null,
      planted_at: rest.planted_at || null,
      planned_harvest_at: rest.planned_harvest_at || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${authz.locationId}/crops`);
  return { success: true };
}

export async function deleteCropPlan(input: {
  id: string;
  parcel_id: string;
}): Promise<Result> {
  const authz = await authorizeByParcel(input.parcel_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin.from("crop_plans").delete().eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${authz.locationId}/crops`);
  return { success: true };
}

export async function recordCropEvent(
  input: z.infer<typeof eventSchema>,
): Promise<Result> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);
  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("crop_plans")
    .select(
      "id, parcel_id, arable_parcels:arable_parcels!inner(location_id, locations:locations!inner(organization_id))",
    )
    .eq("id", parsed.data.plan_id)
    .single();
  if (!plan) return { error: "Plan not found." };
  const planOrg = (
    plan.arable_parcels as unknown as { locations: { organization_id: string }; location_id: string }
  )?.locations?.organization_id;
  const locationId = (
    plan.arable_parcels as unknown as { location_id: string }
  )?.location_id;
  if (role !== RoleSuperAdmin && planOrg !== orgId) {
    return { error: "Cross-org access denied." };
  }
  const { error } = await admin.from("crop_events").insert({
    plan_id: parsed.data.plan_id,
    event_date: parsed.data.event_date,
    event_type: parsed.data.event_type,
    description: parsed.data.description || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${locationId}/crops`);
  return { success: true };
}
