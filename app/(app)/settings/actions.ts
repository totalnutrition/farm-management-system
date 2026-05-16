"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathSettings } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const schema = z.object({
  unitSystem: z.enum(["metric", "imperial"]),
  country: z.string().trim().min(1).max(3),
  params: z.record(z.string(), z.number()),
});

export async function saveSettings(
  input: z.infer<typeof schema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { unitSystem, country, params } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.from("org_settings").upsert(
    {
      organization_id: orgId,
      unit_system: unitSystem,
      country: country.toUpperCase(),
      params,
    },
    { onConflict: "organization_id" },
  );
  if (error) return { error: error.message };

  revalidatePath(PathSettings);
  return { success: true };
}
