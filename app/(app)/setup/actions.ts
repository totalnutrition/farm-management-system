"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { PathSetup } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const schema = z.object({
  voluntary_wait_days: z.coerce.number().int().min(0).max(200),
  gestation_days: z.coerce.number().int().min(200).max(320),
  preg_check_days: z.coerce.number().int().min(20).max(120),
  dry_off_days_before: z.coerce.number().int().min(20).max(120),
  kpi_repro_pr_target: z.coerce.number().min(0).max(100),
  kpi_max_days_open: z.coerce.number().int().min(40).max(400),
  kpi_max_dim_open: z.coerce.number().int().min(40).max(500),
});

// Doctrine #6: configuration is small and one-time, scoped to the farm.
export async function saveHerdSettings(
  input: z.infer<typeof schema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) {
    return { error: "Your account is not linked to an organization." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("herd_settings")
    .upsert(
      { organization_id: orgId, ...parsed.data },
      { onConflict: "organization_id" },
    );
  if (error) return { error: error.message };

  revalidatePath(PathSetup);
  return { success: true };
}
