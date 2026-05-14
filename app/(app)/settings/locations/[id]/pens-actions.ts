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
import { PenTypes, type Pen } from "@/lib/pens";

type Result = { error?: string; success?: boolean };

const baseSchema = z.object({
  location_id: z.uuid(),
  barn_id: z.uuid().nullable(),
  group_id: z.uuid().nullable(),
  name: z.string().trim().min(1, "Name is required."),
  pen_code: z.string().trim().nullable(),
  type: z.enum(PenTypes.map((p) => p.value) as [string, ...string[]]),
  capacity_head: z.number().int().min(0).max(1_000_000).nullable(),
  bunk_running_ft: z.number().min(0).max(10_000).nullable(),
  stocking_target_pct: z.number().min(0).max(300).nullable(),
  is_AI_pen: z.boolean(),
  is_BULL_pen: z.boolean(),
  is_DRY_pen: z.boolean(),
  is_HOSP_pen: z.boolean(),
  is_FRESH_pen: z.boolean(),
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

export async function listPens(locationId: string): Promise<Pen[]> {
  const authz = await authorize(locationId);
  if ("error" in authz) return [];
  const { data } = await authz.admin
    .from("pens")
    .select(
      "id, location_id, barn_id, group_id, name, pen_code, type, capacity_head, bunk_running_ft, stocking_target_pct, is_AI_pen, is_BULL_pen, is_DRY_pen, is_HOSP_pen, is_FRESH_pen, is_placeholder, notes",
    )
    .eq("location_id", locationId)
    .order("name");
  return (data ?? []) as Pen[];
}

function validate(input: z.infer<typeof baseSchema>): string | null {
  if (input.is_AI_pen && input.is_BULL_pen) {
    return "AI and Bull pens are mutually exclusive.";
  }
  return null;
}

export async function createPen(input: z.infer<typeof baseSchema>): Promise<Result> {
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const err = validate(parsed.data);
  if (err) return { error: err };
  const authz = await authorize(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin.from("pens").insert({
    ...parsed.data,
    pen_code: parsed.data.pen_code || null,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/infrastructure`);
  return { success: true };
}

export async function updatePen(input: z.infer<typeof updateSchema>): Promise<Result> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const err = validate(parsed.data);
  if (err) return { error: err };
  const authz = await authorize(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { id, ...rest } = parsed.data;
  const { error } = await authz.admin
    .from("pens")
    .update({
      ...rest,
      pen_code: rest.pen_code || null,
      notes: rest.notes || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/infrastructure`);
  return { success: true };
}

export async function deletePen(input: {
  id: string;
  location_id: string;
}): Promise<Result> {
  const authz = await authorize(input.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin.from("pens").delete().eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${input.location_id}/infrastructure`);
  return { success: true };
}
