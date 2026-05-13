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

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "item";

async function requireOrgEditor() {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId && role !== RoleSuperAdmin) {
    return { error: "Your account is not linked to an organization." as const };
  }
  return { orgId, role, user };
}

// -------------------------------------------------------------------
// Feed materials
// -------------------------------------------------------------------
const feedSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required.").max(120),
  category: z.enum([
    "forage",
    "grain",
    "protein",
    "byproduct",
    "mineral",
    "vitamin",
    "water",
    "fat",
    "additive",
  ]),
  dm_pct: z.number().min(0).max(100).nullable().optional(),
  ne_l_mcal_per_kg: z.number().min(0).max(10).nullable().optional(),
  cp_pct: z.number().min(0).max(100).nullable().optional(),
  ndf_pct: z.number().min(0).max(100).nullable().optional(),
  starch_pct: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
export type FeedMaterialInput = z.infer<typeof feedSchema>;

export async function upsertFeedMaterial(input: FeedMaterialInput): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = feedSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const row = {
    organization_id: ctx.orgId,
    name: parsed.data.name,
    category: parsed.data.category,
    dm_pct: parsed.data.dm_pct ?? null,
    ne_l_mcal_per_kg: parsed.data.ne_l_mcal_per_kg ?? null,
    cp_pct: parsed.data.cp_pct ?? null,
    ndf_pct: parsed.data.ndf_pct ?? null,
    starch_pct: parsed.data.starch_pct ?? null,
    notes: parsed.data.notes ?? null,
    is_seed: false,
  };

  const { error } = parsed.data.id
    ? await admin.from("org_feed_materials").update(row).eq("id", parsed.data.id).eq("is_seed", false)
    : await admin.from("org_feed_materials").insert(row);
  if (error) return { error: error.message };

  revalidatePath("/settings/organization/catalogs");
  return { success: true };
}

export async function deleteFeedMaterial(id: string): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("org_feed_materials")
    .delete()
    .eq("id", id)
    .eq("is_seed", false)
    .eq("organization_id", ctx.orgId ?? "");
  if (error) return { error: error.message };
  revalidatePath("/settings/organization/catalogs");
  return { success: true };
}

// -------------------------------------------------------------------
// Vet medicines
// -------------------------------------------------------------------
const vetSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required.").max(120),
  brand: z.string().max(120).nullable().optional(),
  active_ingredient: z.string().max(200).nullable().optional(),
  category: z.enum([
    "antibiotic",
    "anti-inflammatory",
    "hormone",
    "vaccine",
    "parasiticide",
    "mineral",
    "fluid",
    "other",
  ]),
  route: z.string().max(40).nullable().optional(),
  default_dose: z.string().max(120).nullable().optional(),
  withdrawal_milk_hours: z.number().int().min(0).max(8760).nullable().optional(),
  withdrawal_meat_days: z.number().int().min(0).max(365).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
export type VetMedicineInput = z.infer<typeof vetSchema>;

export async function upsertVetMedicine(input: VetMedicineInput): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = vetSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const row = {
    organization_id: ctx.orgId,
    name: parsed.data.name,
    brand: parsed.data.brand ?? null,
    active_ingredient: parsed.data.active_ingredient ?? null,
    category: parsed.data.category,
    route: parsed.data.route ?? null,
    default_dose: parsed.data.default_dose ?? null,
    withdrawal_milk_hours: parsed.data.withdrawal_milk_hours ?? null,
    withdrawal_meat_days: parsed.data.withdrawal_meat_days ?? null,
    notes: parsed.data.notes ?? null,
    is_seed: false,
  };

  const { error } = parsed.data.id
    ? await admin.from("org_vet_medicines").update(row).eq("id", parsed.data.id).eq("is_seed", false)
    : await admin.from("org_vet_medicines").insert(row);
  if (error) return { error: error.message };

  revalidatePath("/settings/organization/catalogs");
  return { success: true };
}

export async function deleteVetMedicine(id: string): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("org_vet_medicines")
    .delete()
    .eq("id", id)
    .eq("is_seed", false)
    .eq("organization_id", ctx.orgId ?? "");
  if (error) return { error: error.message };
  revalidatePath("/settings/organization/catalogs");
  return { success: true };
}

