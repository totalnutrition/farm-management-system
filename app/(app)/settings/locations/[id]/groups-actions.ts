"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";
import {
  HerdProfileDefaults,
  type HerdProfile,
  type LocationGroup,
} from "@/lib/herd-profile";

type Result = { error?: string; success?: boolean };

const herdSchema = z.object({
  location_id: z.uuid(),
  target_lactating_count: z.number().int().min(0).max(1_000_000),
  target_dry_count: z.number().int().min(0).max(1_000_000),
  target_heifer_count: z.number().int().min(0).max(1_000_000),
  target_calf_count: z.number().int().min(0).max(1_000_000),
  pct_primiparous: z.number().min(0).max(100),
  calving_interval_days: z.number().int().min(250).max(700),
  replacement_rate_pct: z.number().min(0).max(100),
  target_rolling_herd_avg_kg_yr: z.number().int().min(0).max(50_000).nullable(),
  notes: z.string().trim().optional().default(""),
});

async function authorizeForLocation(locationId: string) {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);
  const admin = createAdminClient();
  const { data } = await admin
    .from("locations")
    .select("id, organization_id, setup_step, manages_livestock")
    .eq("id", locationId)
    .single();
  if (!data) return { error: "Location not found." as const };
  if (role !== RoleSuperAdmin && data.organization_id !== orgId) {
    return { error: "Cross-org access denied." as const };
  }
  return { admin, location: data };
}

export async function getHerdProfile(
  locationId: string,
): Promise<HerdProfile> {
  const authz = await authorizeForLocation(locationId);
  if ("error" in authz) return HerdProfileDefaults;
  const { data } = await authz.admin
    .from("herd_profile")
    .select(
      "target_lactating_count, target_dry_count, target_heifer_count, target_calf_count, pct_primiparous, calving_interval_days, replacement_rate_pct, target_rolling_herd_avg_kg_yr, notes",
    )
    .eq("location_id", locationId)
    .maybeSingle();
  if (!data) return HerdProfileDefaults;
  return {
    target_lactating_count: data.target_lactating_count as number,
    target_dry_count: data.target_dry_count as number,
    target_heifer_count: data.target_heifer_count as number,
    target_calf_count: data.target_calf_count as number,
    pct_primiparous: Number(data.pct_primiparous),
    calving_interval_days: data.calving_interval_days as number,
    replacement_rate_pct: Number(data.replacement_rate_pct),
    target_rolling_herd_avg_kg_yr:
      (data.target_rolling_herd_avg_kg_yr as number | null) ?? null,
    notes: (data.notes as string | null) ?? null,
  };
}

