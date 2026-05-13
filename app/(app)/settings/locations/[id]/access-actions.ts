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

export type LocationAccessRow = {
  id: string;
  user_id: string;
  email: string | null;
  name: string | null;
  default_access: "none" | "view" | "edit";
  section_access: Record<string, "none" | "view" | "edit">;
};

const upsertSchema = z.object({
  location_id: z.uuid(),
  user_id: z.uuid(),
  default_access: z.enum(["none", "view", "edit"]),
  section_access: z.record(z.string(), z.enum(["none", "view", "edit"])),
});

async function authorizeAdmin(locationId: string) {
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
  return { admin, orgId: data.organization_id as string };
}

export async function listLocationAccess(
  locationId: string,
): Promise<LocationAccessRow[]> {
  const authz = await authorizeAdmin(locationId);
  if ("error" in authz) return [];
  const [{ data: rows }, { data: profiles }] = await Promise.all([
    authz.admin
      .from("location_user_access")
      .select("id, user_id, default_access, section_access")
      .eq("location_id", locationId),
    authz.admin
      .from("profiles")
      .select("id, email, full_name, organization_id")
      .eq("organization_id", authz.orgId),
  ]);
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id as string, p as { id: string; email: string | null; full_name: string | null }]),
  );
  return (rows ?? []).map((r) => {
    const p = profileMap.get(r.user_id as string);
    return {
      id: r.id as string,
      user_id: r.user_id as string,
      email: p?.email ?? null,
      name: p?.full_name ?? null,
      default_access: r.default_access as LocationAccessRow["default_access"],
      section_access:
        (r.section_access as Record<string, "none" | "view" | "edit">) ?? {},
    };
  });
}

export async function listOrgUsers(
  locationId: string,
): Promise<{ id: string; email: string; name: string | null }[]> {
  const authz = await authorizeAdmin(locationId);
  if ("error" in authz) return [];
  const { data } = await authz.admin
    .from("profiles")
    .select("id, email, full_name")
    .eq("organization_id", authz.orgId)
    .order("full_name");
  return (data ?? []).map((p) => ({
    id: p.id as string,
    email: (p.email as string | null) ?? "",
    name: (p.full_name as string | null) ?? null,
  }));
}

export async function upsertLocationAccess(
  input: z.infer<typeof upsertSchema>,
): Promise<Result> {
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const authz = await authorizeAdmin(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin.from("location_user_access").upsert(
    {
      location_id: parsed.data.location_id,
      user_id: parsed.data.user_id,
      default_access: parsed.data.default_access,
      section_access: parsed.data.section_access,
    },
    { onConflict: "location_id,user_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/access`);
  return { success: true };
}

export async function revokeLocationAccess(input: {
  location_id: string;
  user_id: string;
}): Promise<Result> {
  const authz = await authorizeAdmin(input.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin
    .from("location_user_access")
    .delete()
    .eq("location_id", input.location_id)
    .eq("user_id", input.user_id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${input.location_id}/access`);
  return { success: true };
}
