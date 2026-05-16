"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathPens } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

export const PEN_TYPES = [
  "BULL",
  "AI",
  "MILK",
  "DRY",
  "HOSP",
  "CALF",
  "USER",
] as const;

const penSchema = z.object({
  penNo: z.coerce.number().int().min(1).max(9999),
  types: z.array(z.enum(PEN_TYPES)).min(1, "Pick at least one pen type."),
  capacity: z.coerce.number().int().min(1).optional(),
  label: z.string().trim().optional(),
});

export async function createPen(
  input: z.infer<typeof penSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = penSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { penNo, types, capacity, label } = parsed.data;

  if (penNo === 0)
    return { error: "Pen 0 is reserved by DC for transfers." };
  if (types.includes("AI") && types.includes("BULL"))
    return { error: "A pen cannot be both AI and BULL." };

  const admin = createAdminClient();
  const { error } = await admin.from("subjects").insert({
    organization_id: orgId,
    subject_type: "pen",
    natural_key: String(penNo),
    name: label || null,
    attrs: {
      pen_no: penNo,
      pen_type: types,
      capacity: capacity ?? null,
    },
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `Pen ${penNo} already exists.` };
    return { error: error.message };
  }

  revalidatePath(PathPens);
  return { success: true };
}

export async function deletePen(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("subject_type", "pen");
  if (error) return { error: error.message };

  revalidatePath(PathPens);
  return { success: true };
}
