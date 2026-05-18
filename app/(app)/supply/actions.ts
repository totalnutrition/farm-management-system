"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  requireAnyRole,
  getOrganizationIdFromUser,
} from "@/lib/supabase-auth";
import { PathSupply } from "@/lib/misc";
import {
  SUBJECT_ITEM,
  SUBJECT_CATEGORY,
  AUTO_DEDUCT,
  KIND_CODE,
  MOVE_CODES,
} from "@/lib/supply";

type Result = { error?: string; success?: boolean };

type Admin = ReturnType<typeof createAdminClient>;

// Orgs created after migration 0020 won't have the supply event
// codes yet; the events FK requires them. Ensure lazily, idempotent.
async function ensureSupplyCodes(
  admin: Admin,
  orgId: string,
  userId: string,
) {
  await admin
    .from("event_codes")
    .upsert(
      [
        { code: 210, name: "SRCV", label: "Stock receipt (Supply Chain)" },
        {
          code: 212,
          name: "SADJ",
          label: "Stock adjustment (Supply Chain)",
        },
        { code: 213, name: "SPRC", label: "Stock price (Supply Chain)" },
        { code: 214, name: "SUSE", label: "Stock usage (Supply Chain)" },
      ].map((c) => ({
        organization_id: orgId,
        code: c.code,
        name: c.name,
        label: c.label,
        is_system: false,
        provenance: "app-defined: Supply Chain",
        created_by: userId,
      })),
      { onConflict: "organization_id,code", ignoreDuplicates: true },
    );
}

const itemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required."),
  category: z.string().trim().min(1, "Category is required."),
  unit: z.string().trim().min(1, "Unit is required."),
  cost: z.coerce.number().min(0).optional(),
  reorderPoint: z.coerce.number().min(0).optional(),
  trackLots: z.boolean().optional(),
  trackExpiry: z.boolean().optional(),
  autoDeduct: z.enum(AUTO_DEDUCT).optional(),
  notes: z.string().trim().optional(),
});

export async function createItem(
  input: z.infer<typeof itemSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const p = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin.from("subjects").insert({
    organization_id: orgId,
    subject_type: SUBJECT_ITEM,
    natural_key: p.name,
    attrs: {
      category: p.category,
      unit: p.unit,
      cost: p.cost ?? null,
      reorder_point: p.reorderPoint ?? null,
      track_lots: p.trackLots ?? false,
      track_expiry: p.trackExpiry ?? false,
      auto_deduct: p.autoDeduct ?? "none",
      notes: p.notes ?? null,
    },
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `Item “${p.name}” already exists.` };
    return { error: error.message };
  }
  revalidatePath(PathSupply);
  return { success: true };
}

const updateSchema = itemSchema.extend({ id: z.uuid() });

export async function updateItem(
  input: z.infer<typeof updateSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const p = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin
    .from("subjects")
    .update({
      natural_key: p.name,
      attrs: {
        category: p.category,
        unit: p.unit,
        cost: p.cost ?? null,
        reorder_point: p.reorderPoint ?? null,
        track_lots: p.trackLots ?? false,
        track_expiry: p.trackExpiry ?? false,
        auto_deduct: p.autoDeduct ?? "none",
        notes: p.notes ?? null,
      },
    })
    .eq("id", p.id)
    .eq("organization_id", orgId)
    .eq("subject_type", SUBJECT_ITEM);
  if (error) {
    if (error.code === "23505")
      return { error: `Item “${p.name}” already exists.` };
    return { error: error.message };
  }
  revalidatePath(PathSupply);
  return { success: true };
}

export async function deleteItem(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const admin = createAdminClient();
  // Movement events cascade via events.subject_id ON DELETE CASCADE.
  const { error } = await admin
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("subject_type", SUBJECT_ITEM);
  if (error) return { error: error.message };
  revalidatePath(PathSupply);
  return { success: true };
}

const catSchema = z.object({
  name: z.string().trim().min(1, "Category name is required."),
});

export async function addCategory(
  input: z.infer<typeof catSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const parsed = catSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const admin = createAdminClient();
  const { error } = await admin.from("subjects").insert({
    organization_id: orgId,
    subject_type: SUBJECT_CATEGORY,
    natural_key: parsed.data.name,
    attrs: {},
    created_by: user.id,
  });
  // A duplicate category is a no-op success (it already exists).
  if (error && error.code !== "23505") return { error: error.message };
  revalidatePath(PathSupply);
  return { success: true };
}

const moveSchema = z.object({
  itemId: z.uuid(),
  kind: z.enum(["receive", "adjust", "price", "usage"]),
  date: z.string().min(1, "Date is required."),
  qty: z.coerce.number(),
  unitCost: z.coerce.number().min(0).optional(),
  party: z.string().trim().optional(),
  lot: z.string().trim().optional(),
  expiry: z.string().trim().optional(),
  remark: z.string().trim().optional(),
});

export async function addMovement(
  input: z.infer<typeof moveSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const m = parsed.data;
  if (m.kind !== "adjust" && m.kind !== "price" && m.qty <= 0)
    return { error: "Quantity must be greater than zero." };
  if (m.kind === "price" && m.unitCost == null)
    return { error: "A price observation needs a unit cost." };

  const admin = createAdminClient();
  // Confirm the item belongs to this org.
  const { data: item } = await admin
    .from("subjects")
    .select("id")
    .eq("id", m.itemId)
    .eq("organization_id", orgId)
    .eq("subject_type", SUBJECT_ITEM)
    .maybeSingle();
  if (!item) return { error: "Item not found." };

  await ensureSupplyCodes(admin, orgId, user.id);

  const { error } = await admin.from("events").insert({
    organization_id: orgId,
    subject_id: m.itemId,
    event_code: KIND_CODE[m.kind],
    event_date: m.date,
    remark: m.remark ?? null,
    payload: {
      qty: m.qty,
      unit_cost: m.unitCost ?? null,
      party: m.party ?? null,
      lot: m.lot ?? null,
      expiry: m.expiry ?? null,
    },
    source: "user",
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(PathSupply);
  return { success: true };
}

export async function deleteMovement(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("events")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .in("event_code", MOVE_CODES);
  if (error) return { error: error.message };
  revalidatePath(PathSupply);
  return { success: true };
}
