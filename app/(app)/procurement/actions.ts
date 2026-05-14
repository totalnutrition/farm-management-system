"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole } from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const inputSchema = z.object({
  location_id: z.string().uuid(),
  vendor_id: z.string().uuid().nullable().optional(),
  // Either pick an existing stock line OR provision one from a catalog ref.
  stock_item_id: z.string().uuid().nullable().optional(),
  source: z
    .object({
      kind: z.enum(["feed_material", "vet_medicine", "consumable", "equipment"]),
      feed_material_id: z.string().uuid().optional(),
      vet_medicine_id: z.string().uuid().optional(),
      display_name: z.string().min(1).max(120).optional(),
      unit: z.string().min(1).max(20),
    })
    .nullable()
    .optional(),
  qty: z.number().positive("Quantity must be > 0."),
  unit_cost: z.number().nonnegative().nullable().optional(),
  occurred_at: z.string().min(1),
  note: z.string().max(500).nullable().optional(),
});
export type ProcurementInput = z.infer<typeof inputSchema>;

async function resolveStockItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  locationId: string,
  input: ProcurementInput,
): Promise<{ id: string } | { error: string }> {
  if (input.stock_item_id) return { id: input.stock_item_id };

  const src = input.source;
  if (!src) return { error: "Pick an existing line or a catalog item." };

  if (src.kind === "feed_material" && src.feed_material_id) {
    const { data: existing } = await admin
      .from("stock_items")
      .select("id")
      .eq("location_id", locationId)
      .eq("kind", "feed_material")
      .eq("feed_material_id", src.feed_material_id)
      .maybeSingle();
    if (existing?.id) return { id: existing.id as string };
    const { data: cat } = await admin
      .from("org_feed_materials")
      .select("name")
      .eq("id", src.feed_material_id)
      .maybeSingle();
    const { data: created, error } = await admin
      .from("stock_items")
      .insert({
        location_id: locationId,
        kind: "feed_material",
        feed_material_id: src.feed_material_id,
        display_name: (cat?.name as string) ?? src.display_name ?? "Feed",
        unit: src.unit,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { id: created!.id as string };
  }

  if (src.kind === "vet_medicine" && src.vet_medicine_id) {
    const { data: existing } = await admin
      .from("stock_items")
      .select("id")
      .eq("location_id", locationId)
      .eq("kind", "vet_medicine")
      .eq("vet_medicine_id", src.vet_medicine_id)
      .maybeSingle();
    if (existing?.id) return { id: existing.id as string };
    const { data: cat } = await admin
      .from("org_vet_medicines")
      .select("name")
      .eq("id", src.vet_medicine_id)
      .maybeSingle();
    const { data: created, error } = await admin
      .from("stock_items")
      .insert({
        location_id: locationId,
        kind: "vet_medicine",
        vet_medicine_id: src.vet_medicine_id,
        display_name: (cat?.name as string) ?? src.display_name ?? "Medicine",
        unit: src.unit,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { id: created!.id as string };
  }

  // Free-form consumable / equipment line keyed on display_name.
  if (!src.display_name) return { error: "Display name is required for a new item." };
  const { data: existing } = await admin
    .from("stock_items")
    .select("id")
    .eq("location_id", locationId)
    .eq("kind", src.kind)
    .eq("display_name", src.display_name)
    .maybeSingle();
  if (existing?.id) return { id: existing.id as string };
  const { data: created, error } = await admin
    .from("stock_items")
    .insert({
      location_id: locationId,
      kind: src.kind,
      display_name: src.display_name,
      unit: src.unit,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: created!.id as string };
}

export async function createReceipt(input: ProcurementInput): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const item = await resolveStockItem(admin, parsed.data.location_id, parsed.data);
  if ("error" in item) return { error: item.error };

  const { error } = await admin.from("stock_movements").insert({
    stock_item_id: item.id,
    kind: "receipt",
    qty_delta: parsed.data.qty,
    unit_cost: parsed.data.unit_cost ?? null,
    occurred_at: parsed.data.occurred_at,
    source_table: "procurement_receipts",
    vendor_id: parsed.data.vendor_id ?? null,
    operator_user_id: user.id,
    note: parsed.data.note ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/procurement");
  revalidatePath("/stocks");
  return { success: true };
}

export async function deleteReceipt(movementId: string): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const admin = createAdminClient();
  const { error } = await admin
    .from("stock_movements")
    .delete()
    .eq("id", movementId)
    .eq("kind", "receipt");
  if (error) return { error: error.message };
  revalidatePath("/procurement");
  revalidatePath("/stocks");
  return { success: true };
}
