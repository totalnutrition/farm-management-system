"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import {
  PathHome,
  PathLocations,
  RoleAdmin,
  RoleSuperAdmin,
} from "@/lib/misc";
import { CurrentLocationCookie } from "@/lib/current-location";

type Result = { error?: string; success?: boolean };

const kindEnum = z.enum([
  "dairy",
  "beef",
  "poultry",
  "small_ruminants",
  "mixed",
  "other",
]);

const baseSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  kind: kindEnum,
  address: z.string().trim(),
  organization_id: z.uuid().optional(),
});

const updateSchema = baseSchema.extend({
  id: z.uuid(),
});

export async function createLocation(
  input: z.infer<typeof baseSchema>,
): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);

  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { name, kind, address, organization_id } = parsed.data;

  let orgId = getOrganizationIdFromUser(user);
  if (getRoleFromUser(user) === RoleSuperAdmin) {
    orgId = organization_id ?? orgId;
  }
  if (!orgId) {
    return {
      error:
        "No organization context. Super admins must pass an organization_id.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("locations").insert({
    name,
    kind,
    address: address || null,
    organization_id: orgId,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath(PathLocations);
  revalidatePath(PathHome);
  return { success: true };
}

export async function updateLocation(
  input: z.infer<typeof updateSchema>,
): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { id, name, kind, address } = parsed.data;

  const admin = createAdminClient();

  if (getRoleFromUser(user) !== RoleSuperAdmin) {
    const orgId = getOrganizationIdFromUser(user);
    const { data: existing } = await admin
      .from("locations")
      .select("organization_id")
      .eq("id", id)
      .maybeSingle();
    if (!existing || existing.organization_id !== orgId) {
      return { error: "You can only update locations in your organization." };
    }
  }

  const { error } = await admin
    .from("locations")
    .update({ name, kind, address: address || null })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(PathLocations);
  revalidatePath(PathHome);
  return { success: true };
}

export async function deleteLocation(id: string): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);

  const admin = createAdminClient();

  if (getRoleFromUser(user) !== RoleSuperAdmin) {
    const orgId = getOrganizationIdFromUser(user);
    const { data: existing } = await admin
      .from("locations")
      .select("organization_id")
      .eq("id", id)
      .maybeSingle();
    if (!existing || existing.organization_id !== orgId) {
      return { error: "You can only delete locations in your organization." };
    }
  }

  const { error } = await admin.from("locations").delete().eq("id", id);
  if (error) return { error: error.message };

  const store = await cookies();
  if (store.get(CurrentLocationCookie)?.value === id) {
    store.delete(CurrentLocationCookie);
  }

  revalidatePath(PathLocations);
  revalidatePath(PathHome);
  return { success: true };
}

export async function setCurrentLocation(id: string): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);

  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid location id." };

  const store = await cookies();
  store.set(CurrentLocationCookie, parsed.data, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath(PathHome);
  return { success: true };
}
