"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathProtocols } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const stepSchema = z.object({
  dayOffset: z.coerce.number().int(),
  label: z.string().trim().min(1),
  eventCode: z.coerce.number().int().optional(),
});

const protocolSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  enroll: z.array(z.array(z.any())).min(1, "Add an enrollment condition."),
  anchor: z.string().trim().min(1),
  steps: z.array(stepSchema).min(1, "Add at least one step."),
});

export async function addProtocol(
  input: z.infer<typeof protocolSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = protocolSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const v = parsed.data;

  const admin = createAdminClient();
  const { data: last } = await admin
    .from("protocols")
    .select("ordinal")
    .eq("organization_id", orgId)
    .order("ordinal", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await admin.from("protocols").insert({
    organization_id: orgId,
    ordinal: (last?.ordinal ?? 0) + 1,
    name: v.name,
    enroll: v.enroll,
    anchor: v.anchor,
    steps: v.steps,
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `A protocol named “${v.name}” already exists.` };
    return { error: error.message };
  }

  revalidatePath(PathProtocols);
  return { success: true };
}

export async function deleteProtocol(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("protocols")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };

  revalidatePath(PathProtocols);
  return { success: true };
}

const stepDoneSchema = z.object({
  subjectId: z.uuid(),
  eventCode: z.coerce.number().int(),
});

export async function doProtocolStep(
  input: z.infer<typeof stepDoneSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = stepDoneSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { subjectId, eventCode } = parsed.data;

  const admin = createAdminClient();
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
    event_date: new Date().toISOString().slice(0, 10),
    source: "user",
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath(PathProtocols);
  return { success: true };
}
