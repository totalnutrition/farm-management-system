"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
  requireRole,
} from "@/lib/supabase-auth";
import { PathSettingsOrganization, RoleSuperAdmin } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const baseSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  address: z.string().trim(),
  default_currency: z
    .string()
    .trim()
    .min(3, "Currency must be a 3-letter code.")
    .max(8, "Currency code is too long.")
    .default("PKR"),
  default_units: z.enum(["metric", "imperial"]).default("metric"),
  default_timezone: z
    .string()
    .trim()
    .min(1, "Timezone is required.")
    .default("Asia/Karachi"),
  default_land_area_unit: z
    .enum([
      "hectare",
      "acre",
      "square_meter",
      "square_foot",
      "marla",
      "kanal",
      "murabba",
    ])
    .default("acre"),
});

const updateSchema = baseSchema.extend({
  id: z.uuid(),
});

function toRow(input: z.infer<typeof baseSchema>) {
  return {
    name: input.name,
    address: input.address || null,
    default_currency: input.default_currency.toUpperCase(),
    default_units: input.default_units,
    default_timezone: input.default_timezone,
    default_land_area_unit: input.default_land_area_unit,
  };
}

export async function createOrganization(
  input: z.infer<typeof baseSchema>,
): Promise<Result> {
  await requireRole(RoleSuperAdmin as "super_admin");

  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .insert(toRow(parsed.data));
  if (error) return { error: error.message };

  revalidatePath(PathSettingsOrganization);
  return { success: true };
}

export async function updateOrganization(
  input: z.infer<typeof updateSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { id } = parsed.data;

  if (getRoleFromUser(user) !== RoleSuperAdmin) {
    if (getOrganizationIdFromUser(user) !== id) {
      return { error: "You can only update your own organization." };
    }
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update(toRow(parsed.data))
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(PathSettingsOrganization);
  return { success: true };
}

export async function deleteOrganization(id: string): Promise<Result> {
  await requireRole(RoleSuperAdmin as "super_admin");

  const admin = createAdminClient();

  const { count, error: countErr } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", id);
  if (countErr) return { error: countErr.message };
  if ((count ?? 0) > 0) {
    return {
      error:
        "Cannot delete: this organization still has users. Delete or reassign them first.",
    };
  }

  const { error } = await admin.from("organizations").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(PathSettingsOrganization);
  return { success: true };
}
