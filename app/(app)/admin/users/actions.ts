"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireRole, requireUser } from "@/lib/supabase-auth";
import {
  PathAdminUsers,
  RoleAdmin,
  RoleSuperAdmin,
} from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const createSchema = z
  .object({
    full_name: z.string().trim().min(1, "Name is required."),
    email: z.email("Enter a valid email."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    role: z.enum([RoleSuperAdmin, RoleAdmin]),
    organization_name: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (data.role === RoleAdmin && !data.organization_name) {
      ctx.addIssue({
        code: "custom",
        path: ["organization_name"],
        message: "Organization name is required.",
      });
    }
  });

const updateSchema = z.object({
  id: z.uuid(),
  full_name: z.string().trim().min(1, "Name is required."),
  organization_name: z.string().trim().min(1, "Organization name is required."),
});

export async function createAdminUser(
  input: z.infer<typeof createSchema>,
): Promise<Result> {
  await requireRole(RoleSuperAdmin as "super_admin");

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { full_name, email, password, role, organization_name } = parsed.data;

  const admin = createAdminClient();

  let orgId: string | null = null;
  if (role === RoleAdmin) {
    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({ name: organization_name })
      .select("id")
      .single();
    if (orgErr || !org) {
      return { error: orgErr?.message ?? "Failed to create organization." };
    }
    orgId = org.id;
  }

  const appMetadata: Record<string, unknown> = { role };
  if (orgId) appMetadata.organization_id = orgId;

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
    app_metadata: appMetadata,
  });
  if (authErr || !created.user) {
    if (orgId) await admin.from("organizations").delete().eq("id", orgId);
    return { error: authErr?.message ?? "Failed to create user." };
  }

  const { error: profErr } = await admin.from("profiles").insert({
    id: created.user.id,
    email,
    full_name,
    role,
    organization_id: orgId,
  });
  if (profErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    if (orgId) await admin.from("organizations").delete().eq("id", orgId);
    return { error: profErr.message };
  }

  revalidatePath(PathAdminUsers);
  return { success: true };
}

export async function updateAdminUser(
  input: z.infer<typeof updateSchema>,
): Promise<Result> {
  await requireRole(RoleSuperAdmin as "super_admin");

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { id, full_name, organization_name } = parsed.data;

  const admin = createAdminClient();

  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .update({ full_name })
    .eq("id", id)
    .select("organization_id")
    .single();
  if (pErr || !profile) {
    return { error: pErr?.message ?? "Profile not found." };
  }

  await admin.auth.admin.updateUserById(id, {
    user_metadata: { full_name },
  });

  if (profile.organization_id) {
    const { error: oErr } = await admin
      .from("organizations")
      .update({ name: organization_name })
      .eq("id", profile.organization_id);
    if (oErr) return { error: oErr.message };
  }

  revalidatePath(PathAdminUsers);
  return { success: true };
}

const updateMySchema = z.object({
  full_name: z.string().trim().min(1, "Name is required."),
});

export async function updateMyProfile(
  input: z.infer<typeof updateMySchema>,
): Promise<Result> {
  const user = await requireUser();

  const parsed = updateMySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { full_name } = parsed.data;

  const admin = createAdminClient();

  const { error: pErr } = await admin
    .from("profiles")
    .update({ full_name })
    .eq("id", user.id);
  if (pErr) return { error: pErr.message };

  const { error: aErr } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, full_name },
  });
  if (aErr) return { error: aErr.message };

  revalidatePath(PathAdminUsers);
  return { success: true };
}

export async function setAdminUserActive(
  id: string,
  isActive: boolean,
): Promise<Result> {
  await requireRole(RoleSuperAdmin as "super_admin");

  const admin = createAdminClient();

  const { error: pErr } = await admin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", id);
  if (pErr) return { error: pErr.message };

  const { error: aErr } = await admin.auth.admin.updateUserById(id, {
    ban_duration: isActive ? "none" : "876000h",
  });
  if (aErr) return { error: aErr.message };

  revalidatePath(PathAdminUsers);
  return { success: true };
}

export async function deleteAdminUser(id: string): Promise<Result> {
  await requireRole(RoleSuperAdmin as "super_admin");

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", id)
    .single();

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: error.message };

  if (profile?.organization_id) {
    await admin
      .from("organizations")
      .delete()
      .eq("id", profile.organization_id);
  }

  revalidatePath(PathAdminUsers);
  return { success: true };
}
