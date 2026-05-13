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
import {
  CapacityDefaultsFallback,
  type CapacityDefaults,
} from "@/lib/capacity-defaults";

type Result = { error?: string; success?: boolean };

const numericField = (label: string, min: number, max: number) =>
  z
    .number({ message: `${label} must be a number.` })
    .min(min, `${label} must be ≥ ${min}.`)
    .max(max, `${label} must be ≤ ${max}.`);

const schema = z.object({
  fresh_stocking_pct: numericField("Fresh stocking", 50, 200),
  high_stocking_pct: numericField("High stocking", 50, 200),
  mid_stocking_pct: numericField("Mid stocking", 50, 200),
  low_stocking_pct: numericField("Low stocking", 50, 200),
  dry_close_stocking_pct: numericField("Close-up stocking", 50, 200),
  dry_far_stocking_pct: numericField("Far-off stocking", 50, 200),
  fresh_bunk_in: numericField("Fresh bunk", 12, 48),
  high_bunk_in: numericField("High bunk", 12, 48),
  mid_bunk_in: numericField("Mid bunk", 12, 48),
  low_bunk_in: numericField("Low bunk", 12, 48),
  dry_close_bunk_in: numericField("Close-up bunk", 12, 48),
  dry_far_bunk_in: numericField("Far-off bunk", 12, 48),
});

export async function getCapacityDefaultsForOrg(): Promise<CapacityDefaults> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return CapacityDefaultsFallback;

  const admin = createAdminClient();
  const { data } = await admin
    .from("org_capacity_defaults")
    .select(
      "fresh_stocking_pct, high_stocking_pct, mid_stocking_pct, low_stocking_pct, dry_close_stocking_pct, dry_far_stocking_pct, fresh_bunk_in, high_bunk_in, mid_bunk_in, low_bunk_in, dry_close_bunk_in, dry_far_bunk_in",
    )
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!data) return CapacityDefaultsFallback;
  return {
    fresh_stocking_pct: Number(data.fresh_stocking_pct),
    high_stocking_pct: Number(data.high_stocking_pct),
    mid_stocking_pct: Number(data.mid_stocking_pct),
    low_stocking_pct: Number(data.low_stocking_pct),
    dry_close_stocking_pct: Number(data.dry_close_stocking_pct),
    dry_far_stocking_pct: Number(data.dry_far_stocking_pct),
    fresh_bunk_in: Number(data.fresh_bunk_in),
    high_bunk_in: Number(data.high_bunk_in),
    mid_bunk_in: Number(data.mid_bunk_in),
    low_bunk_in: Number(data.low_bunk_in),
    dry_close_bunk_in: Number(data.dry_close_bunk_in),
    dry_far_bunk_in: Number(data.dry_far_bunk_in),
  };
}

export async function updateCapacityDefaults(
  input: CapacityDefaults,
): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  if (role !== RoleSuperAdmin && !orgId) {
    return { error: "Your account is not linked to an organization." };
  }
  if (!orgId) {
    return { error: "Capacity defaults are per-organization. Select an org first." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("org_capacity_defaults")
    .upsert(
      { organization_id: orgId, ...parsed.data },
      { onConflict: "organization_id" },
    );
  if (error) return { error: error.message };

  revalidatePath("/settings/organization/presets");
  return { success: true };
}
