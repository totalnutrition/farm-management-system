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
  feed_material_id: z.string().uuid(),
  as_fed_kg: z.number().positive("Must be > 0"),
  dm_pct_override: z.number().min(0).max(100).nullable().optional(),
  occurred_at: z.string().min(1, "Date is required."),
  note: z.string().max(500).nullable().optional(),
});
export type FeedingInput = z.infer<typeof inputSchema>;

/**
 * Ensures a stock_items row exists for (location, feed_material) and returns its id.
 * Display name and unit ('kg') are denormalised from the catalog row.
 */
async function ensureFeedStockItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  locationId: string,
  feedMaterialId: string,
): Promise<{ id: string; dm_pct: number | null } | { error: string }> {
  const { data: mat, error: matErr } = await admin
    .from("org_feed_materials")
    .select("name, dm_pct")
    .eq("id", feedMaterialId)
    .maybeSingle();
  if (matErr || !mat) return { error: "Feed material not found." };

  const { data: existing } = await admin
    .from("stock_items")
    .select("id")
    .eq("location_id", locationId)
    .eq("kind", "feed_material")
    .eq("feed_material_id", feedMaterialId)
    .maybeSingle();
  if (existing?.id) return { id: existing.id as string, dm_pct: (mat.dm_pct as number | null) ?? null };

  const { data: created, error: insErr } = await admin
    .from("stock_items")
    .insert({
      location_id: locationId,
      kind: "feed_material",
      feed_material_id: feedMaterialId,
      display_name: mat.name as string,
      unit: "kg",
    })
    .select("id")
    .single();
  if (insErr) return { error: insErr.message };
  return { id: created!.id as string, dm_pct: (mat.dm_pct as number | null) ?? null };
}

export async function createFeedingEvent(input: FeedingInput): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const stock = await ensureFeedStockItem(admin, parsed.data.location_id, parsed.data.feed_material_id);
  if ("error" in stock) return { error: stock.error };

  const dmPct = parsed.data.dm_pct_override ?? stock.dm_pct;
  const dmKg = dmPct !== null && dmPct !== undefined ? (parsed.data.as_fed_kg * dmPct) / 100 : null;

  const { data: ev, error: evErr } = await admin
    .from("feed_events")
    .insert({
      location_id: parsed.data.location_id,
      group_id: parsed.data.group_id ?? null,
      pen_id: parsed.data.pen_id ?? null,
      stock_item_id: stock.id,
      as_fed_kg: parsed.data.as_fed_kg,
      dm_kg: dmKg,
      occurred_at: parsed.data.occurred_at,
      operator_user_id: user.id,
      note: parsed.data.note ?? null,
    })
    .select("id")
    .single();
  if (evErr) return { error: evErr.message };

  const { error: mvErr } = await admin.from("stock_movements").insert({
    stock_item_id: stock.id,
    kind: "consumption",
    qty_delta: -parsed.data.as_fed_kg,
    occurred_at: parsed.data.occurred_at,
    source_table: "feed_events",
    source_id: ev!.id,
    operator_user_id: user.id,
    note: parsed.data.note ?? null,
  });
  if (mvErr) return { error: mvErr.message };

  revalidatePath("/feeding");
  revalidatePath("/stocks");
  return { success: true };
}

export async function deleteFeedingEvent(id: string): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const admin = createAdminClient();
  // Movement has source_table+source_id reference; clear it first.
  await admin
    .from("stock_movements")
    .delete()
    .eq("source_table", "feed_events")
    .eq("source_id", id);
  const { error } = await admin.from("feed_events").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/feeding");
  revalidatePath("/stocks");
  return { success: true };
}
