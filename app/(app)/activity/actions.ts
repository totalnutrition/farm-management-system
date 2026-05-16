"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathActivity } from "@/lib/misc";
import { FLAG_EC } from "@/lib/derive/flags";

type Result = { error?: string; success?: boolean };

async function resolveAnimal(orgId: string, animalId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subjects")
    .select("id")
    .eq("organization_id", orgId)
    .eq("subject_type", "animal")
    .eq("natural_key", animalId)
    .maybeSingle();
  return data?.id ?? null;
}

const markSchema = z.object({
  animalId: z.string().trim().min(1),
  activity: z.string().trim().min(1),
  note: z.string().trim().optional(),
});

export async function markActivity(
  input: z.infer<typeof markSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const parsed = markSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { animalId, activity, note } = parsed.data;

  const sid = await resolveAnimal(orgId, animalId);
  if (!sid) return { error: `Animal ${animalId} not found.` };

  const admin = createAdminClient();
  const { error } = await admin.from("events").insert({
    organization_id: orgId,
    subject_id: sid,
    event_code: FLAG_EC,
    event_date: new Date().toISOString().slice(0, 10),
    payload: { activity, note: note ?? null },
    source: "user",
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(PathActivity);
  return { success: true };
}

export async function resolveActivity(animalId: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const sid = await resolveAnimal(orgId, animalId);
  if (!sid) return { error: `Animal ${animalId} not found.` };

  const admin = createAdminClient();
  const { error } = await admin.from("events").insert({
    organization_id: orgId,
    subject_id: sid,
    event_code: FLAG_EC,
    event_date: new Date().toISOString().slice(0, 10),
    payload: { cleared: true },
    source: "user",
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(PathActivity);
  return { success: true };
}
