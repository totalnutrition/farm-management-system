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

type Result = { error?: string; success?: boolean };

const baseSchema = z.object({
  location_id: z.uuid(),
  name: z.string().trim().min(1, "Name required."),
  parcel_code: z.string().trim().nullable(),
  area_hectares: z.number().min(0).max(1_000_000).nullable(),
  status: z.enum(["active", "fallow", "archived"]),
  notes: z.string().trim().nullable(),
});

const updateSchema = baseSchema.extend({ id: z.uuid() });

export type ArableParcel = {
  id: string;
  location_id: string;
  name: string;
  parcel_code: string | null;
  area_hectares: number | null;
  status: "active" | "fallow" | "archived";
  notes: string | null;
};

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

export async function listArableParcels(
  locationId: string,
): Promise<ArableParcel[]> {
  const authz = await authorize(locationId);
  if ("error" in authz) return [];
  const { data } = await authz.admin
    .from("arable_parcels")
    .select("id, location_id, name, parcel_code, area_hectares, status, notes")
    .eq("location_id", locationId)
    .order("name");
  return (data ?? []) as ArableParcel[];
}

export async function createArableParcel(
  input: z.infer<typeof baseSchema>,
): Promise<Result> {
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const authz = await authorize(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin.from("arable_parcels").insert({
    ...parsed.data,
    parcel_code: parsed.data.parcel_code || null,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/infrastructure`);
  return { success: true };
}

export async function updateArableParcel(
  input: z.infer<typeof updateSchema>,
): Promise<Result> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const authz = await authorize(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { id, ...rest } = parsed.data;
  const { error } = await authz.admin
    .from("arable_parcels")
    .update({
      ...rest,
      parcel_code: rest.parcel_code || null,
      notes: rest.notes || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/infrastructure`);
  return { success: true };
}

export async function deleteArableParcel(input: {
  id: string;
  location_id: string;
}): Promise<Result> {
  const authz = await authorize(input.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin
    .from("arable_parcels")
    .delete()
    .eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${input.location_id}/infrastructure`);
  return { success: true };
}
