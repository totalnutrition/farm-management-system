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
import { KPI_KEYS, type KpiKey } from "@/lib/playbook";

type Result = { error?: string; success?: boolean };

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

const PROTOCOL_KINDS = [
  "repro",
  "vaccination",
  "treatment",
  "hoof_trim",
  "deworming",
  "dry_off",
] as const;
type ProtocolKind = (typeof PROTOCOL_KINDS)[number];

const PROTOCOL_COLUMN: Record<ProtocolKind, string> = {
  repro: "repro_protocol_id",
  vaccination: "vaccination_protocol_id",
  treatment: "treatment_protocol_id",
  hoof_trim: "hoof_trim_protocol_id",
  deworming: "deworming_protocol_id",
  dry_off: "dry_off_protocol_id",
};

const selectionSchema = z.object({
  location_id: z.string().uuid(),
  kind: z.enum(PROTOCOL_KINDS),
  protocol_id: z.string().uuid().nullable(),
});

export async function setActiveProtocol(
  input: z.infer<typeof selectionSchema>,
): Promise<Result> {
  const parsed = selectionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };
  const ctx = await authorize(parsed.data.location_id);
  if ("error" in ctx) return { error: ctx.error };

  const col = PROTOCOL_COLUMN[parsed.data.kind];
  const update: Record<string, unknown> = { [col]: parsed.data.protocol_id };

  // Upsert: ensure a row exists for this location, then update the column.
  const { error } = await ctx.admin
    .from("location_playbook")
    .upsert(
      { location_id: parsed.data.location_id, ...update },
      { onConflict: "location_id" },
    );
  if (error) return { error: error.message };

  revalidatePath(`/settings/locations/${parsed.data.location_id}/playbook`);
  revalidatePath("/hot-list");
  return { success: true };
}

const kpiSchema = z.object({
  location_id: z.string().uuid(),
  overrides: z.record(z.string(), z.number().or(z.null())),
});

export async function setKpiOverrides(
  input: z.infer<typeof kpiSchema>,
): Promise<Result> {
  const parsed = kpiSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };
  const ctx = await authorize(parsed.data.location_id);
  if ("error" in ctx) return { error: ctx.error };

  // Filter to known keys + drop nulls (they fall back to defaults).
  const known = new Set<string>(Object.values(KPI_KEYS));
  const cleaned: Record<string, number> = {};
  for (const [k, v] of Object.entries(parsed.data.overrides)) {
    if (!known.has(k)) continue;
    if (v === null || v === undefined) continue;
    cleaned[k as KpiKey] = v;
  }

  const { error } = await ctx.admin
    .from("location_playbook")
    .upsert(
      {
        location_id: parsed.data.location_id,
        kpi_overrides: cleaned,
      },
      { onConflict: "location_id" },
    );
  if (error) return { error: error.message };

  revalidatePath(`/settings/locations/${parsed.data.location_id}/playbook`);
  revalidatePath("/hot-list");
  return { success: true };
}

const notesSchema = z.object({
  location_id: z.string().uuid(),
  notes: z.string().max(2000).nullable(),
});

export async function setPlaybookNotes(
  input: z.infer<typeof notesSchema>,
): Promise<Result> {
  const parsed = notesSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };
  const ctx = await authorize(parsed.data.location_id);
  if ("error" in ctx) return { error: ctx.error };

  const { error } = await ctx.admin
    .from("location_playbook")
    .upsert(
      {
        location_id: parsed.data.location_id,
        notes: parsed.data.notes || null,
      },
      { onConflict: "location_id" },
    );
  if (error) return { error: error.message };

  revalidatePath(`/settings/locations/${parsed.data.location_id}/playbook`);
  return { success: true };
}
