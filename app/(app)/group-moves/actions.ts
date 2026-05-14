"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole } from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";

type Result = { error?: string; success?: boolean; applied?: number };

const acceptSchema = z.object({
  animal_id: z.string().uuid(),
  from_group_id: z.string().uuid().nullable(),
  to_group_id: z.string().uuid(),
  rule_explanation: z.string().max(500).nullable().optional(),
});
export type AcceptInput = z.infer<typeof acceptSchema>;

export async function acceptMove(input: AcceptInput): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error: mvErr } = await admin.from("group_moves").insert({
    animal_id: parsed.data.animal_id,
    occurred_at: now,
    from_group_id: parsed.data.from_group_id,
    to_group_id: parsed.data.to_group_id,
    suggested_group_id: parsed.data.to_group_id,
    decision: "accepted",
    rule_explanation: parsed.data.rule_explanation ?? null,
    operator_user_id: user.id,
  });
  if (mvErr) return { error: mvErr.message };

  const { error: aErr } = await admin
    .from("animals")
    .update({
      current_group_id: parsed.data.to_group_id,
      last_group_decision_at: now,
      last_group_override_reason: null,
    })
    .eq("id", parsed.data.animal_id);
  if (aErr) return { error: aErr.message };

  revalidatePath("/group-moves");
  revalidatePath("/animals");
  return { success: true };
}

const overrideSchema = z.object({
  animal_id: z.string().uuid(),
  current_group_id: z.string().uuid().nullable(),
  suggested_group_id: z.string().uuid(),
  /**
   * Where the cow should actually go. NULL = keep her where she is
   * (classic "override"). Anything else moves her to that group with
   * the override reason recorded on both the move row and the
   * animal's last_group_override_reason.
   */
  target_group_id: z.string().uuid().nullable().optional(),
  reason: z.string().min(1, "Reason required.").max(500),
  rule_explanation: z.string().max(500).nullable().optional(),
});
export type OverrideInput = z.infer<typeof overrideSchema>;

export async function overrideMove(input: OverrideInput): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // target = explicit target if given, else stay in current group
  const targetGroupId =
    parsed.data.target_group_id !== undefined
      ? parsed.data.target_group_id
      : parsed.data.current_group_id;

  const { error: mvErr } = await admin.from("group_moves").insert({
    animal_id: parsed.data.animal_id,
    occurred_at: now,
    from_group_id: parsed.data.current_group_id,
    to_group_id: targetGroupId,
    suggested_group_id: parsed.data.suggested_group_id,
    decision: "overridden",
    reason: parsed.data.reason,
    rule_explanation: parsed.data.rule_explanation ?? null,
    operator_user_id: user.id,
  });
  if (mvErr) return { error: mvErr.message };

  // If the target differs from current, also move the cow.
  const movedTo = targetGroupId !== parsed.data.current_group_id
    ? targetGroupId
    : undefined;
  const animalPatch: Record<string, unknown> = {
    last_group_decision_at: now,
    last_group_override_reason: parsed.data.reason,
  };
  if (movedTo !== undefined) animalPatch.current_group_id = movedTo;

  const { error: aErr } = await admin
    .from("animals")
    .update(animalPatch)
    .eq("id", parsed.data.animal_id);
  if (aErr) return { error: aErr.message };

  revalidatePath("/group-moves");
  revalidatePath("/animals");
  return { success: true };
}

const bulkSchema = z.object({
  moves: z
    .array(
      z.object({
        animal_id: z.string().uuid(),
        from_group_id: z.string().uuid().nullable(),
        to_group_id: z.string().uuid(),
        rule_explanation: z.string().max(500).nullable().optional(),
      }),
    )
    .max(2000),
});
export type BulkInput = z.infer<typeof bulkSchema>;

export async function bulkAccept(input: BulkInput): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (parsed.data.moves.length === 0) return { success: true, applied: 0 };

  const moveRows = parsed.data.moves.map((m) => ({
    animal_id: m.animal_id,
    occurred_at: now,
    from_group_id: m.from_group_id,
    to_group_id: m.to_group_id,
    suggested_group_id: m.to_group_id,
    decision: "accepted" as const,
    rule_explanation: m.rule_explanation ?? null,
    operator_user_id: user.id,
  }));
  const { error: mvErr } = await admin.from("group_moves").insert(moveRows);
  if (mvErr) return { error: mvErr.message };

  // Bulk update animals — one update per row to avoid CASE statements.
  for (const m of parsed.data.moves) {
    await admin
      .from("animals")
      .update({
        current_group_id: m.to_group_id,
        last_group_decision_at: now,
        last_group_override_reason: null,
      })
      .eq("id", m.animal_id);
  }

  revalidatePath("/group-moves");
  revalidatePath("/animals");
  return { success: true, applied: parsed.data.moves.length };
}
