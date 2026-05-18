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
  SUBJECT_PARTY,
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
        { code: 215, name: "SSAL", label: "Stock sale (Supply Chain)" },
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
  genericName: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  category: z.string().trim().min(1, "Category is required."),
  unit: z.string().trim().min(1, "Unit is required."),
  cost: z.coerce.number().positive("A unit price is required."),
  reorderPoint: z.coerce.number().min(0).optional(),
  defaultSupplier: z.string().trim().optional(),
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
      generic_name: p.genericName ?? null,
      brand: p.brand ?? null,
      category: p.category,
      unit: p.unit,
      cost: p.cost,
      reorder_point: p.reorderPoint ?? null,
      default_supplier: p.defaultSupplier ?? null,
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
  kind: z.enum(["receive", "adjust", "price", "usage", "sale"]),
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
  if (m.kind === "receive" && !m.party)
    return { error: "A purchase needs a supplier." };
  if (m.kind === "sale" && !m.party)
    return { error: "A sale needs a buyer." };
  if (m.kind === "sale" && m.unitCost == null)
    return { error: "A sale needs a unit price." };

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

// ---- Parties (suppliers / buyers) — replaces Commercial's separate
// vendor and customer registration; one party can be both. ----

const partySchema = z.object({
  name: z.string().trim().min(1, "Party name is required."),
  isSupplier: z.boolean().optional(),
  isBuyer: z.boolean().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
  terms: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

function partyAttrs(p: z.infer<typeof partySchema>) {
  return {
    is_supplier: p.isSupplier ?? false,
    is_buyer: p.isBuyer ?? false,
    phone: p.phone ?? null,
    email: p.email ?? null,
    address: p.address ?? null,
    terms: p.terms ?? null,
    notes: p.notes ?? null,
  };
}

export async function createParty(
  input: z.infer<typeof partySchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const parsed = partySchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const p = parsed.data;
  if (!p.isSupplier && !p.isBuyer)
    return { error: "Mark the party as a supplier, a buyer, or both." };
  const admin = createAdminClient();
  const { error } = await admin.from("subjects").insert({
    organization_id: orgId,
    subject_type: SUBJECT_PARTY,
    natural_key: p.name,
    attrs: partyAttrs(p),
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `Party “${p.name}” already exists.` };
    return { error: error.message };
  }
  revalidatePath(PathSupply);
  return { success: true };
}

const partyUpdateSchema = partySchema.extend({ id: z.uuid() });

export async function updateParty(
  input: z.infer<typeof partyUpdateSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const parsed = partyUpdateSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const p = parsed.data;
  if (!p.isSupplier && !p.isBuyer)
    return { error: "Mark the party as a supplier, a buyer, or both." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("subjects")
    .update({ natural_key: p.name, attrs: partyAttrs(p) })
    .eq("id", p.id)
    .eq("organization_id", orgId)
    .eq("subject_type", SUBJECT_PARTY);
  if (error) {
    if (error.code === "23505")
      return { error: `Party “${p.name}” already exists.` };
    return { error: error.message };
  }
  revalidatePath(PathSupply);
  return { success: true };
}

export async function deleteParty(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("subject_type", SUBJECT_PARTY);
  if (error) return { error: error.message };
  revalidatePath(PathSupply);
  return { success: true };
}
