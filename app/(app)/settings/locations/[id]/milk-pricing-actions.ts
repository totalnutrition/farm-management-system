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

export type PricingScheme = {
  id: string;
  location_id: string;
  template_id: string | null;
  name: string;
  currency: string;
  base_unit: string;
  correction: string;
  base_price_per_unit: number | null;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
};

const baseSchema = z.object({
  location_id: z.uuid(),
  template_id: z.uuid().nullable(),
  name: z.string().trim().min(1, "Name required."),
  currency: z.string().trim().min(3).max(8),
  base_unit: z.string().trim().min(1),
  correction: z.enum([
    "raw",
    "fcm_3.5",
    "fcm_4",
    "ecm_nrc",
    "ecm_tr",
    "ms",
    "ts",
    "fat_corrected",
    "snf_corrected",
    "custom",
  ]),
  base_price_per_unit: z.number().min(0).max(1_000_000).nullable(),
  effective_from: z.string().min(10),
  effective_to: z.string().nullable(),
  notes: z.string().trim().nullable(),
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

export async function listPricingSchemes(
  locationId: string,
): Promise<PricingScheme[]> {
  const authz = await authorize(locationId);
  if ("error" in authz) return [];
  const { data } = await authz.admin
    .from("milk_pricing_schemes")
    .select(
      "id, location_id, template_id, name, currency, base_unit, correction, base_price_per_unit, effective_from, effective_to, notes",
    )
    .eq("location_id", locationId)
    .order("effective_from", { ascending: false });
  return (data ?? []) as PricingScheme[];
}

export async function createPricingScheme(
  input: z.infer<typeof baseSchema>,
): Promise<Result> {
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const authz = await authorize(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin.from("milk_pricing_schemes").insert({
    ...parsed.data,
    currency: parsed.data.currency.toUpperCase(),
    notes: parsed.data.notes || null,
    effective_to: parsed.data.effective_to || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/milk-pricing`);
  return { success: true };
}

export async function updatePricingScheme(
  input: z.infer<typeof updateSchema>,
): Promise<Result> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const authz = await authorize(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { id, ...rest } = parsed.data;
  const { error } = await authz.admin
    .from("milk_pricing_schemes")
    .update({
      ...rest,
      currency: rest.currency.toUpperCase(),
      notes: rest.notes || null,
      effective_to: rest.effective_to || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/milk-pricing`);
  return { success: true };
}

export async function deletePricingScheme(input: {
  id: string;
  location_id: string;
}): Promise<Result> {
  const authz = await authorize(input.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin
    .from("milk_pricing_schemes")
    .delete()
    .eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${input.location_id}/milk-pricing`);
  return { success: true };
}
