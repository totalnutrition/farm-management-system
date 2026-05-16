"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathSires } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const schema = z.object({
  naab: z.string().trim().min(1, "Sire/NAAB code is required."),
  breed: z.string().trim().optional(),
  semenType: z.enum(["conventional", "sexed", "beef"]),
  straws: z.coerce.number().int().min(0).optional(),
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
  const { naab, breed, semenType, straws } = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin.from("subjects").insert({
    organization_id: orgId,
    subject_type: "sire",
    natural_key: naab,
    attrs: {
      breed: breed ?? null,
      semen_type: semenType,
      straws: straws ?? 0,
    },
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `Sire “${naab}” already exists.` };
    return { error: error.message };
  }
  revalidatePath(PathSires);
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
  return { success: true };
}

const adjSchema = z.object({ id: z.uuid(), delta: z.coerce.number().int() });

export async function adjustStraws(
  input: z.infer<typeof adjSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const parsed = adjSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { id, delta } = parsed.data;
  const admin = createAdminClient();
  const { data: s } = await admin
    .from("subjects")
    .select("attrs")
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("subject_type", "sire")
    .maybeSingle();
  if (!s) return { error: "Sire not found." };
  const a = (s.attrs ?? {}) as Record<string, unknown>;
  const cur = typeof a.straws === "number" ? a.straws : 0;
  const { error } = await admin
    .from("subjects")
    .update({ attrs: { ...a, straws: Math.max(0, cur + delta) } })
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };
  revalidatePath(PathSires);
  return { success: true };
}
