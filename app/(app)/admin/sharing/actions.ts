"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathSharing } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const schema = z.object({
  email: z.email("Enter a valid email."),
  role: z.enum(["vet", "nutritionist", "viewer"]),
  scope: z.enum(["read", "write"]),
});

export async function addShare(
  input: z.infer<typeof schema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { email, role, scope } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.from("org_shares").insert({
    organization_id: orgId,
    email: email.toLowerCase(),
    role,
    scope,
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `${email} already has access.` };
    return { error: error.message };
  }
  revalidatePath(PathSharing);
  return { success: true };
}

export async function removeShare(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("org_shares")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };
  revalidatePath(PathSharing);
  return { success: true };
}
