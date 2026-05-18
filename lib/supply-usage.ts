// Stock consumption from activities (treatment, breeding, feeding).
// All deduction goes through consume_supply (a Postgres function
// that takes a per-org advisory lock, re-checks on-hand, and posts
// the usage in one transaction) so the negative guard can't be
// raced. Callers resolve the item to an explicit id and roll back
// their primary event if consumption reports a shortage.

import type { createAdminClient } from "@/lib/supabase-admin";
import { SUBJECT_ITEM } from "@/lib/supply";

type Admin = ReturnType<typeof createAdminClient>;

export type Shortage = {
  itemName: string;
  need: number;
  onHand: number;
};

export function shortageMessage(shortages: Shortage[]): string {
  return (
    "Insufficient stock: " +
    shortages
      .map((s) => `${s.itemName} (need ${s.need}, have ${s.onHand})`)
      .join("; ") +
    ". Add a Supply Chain receipt first."
  );
}

// Resolve a Supply item name to its subject id. `ambiguous` is true
// when more than one item shares the name — callers that MUST track
// the consumable (drugs, genetic material) treat both "no id" and
// "ambiguous" as hard errors instead of silently skipping.
export async function resolveSupplyItemId(
  admin: Admin,
  orgId: string,
  name: string,
): Promise<{ id: string | null; ambiguous: boolean }> {
  if (!name) return { id: null, ambiguous: false };
  const { data } = await admin
    .from("subjects")
    .select("id")
    .eq("organization_id", orgId)
    .eq("subject_type", SUBJECT_ITEM)
    .eq("natural_key", name);
  if (!data || data.length === 0)
    return { id: null, ambiguous: false };
  if (data.length > 1) return { id: null, ambiguous: true };
  return { id: data[0].id, ambiguous: false };
}

// Atomic, race-safe consumption via the consume_supply DB function.
// `needs` carry both id (for the DB) and name (for the message).
export async function consumeSupply(
  admin: Admin,
  orgId: string,
  needs: Array<{ itemId: string; itemName: string; qty: number }>,
  date: string,
  ref: Record<string, unknown> = {},
): Promise<{ ok: true } | { ok: false; message: string }> {
  const real = needs.filter((n) => n.itemId && Math.abs(n.qty) > 0);
  if (real.length === 0) return { ok: true };

  const { data, error } = await admin.rpc("consume_supply", {
    p_org: orgId,
    p_needs: real.map((n) => ({
      item_id: n.itemId,
      qty: Math.abs(n.qty),
    })),
    p_date: date,
    p_ref: ref,
  });
  if (error) return { ok: false, message: error.message };

  const res = (data ?? {}) as {
    ok?: boolean;
    shortages?: Array<{ item_id: string; need: number; have: number }>;
  };
  if (res.ok) return { ok: true };

  const nameOf = new Map(real.map((n) => [n.itemId, n.itemName]));
  const shortages: Shortage[] = (res.shortages ?? []).map((s) => ({
    itemName: nameOf.get(s.item_id) ?? s.item_id,
    need: Math.round(s.need * 100) / 100,
    onHand: Math.round(s.have * 100) / 100,
  }));
  return { ok: false, message: shortageMessage(shortages) };
}
