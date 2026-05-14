"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole } from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";

type Result = { error?: string; success?: boolean; applied?: number };

const moveSchema = z.object({
  animal_id: z.string().uuid(),
  from_pen_id: z.string().uuid().nullable(),
  to_pen_id: z.string().uuid(),
  reason: z.string().max(500).nullable().optional(),
});
export type MoveInput = z.infer<typeof moveSchema>;

export async function applyPenMove(input: MoveInput): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  if (parsed.data.from_pen_id === parsed.data.to_pen_id) return { success: true };

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { error: mvErr } = await admin.from("pen_moves").insert({
    animal_id: parsed.data.animal_id,
    move_date: today,
    from_pen_id: parsed.data.from_pen_id,
    to_pen_id: parsed.data.to_pen_id,
    reason: parsed.data.reason ?? null,
  });
  if (mvErr) return { error: mvErr.message };

  const { error: aErr } = await admin
    .from("animals")
    .update({ current_pen_id: parsed.data.to_pen_id })
    .eq("id", parsed.data.animal_id);
  if (aErr) return { error: aErr.message };

  revalidatePath("/pen-moves");
  revalidatePath("/animals");
  return { success: true };
}

const bulkSchema = z.object({
  moves: z
    .array(
      z.object({
        animal_id: z.string().uuid(),
        from_pen_id: z.string().uuid().nullable(),
        to_pen_id: z.string().uuid(),
        reason: z.string().max(500).nullable().optional(),
      }),
    )
    .max(2000),
});
export type BulkInput = z.infer<typeof bulkSchema>;

export async function bulkApplyPenMoves(input: BulkInput): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const real = parsed.data.moves.filter((m) => m.from_pen_id !== m.to_pen_id);
  if (real.length === 0) return { success: true, applied: 0 };

  const moveRows = real.map((m) => ({
    animal_id: m.animal_id,
    move_date: today,
    from_pen_id: m.from_pen_id,
    to_pen_id: m.to_pen_id,
    reason: m.reason ?? null,
  }));
  const { error: mvErr } = await admin.from("pen_moves").insert(moveRows);
  if (mvErr) return { error: mvErr.message };

  for (const m of real) {
    await admin
      .from("animals")
      .update({ current_pen_id: m.to_pen_id })
      .eq("id", m.animal_id);
  }

  revalidatePath("/pen-moves");
  revalidatePath("/animals");
  return { success: true, applied: real.length };
}
