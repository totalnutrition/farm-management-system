"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathFeed } from "@/lib/misc";
import { FEED_EC } from "@/lib/derive/feed";

type Result = { error?: string; success?: boolean };

const rationSchema = z.object({
  name: z.string().trim().min(1, "Ration name is required."),
  costPerKg: z.coerce.number().min(0),
});

export async function createRation(
  input: z.infer<typeof rationSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = rationSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { name, costPerKg } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.from("subjects").insert({
    organization_id: orgId,
    subject_type: "ration",
    natural_key: name,
    attrs: { cost_per_kg: costPerKg },
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `Ration “${name}” already exists.` };
    return { error: error.message };
  }
  revalidatePath(PathFeed);
  return { success: true };
}

export async function deleteRation(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("subject_type", "ration");
  if (error) return { error: error.message };
  revalidatePath(PathFeed);
  return { success: true };
}

const feedSchema = z.object({
  penNo: z.string().trim().min(1, "Pen is required."),
  ration: z.string().trim().min(1, "Ration is required."),
  kg: z.coerce.number().positive(),
  refusedKg: z.coerce.number().min(0).optional(),
  date: z.string().trim().min(1),
});

export async function recordFeeding(
  input: z.infer<typeof feedSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = feedSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { penNo, ration, kg, refusedKg, date } = parsed.data;

  const admin = createAdminClient();
  const { data: pen } = await admin
    .from("subjects")
    .select("id")
    .eq("organization_id", orgId)
    .eq("subject_type", "pen")
    .eq("natural_key", penNo)
    .maybeSingle();
  if (!pen) return { error: `Pen ${penNo} not found. Add it in Pens.` };

  const { data: rn } = await admin
    .from("subjects")
    .select("attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "ration")
    .eq("natural_key", ration)
    .maybeSingle();
  if (!rn) return { error: `Ration “${ration}” not found.` };
  const costPerKg =
    typeof (rn.attrs as Record<string, unknown>)?.cost_per_kg === "number"
      ? ((rn.attrs as Record<string, unknown>).cost_per_kg as number)
      : 0;

  const { error } = await admin.from("events").insert({
    organization_id: orgId,
    subject_id: pen.id,
    event_code: FEED_EC,
    event_date: date,
    payload: {
      ration,
      kg,
      refused: refusedKg ?? 0,
      cost: Math.round(kg * costPerKg * 100) / 100,
    },
    source: "user",
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(PathFeed);
  return { success: true };
}
