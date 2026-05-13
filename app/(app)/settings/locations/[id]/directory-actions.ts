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

export type DirectoryEntry = {
  id: string;
  location_id: string;
  role: string;
  full_name: string;
  organization_name: string | null;
  email: string | null;
  phone: string | null;
  external_id: string | null;
  notes: string | null;
  is_active: boolean;
};

const baseSchema = z.object({
  location_id: z.uuid(),
  role: z.enum([
    "technician",
    "veterinarian",
    "hoof_trimmer",
    "nutritionist",
    "inseminator",
    "consultant",
    "other",
  ]),
  full_name: z.string().trim().min(1, "Name required."),
  organization_name: z.string().trim().nullable(),
  email: z.string().trim().nullable(),
  phone: z.string().trim().nullable(),
  external_id: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
  is_active: z.boolean(),
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

export async function listDirectory(locationId: string): Promise<DirectoryEntry[]> {
  const authz = await authorize(locationId);
  if ("error" in authz) return [];
  const { data } = await authz.admin
    .from("location_directory")
    .select(
      "id, location_id, role, full_name, organization_name, email, phone, external_id, notes, is_active",
    )
    .eq("location_id", locationId)
    .order("role")
    .order("full_name");
  return (data ?? []) as DirectoryEntry[];
}

export async function createDirectoryEntry(
  input: z.infer<typeof baseSchema>,
): Promise<Result> {
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const authz = await authorize(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin.from("location_directory").insert({
    ...parsed.data,
    organization_name: parsed.data.organization_name || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    external_id: parsed.data.external_id || null,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/directories`);
  return { success: true };
}

export async function updateDirectoryEntry(
  input: z.infer<typeof updateSchema>,
): Promise<Result> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const authz = await authorize(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { id, ...rest } = parsed.data;
  const { error } = await authz.admin
    .from("location_directory")
    .update({
      ...rest,
      organization_name: rest.organization_name || null,
      email: rest.email || null,
      phone: rest.phone || null,
      external_id: rest.external_id || null,
      notes: rest.notes || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/directories`);
  return { success: true };
}

export async function deleteDirectoryEntry(input: {
  id: string;
  location_id: string;
}): Promise<Result> {
  const authz = await authorize(input.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin
    .from("location_directory")
    .delete()
    .eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${input.location_id}/directories`);
  return { success: true };
}