export async function upsertHerdProfile(
  input: z.infer<typeof herdSchema>,
): Promise<Result> {
  const parsed = herdSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const authz = await authorizeForLocation(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin
    .from("herd_profile")
    .upsert(
      {
        location_id: parsed.data.location_id,
        target_lactating_count: parsed.data.target_lactating_count,
        target_dry_count: parsed.data.target_dry_count,
        target_heifer_count: parsed.data.target_heifer_count,
        target_calf_count: parsed.data.target_calf_count,
        pct_primiparous: parsed.data.pct_primiparous,
        calving_interval_days: parsed.data.calving_interval_days,
        replacement_rate_pct: parsed.data.replacement_rate_pct,
        target_rolling_herd_avg_kg_yr: parsed.data.target_rolling_herd_avg_kg_yr,
        notes: parsed.data.notes || null,
      },
      { onConflict: "location_id" },
    );
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/groups`);
  revalidatePath(`/settings/locations/${parsed.data.location_id}/setup/herd_profile`);
  return { success: true };
}

export async function upsertHerdProfileAndAdvance(
  input: z.infer<typeof herdSchema> & { nextStep: string },
): Promise<void> {
  const { nextStep, ...rest } = input;
  const result = await upsertHerdProfile(rest);
  if (result.error) throw new Error(result.error);
  const authz = await authorizeForLocation(rest.location_id);
  if ("error" in authz) return;
  await authz.admin
    .from("locations")
    .update({
      setup_step: nextStep,
      setup_completed_at: nextStep === "done" ? new Date().toISOString() : null,
    })
    .eq("id", rest.location_id);
  if (nextStep === "done") redirect(`/settings/locations/${rest.location_id}`);
  redirect(`/settings/locations/${rest.location_id}/setup/${nextStep}`);
}

export async function getGroups(locationId: string): Promise<LocationGroup[]> {
  const authz = await authorizeForLocation(locationId);
  if ("error" in authz) return [];
  const { data } = await authz.admin
    .from("location_groups")
    .select(
      "id, location_id, preset_slug, group_slug, label, group_class, display_order, rule_predicates, is_custom",
    )
    .eq("location_id", locationId)
    .order("display_order");
  return (data ?? []).map((g) => ({
    id: g.id as string,
    location_id: g.location_id as string,
    preset_slug: (g.preset_slug as string | null) ?? null,
    group_slug: g.group_slug as string,
    label: g.label as string,
    group_class: g.group_class as string,
    display_order: g.display_order as number,
    rule_predicates: (g.rule_predicates as Record<string, unknown>) ?? {},
    is_custom: g.is_custom as boolean,
  }));
}

export async function applyGroupStrategy(input: {
  location_id: string;
  preset_slug: string;
}): Promise<Result> {
  const parsed = z
    .object({ location_id: z.uuid(), preset_slug: z.string().min(1) })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };
  const authz = await authorizeForLocation(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };

  // Resolve the preset (org-scoped first, then global seed).
  const { data: presetMatches } = await authz.admin
    .from("org_group_strategy_presets")
    .select("id, slug, organization_id")
    .eq("slug", parsed.data.preset_slug);
  if (!presetMatches || presetMatches.length === 0) {
    return { error: "Preset not found." };
  }
  const preset =
    presetMatches.find((p) => p.organization_id !== null) ??
    presetMatches.find((p) => p.organization_id === null);
  if (!preset) return { error: "Preset not visible to this organization." };

  // Load the preset's group rows.
  const { data: presetGroups } = await authz.admin
    .from("org_group_strategy_preset_groups")
    .select("group_slug, group_label, group_class, display_order, rule_predicates")
    .eq("preset_id", preset.id)
    .order("display_order");

  // Wipe existing non-custom groups for this location.
  await authz.admin
    .from("location_groups")
    .delete()
    .eq("location_id", parsed.data.location_id)
    .eq("is_custom", false);

  if ((presetGroups ?? []).length > 0) {
    const rows = (presetGroups ?? []).map((g) => ({
      location_id: parsed.data.location_id,
      preset_slug: parsed.data.preset_slug,
      group_slug: g.group_slug as string,
      label: g.group_label as string,
      group_class: g.group_class as string,
      display_order: g.display_order as number,
      rule_predicates: g.rule_predicates as Record<string, unknown>,
      is_custom: false,
    }));
    const { error } = await authz.admin
      .from("location_groups")
      .upsert(rows, { onConflict: "location_id,group_slug" });
    if (error) return { error: error.message };
  }

  revalidatePath(`/settings/locations/${parsed.data.location_id}/groups`);
  revalidatePath(`/settings/locations/${parsed.data.location_id}/setup/group_strategy`);
  return { success: true };
}

export async function applyGroupStrategyAndAdvance(input: {
  location_id: string;
  preset_slug: string;
  nextStep: string;
}): Promise<void> {
  const result = await applyGroupStrategy({
    location_id: input.location_id,
    preset_slug: input.preset_slug,
  });
  if (result.error) throw new Error(result.error);
  const authz = await authorizeForLocation(input.location_id);
  if ("error" in authz) return;
  await authz.admin
    .from("locations")
    .update({
      setup_step: input.nextStep,
      setup_completed_at:
        input.nextStep === "done" ? new Date().toISOString() : null,
    })
    .eq("id", input.location_id);
  if (input.nextStep === "done") {
    redirect(`/settings/locations/${input.location_id}`);
  }
  redirect(
    `/settings/locations/${input.location_id}/setup/${input.nextStep}`,
  );
}

export async function updateGroupRules(input: {
  group_id: string;
  rule_predicates: Record<string, unknown>;
}): Promise<Result> {
  const parsed = z
    .object({
      group_id: z.uuid(),
      rule_predicates: z.record(z.string(), z.unknown()),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const orgId = getOrganizationIdFromUser(user);
  const role = getRoleFromUser(user);
  const admin = createAdminClient();

  const { data: group } = await admin
    .from("location_groups")
    .select("id, location_id, locations:locations!inner(organization_id)")
    .eq("id", parsed.data.group_id)
    .single();
  if (!group) return { error: "Group not found." };
  const locOrg = (group.locations as unknown as { organization_id: string })
    ?.organization_id;
  if (role !== RoleSuperAdmin && locOrg !== orgId) {
    return { error: "Cross-org access denied." };
  }

  const { error } = await admin
    .from("location_groups")
    .update({ rule_predicates: parsed.data.rule_predicates })
    .eq("id", parsed.data.group_id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${group.location_id}/groups`);
  return { success: true };
}
