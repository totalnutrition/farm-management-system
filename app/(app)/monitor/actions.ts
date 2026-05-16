"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathMonitor } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const kpiSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required."),
    filter: z.array(z.array(z.any())).optional(),
    metricKind: z.enum(["count", "avg"]),
    metricItem: z.string().trim().optional(),
    goal: z.coerce.number(),
    direction: z.enum(["higher_better", "lower_better"]),
    warnPct: z.coerce.number().min(0).optional(),
    alertPct: z.coerce.number().min(0).optional(),
  })
  .refine((v) => v.metricKind !== "avg" || !!v.metricItem, {
    message: "Pick an item to average.",
  });

export async function addKpi(
  input: z.infer<typeof kpiSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = kpiSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const v = parsed.data;

  const admin = createAdminClient();
  const { data: last } = await admin
    .from("monitor_kpis")
    .select("ordinal")
    .eq("organization_id", orgId)
    .order("ordinal", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await admin.from("monitor_kpis").insert({
    organization_id: orgId,
    ordinal: (last?.ordinal ?? 0) + 1,
    name: v.name,
    filter: v.filter && v.filter.length ? v.filter : null,
    metric:
      v.metricKind === "avg"
        ? { kind: "avg", item: v.metricItem }
        : { kind: "count" },
    goal: v.goal,
    direction: v.direction,
    warn_pct: v.warnPct ?? 5,
    alert_pct: v.alertPct ?? 15,
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `A KPI named “${v.name}” already exists.` };
    return { error: error.message };
  }

  revalidatePath(PathMonitor);
  return { success: true };
}

export async function deleteKpi(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("monitor_kpis")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };

  revalidatePath(PathMonitor);
  return { success: true };
}