// -------------------------------------------------------------------
// Reproduction protocols (metadata only — step JSONB editing deferred)
// -------------------------------------------------------------------
const reproSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required.").max(120),
  protocol_type: z.string().min(1, "Type is required.").max(40),
  description: z.string().max(500).nullable().optional(),
});
export type ReproProtocolInput = z.infer<typeof reproSchema>;

export async function upsertReproProtocol(input: ReproProtocolInput): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = reproSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const row = {
    organization_id: ctx.orgId,
    slug: slug(parsed.data.name),
    name: parsed.data.name,
    protocol_type: parsed.data.protocol_type,
    description: parsed.data.description ?? null,
    steps: [],
    is_seed: false,
  };
  const { error } = parsed.data.id
    ? await admin
        .from("org_repro_protocols")
        .update({
          name: row.name,
          slug: row.slug,
          protocol_type: row.protocol_type,
          description: row.description,
        })
        .eq("id", parsed.data.id)
        .eq("is_seed", false)
    : await admin.from("org_repro_protocols").insert(row);
  if (error) return { error: error.message };

  revalidatePath("/settings/organization/catalogs");
  return { success: true };
}

export async function deleteReproProtocol(id: string): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("org_repro_protocols")
    .delete()
    .eq("id", id)
    .eq("is_seed", false)
    .eq("organization_id", ctx.orgId ?? "");
  if (error) return { error: error.message };
  revalidatePath("/settings/organization/catalogs");
  return { success: true };
}

// -------------------------------------------------------------------
// Vaccination protocols
// -------------------------------------------------------------------
const vaxSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required.").max(120),
  target_class: z.enum(["calf", "heifer", "lactating", "dry", "bull"]),
  description: z.string().max(500).nullable().optional(),
});
export type VaxProtocolInput = z.infer<typeof vaxSchema>;

export async function upsertVaccinationProtocol(input: VaxProtocolInput): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = vaxSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const row = {
    organization_id: ctx.orgId,
    slug: slug(parsed.data.name),
    name: parsed.data.name,
    target_class: parsed.data.target_class,
    description: parsed.data.description ?? null,
    schedule: [],
    is_seed: false,
  };
  const { error } = parsed.data.id
    ? await admin
        .from("org_vaccination_protocols")
        .update({
          name: row.name,
          slug: row.slug,
          target_class: row.target_class,
          description: row.description,
        })
        .eq("id", parsed.data.id)
        .eq("is_seed", false)
    : await admin.from("org_vaccination_protocols").insert(row);
  if (error) return { error: error.message };

  revalidatePath("/settings/organization/catalogs");
  return { success: true };
}

export async function deleteVaccinationProtocol(id: string): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("org_vaccination_protocols")
    .delete()
    .eq("id", id)
    .eq("is_seed", false)
    .eq("organization_id", ctx.orgId ?? "");
  if (error) return { error: error.message };
  revalidatePath("/settings/organization/catalogs");
  return { success: true };
}

// -------------------------------------------------------------------
// Treatment protocols
// -------------------------------------------------------------------
const txSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required.").max(120),
  diagnosis_code: z.string().max(40).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});
export type TreatmentProtocolInput = z.infer<typeof txSchema>;

export async function upsertTreatmentProtocol(input: TreatmentProtocolInput): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = txSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const row = {
    organization_id: ctx.orgId,
    slug: slug(parsed.data.name),
    name: parsed.data.name,
    diagnosis_code: parsed.data.diagnosis_code ?? null,
    description: parsed.data.description ?? null,
    steps: [],
    is_seed: false,
  };
  const { error } = parsed.data.id
    ? await admin
        .from("org_treatment_protocols")
        .update({
          name: row.name,
          slug: row.slug,
          diagnosis_code: row.diagnosis_code,
          description: row.description,
        })
        .eq("id", parsed.data.id)
        .eq("is_seed", false)
    : await admin.from("org_treatment_protocols").insert(row);
  if (error) return { error: error.message };

  revalidatePath("/settings/organization/catalogs");
  return { success: true };
}

export async function deleteTreatmentProtocol(id: string): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("org_treatment_protocols")
    .delete()
    .eq("id", id)
    .eq("is_seed", false)
    .eq("organization_id", ctx.orgId ?? "");
  if (error) return { error: error.message };
  revalidatePath("/settings/organization/catalogs");
  return { success: true };
}
