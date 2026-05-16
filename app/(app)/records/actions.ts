"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathRecords } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const animalSchema = z.object({
  naturalKey: z.string().trim().min(1, "Animal ID is required."),
  name: z.string().trim().optional(),
  birthDate: z.string().trim().optional(),
  baseLactation: z.coerce.number().int().min(0).optional(),
});

const eventSchema = z.object({
  subjectId: z.uuid(),
  eventCode: z.coerce.number().int(),
  eventDate: z.string().trim().min(1, "Event date is required."),
  remark: z.string().trim().optional(),
});

export async function createAnimal(
  input: z.infer<typeof animalSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = animalSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { naturalKey, name, birthDate, baseLactation } = parsed.data;

  const attrs: Record<string, unknown> = {};
  if (birthDate) attrs.birth_date = birthDate;
  if (typeof baseLactation === "number") attrs.base_lactation = baseLactation;

  const admin = createAdminClient();
  const { error } = await admin.from("subjects").insert({
    organization_id: orgId,
    subject_type: "animal",
    natural_key: naturalKey,
    name: name || null,
    attrs,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath(PathRecords);
  return { success: true };
}

export async function recordEvent(
  input: z.infer<typeof eventSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = eventSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { subjectId, eventCode, eventDate, remark } = parsed.data;

  const admin = createAdminClient();

  // confirm the subject belongs to this org (no cross-org writes)
  const { data: subj, error: sErr } = await admin
    .from("subjects")
    .select("id")
    .eq("id", subjectId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (sErr) return { error: sErr.message };
  if (!subj) return { error: "Animal not found." };

  const { error } = await admin.from("events").insert({
    organization_id: orgId,
    subject_id: subjectId,
    event_code: eventCode,
    event_date: eventDate,
    remark: remark || null,
    source: "user",
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath(`${PathRecords}/${subjectId}`);
  revalidatePath(PathRecords);
  return { success: true };
}
