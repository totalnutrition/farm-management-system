"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathHousing } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const schema = z.object({
  name: z.string().trim().min(1, "Barn name is required."),
  location: z.string().trim().optional(),
});

export async function createBarn(
  input: z.infer<typeof schema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { name, location } = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin.from("subjects").insert({
    organization_id: orgId,
    subject_type: "barn",
    natural_key: name,
    attrs: { location: location ?? null },
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `Barn “${name}” already exists.` };
    return { error: error.message };
  }
  revalidatePath(PathHousing);
  return { success: true };
}

export async function deleteBarn(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const admin = createAdminClient();

  const { data: barn } = await admin
    .from("subjects")
    .select("natural_key")
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("subject_type", "barn")
    .maybeSingle();
  if (!barn) return { error: "Barn not found." };

  // Pens store their barn by name in attrs (no FK) — block the delete
  // so it can't silently orphan pens.
  const { data: pens } = await admin
    .from("subjects")
    .select("attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "pen");
  const n = (pens ?? []).filter(
    (p) =>
      (p.attrs as Record<string, unknown> | null)?.barn ===
      barn.natural_key,
  ).length;
  if (n > 0)
    return {
      error: `“${barn.natural_key}” still has ${n} pen${
        n === 1 ? "" : "s"
      }. Reassign or delete them first.`,
    };

  const { error } = await admin
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("subject_type", "barn");
  if (error) return { error: error.message };
  revalidatePath(PathHousing);
  return { success: true };
}
