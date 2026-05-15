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

const sireSchema = z.object({
  id: z.string().uuid().optional(),
  naab: z
    .string()
    .trim()
    .min(2, "NAAB / stud code required.")
    .max(40)
    .transform((s) => s.toUpperCase()),
  registered_name: z.string().trim().min(1, "Registered name required.").max(160),
  short_name: z.string().trim().max(80).nullable().optional(),
  breed_code: z.string().trim().max(8).nullable().optional(),
  status: z.enum(["active", "inactive", "dead", "sold"]).default("active"),
  country_of_origin: z.string().trim().max(2).nullable().optional(),
  owner_company: z.string().trim().max(120).nullable().optional(),
  ptam_milk_kg: z.number().nullable().optional(),
  ptam_fat_kg: z.number().nullable().optional(),
  ptam_protein_kg: z.number().nullable().optional(),
  ptam_scs: z.number().nullable().optional(),
  ptam_dpr: z.number().nullable().optional(),
  ptam_calving_ease_pct: z.number().nullable().optional(),
  ptam_productive_life: z.number().nullable().optional(),
  net_merit: z.number().nullable().optional(),
  photo_url: z.string().trim().url().nullable().optional().or(z.literal("")),
  notes: z.string().max(1000).nullable().optional(),
});

export type SireInput = z.infer<typeof sireSchema>;

async function requireOrgEditor() {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId && role !== RoleSuperAdmin) {
    return { error: "Your account is not linked to an organization." as const };
  }
  return { orgId, role, user };
}

export async function upsertSire(input: SireInput): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = sireSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const admin = createAdminClient();
  const row = {
    organization_id: ctx.orgId ?? null,
    naab: parsed.data.naab,
    registered_name: parsed.data.registered_name,
    short_name: parsed.data.short_name || null,
    breed_code: parsed.data.breed_code || null,
    status: parsed.data.status,
    country_of_origin: parsed.data.country_of_origin?.toUpperCase() || null,
    owner_company: parsed.data.owner_company || null,
    ptam_milk_kg: parsed.data.ptam_milk_kg ?? null,
    ptam_fat_kg: parsed.data.ptam_fat_kg ?? null,
    ptam_protein_kg: parsed.data.ptam_protein_kg ?? null,
    ptam_scs: parsed.data.ptam_scs ?? null,
    ptam_dpr: parsed.data.ptam_dpr ?? null,
    ptam_calving_ease_pct: parsed.data.ptam_calving_ease_pct ?? null,
    ptam_productive_life: parsed.data.ptam_productive_life ?? null,
    net_merit: parsed.data.net_merit ?? null,
    photo_url: parsed.data.photo_url || null,
    notes: parsed.data.notes || null,
  };

  if (parsed.data.id) {
    const { error } = await admin.from("sires").update(row).eq("id", parsed.data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await admin.from("sires").insert(row);
    if (error) return { error: error.message };
  }

  revalidatePath("/settings/organization/sires");
  return { success: true };
}

export async function deleteSire(id: string): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  if (!id) return { error: "Missing id." };

  const admin = createAdminClient();
  // Refuse delete if straws still reference this sire — user must
  // sell/transfer the straws first.
  const { count } = await admin
    .from("semen_straws")
    .select("id", { count: "exact", head: true })
    .eq("sire_id", id);
  if ((count ?? 0) > 0) {
    return {
      error: `${count} straw batch(es) still reference this sire. Move or sell straws first.`,
    };
  }

  const { error } = await admin.from("sires").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/settings/organization/sires");
  return { success: true };
}
