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
  return { orgId, role };
}

// Generic "schedule step" — what every protocol type's schedule is
// made of. We keep the basis enum permissive because each protocol
// type uses different bases (DIM, age, days relative to event).
const stepSchema = z.object({
  basis: z.string().trim().min(1).max(40),
  at: z.union([z.number(), z.string().trim().max(40)]),
  label: z.string().trim().max(120).nullable().optional(),
  drug: z.string().trim().max(120).nullable().optional(),
  dose: z.string().trim().max(80).nullable().optional(),
  route: z.string().trim().max(40).nullable().optional(),
  withdrawal_milk_hours: z.number().nullable().optional(),
  withdrawal_meat_days: z.number().nullable().optional(),
  note: z.string().trim().max(200).nullable().optional(),
});

// ---------------------------------------------------------------------
// Hoof trim
// ---------------------------------------------------------------------
const hoofSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  target_class: z.enum(["lactating", "dry", "heifer", "fresh"]),
  schedule: z.array(stepSchema).default([]),
});
export type HoofTrimInput = z.infer<typeof hoofSchema>;

export async function upsertHoofTrimProtocol(
  input: HoofTrimInput,
): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = hoofSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const row = {
    organization_id: ctx.orgId ?? null,
    slug: slug(parsed.data.name),
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    target_class: parsed.data.target_class,
    schedule: parsed.data.schedule,
  };
  if (parsed.data.id) {
    const { error } = await admin
      .from("org_hoof_trim_protocols")
      .update(row)
      .eq("id", parsed.data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await admin
      .from("org_hoof_trim_protocols")
      .insert(row);
    if (error) return { error: error.message };
  }
  revalidatePath("/settings/organization/protocols");
  return { success: true };
}

export async function deleteHoofTrimProtocol(id: string): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("org_hoof_trim_protocols")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings/organization/protocols");
  return { success: true };
}

// ---------------------------------------------------------------------
// Deworming
// ---------------------------------------------------------------------
const dewormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  target_class: z.enum(["lactating", "dry", "heifer", "calf"]),
  schedule: z.array(stepSchema).default([]),
});
export type DewormingInput = z.infer<typeof dewormSchema>;

export async function upsertDewormingProtocol(
  input: DewormingInput,
): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = dewormSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const row = {
    organization_id: ctx.orgId ?? null,
    slug: slug(parsed.data.name),
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    target_class: parsed.data.target_class,
    schedule: parsed.data.schedule,
  };
  if (parsed.data.id) {
    const { error } = await admin
      .from("org_deworming_protocols")
      .update(row)
      .eq("id", parsed.data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await admin
      .from("org_deworming_protocols")
      .insert(row);
    if (error) return { error: error.message };
  }
  revalidatePath("/settings/organization/protocols");
  return { success: true };
}

export async function deleteDewormingProtocol(id: string): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("org_deworming_protocols")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings/organization/protocols");
  return { success: true };
}

// ---------------------------------------------------------------------
// Dry-off
// ---------------------------------------------------------------------
const dryOffSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  approach_days: z.number().int().min(0).max(120).default(60),
  treatment: z.record(z.string(), z.unknown()).default({}),
});
export type DryOffInput = z.infer<typeof dryOffSchema>;

export async function upsertDryOffProtocol(
  input: DryOffInput,
): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = dryOffSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const row = {
    organization_id: ctx.orgId ?? null,
    slug: slug(parsed.data.name),
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    approach_days: parsed.data.approach_days,
    treatment: parsed.data.treatment,
  };
  if (parsed.data.id) {
    const { error } = await admin
      .from("org_dry_off_protocols")
      .update(row)
      .eq("id", parsed.data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await admin.from("org_dry_off_protocols").insert(row);
    if (error) return { error: error.message };
  }
  revalidatePath("/settings/organization/protocols");
  return { success: true };
}

export async function deleteDryOffProtocol(id: string): Promise<Result> {
  const ctx = await requireOrgEditor();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("org_dry_off_protocols")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings/organization/protocols");
  return { success: true };
}
