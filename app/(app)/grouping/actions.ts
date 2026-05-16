"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathGrouping } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const ruleSchema = z
  .object({
    name: z.string().trim().min(1, "Rule name is required."),
    predicate: z.array(z.array(z.any())).min(1, "Add at least one condition."),
    targetPen: z.string().trim().optional(),
    splitFirst: z.string().trim().optional(),
    splitMature: z.string().trim().optional(),
  })
  .refine(
    (v) =>
      (v.targetPen && v.targetPen.length > 0) ||
      (v.splitFirst && v.splitMature),
    { message: "Choose a target pen, or both parity-split pens." },
  );

export async function addRule(
  input: z.infer<typeof ruleSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { name, predicate, targetPen, splitFirst, splitMature } =
    parsed.data;

  const split =
    splitFirst && splitMature
      ? { firstLactation: splitFirst, mature: splitMature }
      : null;

  const admin = createAdminClient();
  const { data: last } = await admin
    .from("grouping_rules")
    .select("ordinal")
    .eq("organization_id", orgId)
    .order("ordinal", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordinal = (last?.ordinal ?? 0) + 1;

  const { error } = await admin.from("grouping_rules").insert({
    organization_id: orgId,
    ordinal,
    name,
    predicate,
    target_pen: split ? null : (targetPen as string),
    split,
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `A rule named “${name}” already exists.` };
    return { error: error.message };
  }

  revalidatePath(PathGrouping);
  return { success: true };
}

export async function deleteRule(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("grouping_rules")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };

  revalidatePath(PathGrouping);
  return { success: true };
}

const moveSchema = z.object({
  subjectId: z.uuid(),
  toPen: z.string().trim().min(1),
});

export async function moveAnimal(
  input: z.infer<typeof moveSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = moveSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { subjectId, toPen } = parsed.data;

  const admin = createAdminClient();
  const { data: subj, error: sErr } = await admin
    .from("subjects")
    .select("attrs")
    .eq("id", subjectId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (sErr) return { error: sErr.message };
  if (!subj) return { error: "Animal not found." };

  const attrs = {
    ...((subj.attrs ?? {}) as Record<string, unknown>),
    pen: toPen,
  };
  const { error } = await admin
    .from("subjects")
    .update({ attrs })
    .eq("id", subjectId)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };

  revalidatePath(PathGrouping);
  return { success: true };
}
