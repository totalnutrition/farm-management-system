"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole } from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const inputSchema = z.object({
  location_id: z.string().uuid(),
  group_id: z.string().uuid().nullable().optional(),
  pen_id: z.string().uuid().nullable().optional(),
  feed_event_id: z.string().uuid().nullable().optional(),
  refusal_kg: z.number().nonnegative(),
  occurred_at: z.string().min(1),
  note: z.string().max(500).nullable().optional(),
});
export type RefusalInput = z.infer<typeof inputSchema>;

export async function createRefusal(input: RefusalInput): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const { error } = await admin.from("feed_refusals").insert({
    location_id: parsed.data.location_id,
    group_id: parsed.data.group_id ?? null,
    pen_id: parsed.data.pen_id ?? null,
    feed_event_id: parsed.data.feed_event_id ?? null,
    refusal_kg: parsed.data.refusal_kg,
    occurred_at: parsed.data.occurred_at,
    operator_user_id: user.id,
    note: parsed.data.note ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/refusals");
  return { success: true };
}

export async function deleteRefusal(id: string): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const admin = createAdminClient();
  const { error } = await admin.from("feed_refusals").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/refusals");
  return { success: true };
}
