"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathSires, PathBreeding } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const schema = z.object({
  naab: z.string().trim().min(1, "Sire/NAAB code is required."),
  breed: z.string().trim().optional(),
  semenType: z.enum(["conventional", "sexed", "beef"]),
});

export async function createSire(
  input: z.infer<typeof schema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { naab, breed, semenType } = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin.from("subjects").insert({
    organization_id: orgId,
    subject_type: "sire",
    natural_key: naab,
    attrs: {
      breed: breed ?? null,
      semen_type: semenType,
    },
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `Sire “${naab}” already exists.` };
    return { error: error.message };
  }
  revalidatePath(PathSires);
  revalidatePath(PathBreeding);
  return { success: true };
}

export async function deleteSire(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("subject_type", "sire");
  if (error) return { error: error.message };
  revalidatePath(PathSires);
  revalidatePath(PathBreeding);
  return { success: true };
}
