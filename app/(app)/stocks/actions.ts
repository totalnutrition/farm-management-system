"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole } from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const adjustSchema = z.object({
  stock_item_id: z.string().uuid(),
  qty_delta: z.number().refine((n) => n !== 0, "Adjustment can't be zero."),
  kind: z.enum(["adjustment", "wastage", "opening"]),
  note: z.string().max(500).nullable().optional(),
  occurred_at: z.string().min(1),
});
export type AdjustInput = z.infer<typeof adjustSchema>;

export async function adjustStock(input: AdjustInput): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const { error } = await admin.from("stock_movements").insert({
    stock_item_id: parsed.data.stock_item_id,
    kind: parsed.data.kind,
    qty_delta: parsed.data.qty_delta,
    occurred_at: parsed.data.occurred_at,
    source_table: "stocks_manual",
    operator_user_id: user.id,
    note: parsed.data.note ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/stocks");
  return { success: true };
}

const reorderSchema = z.object({
  stock_item_id: z.string().uuid(),
  reorder_level: z.number().min(0).nullable(),
});
export type ReorderInput = z.infer<typeof reorderSchema>;

export async function updateReorderLevel(input: ReorderInput): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("stock_items")
    .update({ reorder_level: parsed.data.reorder_level })
    .eq("id", parsed.data.stock_item_id);
  if (error) return { error: error.message };

  revalidatePath("/stocks");
  return { success: true };
}
