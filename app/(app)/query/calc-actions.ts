"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  requireAnyRole,
  requireUser,
  getOrganizationIdFromUser,
} from "@/lib/supabase-auth";
import { PathQuery } from "@/lib/misc";
import { validateCalcField, type CalcFieldRow } from "@/lib/calc-fields";

type Result = { error?: string; success?: boolean };

const schema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  expression: z.string().trim().min(1),
  kind: z.enum(["num", "flag", "text"]),
});

export async function listCalcFields(): Promise<CalcFieldRow[]> {
  const user = await requireUser();
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("calculated_fields")
    .select("id, key, label, expression, kind")
    .eq("organization_id", orgId)
    .order("label");
  return (data ?? []) as CalcFieldRow[];
}

export async function saveCalcField(
  input: z.infer<typeof schema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { id, key, label, expression, kind } = parsed.data;
  const KEY = key.toUpperCase();

  const admin = createAdminClient();
  const { data: all } = await admin
    .from("calculated_fields")
    .select("id, key, label, expression, kind")
    .eq("organization_id", orgId);
  const rows = (all ?? []) as CalcFieldRow[];

  const invalid = validateCalcField(
    { key: KEY, label, expression },
    rows.filter((r) => r.id !== id),
  );
  if (invalid) return { error: invalid };

  if (id) {
    const { error } = await admin
      .from("calculated_fields")
      .update({ key: KEY, label, expression, kind })
      .eq("id", id)
      .eq("organization_id", orgId);
    if (error)
      return {
        error:
          error.code === "23505"
            ? `A field with key “${KEY}” already exists.`
            : error.message,
      };
  } else {
    const { error } = await admin.from("calculated_fields").insert({
      organization_id: orgId,
      key: KEY,
      label,
      expression,
      kind,
      created_by: user.id,
    });
    if (error)
      return {
        error:
          error.code === "23505"
            ? `A field with key “${KEY}” already exists.`
            : error.message,
      };
  }

  revalidatePath(PathQuery);
  return { success: true };
}

export async function deleteCalcField(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("calculated_fields")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };
  revalidatePath(PathQuery);
  return { success: true };
}
