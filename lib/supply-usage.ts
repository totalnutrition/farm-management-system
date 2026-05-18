// Auto stock movement. When a consuming event is recorded elsewhere
// (e.g. a treatment uses a drug), post the matching Supply Chain
// movement so on-hand stays correct without a second manual entry.
// Best-effort: a missing item or a write error never blocks the
// primary action — stock simply isn't moved.

import type { createAdminClient } from "@/lib/supabase-admin";
import {
  SUBJECT_ITEM,
  EC_USAGE,
  EC_RECEIVE,
  MOVE_CODES,
  CODE_KIND,
  signedQty,
} from "@/lib/supply";

type Admin = ReturnType<typeof createAdminClient>;

export type SupplyNeed = { itemName: string; qty: number };
export type Shortage = {
  itemName: string;
  need: number;
  onHand: number;
};

// Batch negative-stock guard. Aggregates needs by item, computes
// each item's current on-hand from its movement ledger, and reports
// any item that would go below zero. Items with no matching Supply
// subject are ignored (not tracked) — only real shortages block.
export async function checkSupplyShortages(
  admin: Admin,
  orgId: string,
  needs: SupplyNeed[],
): Promise<Shortage[]> {
  const want = new Map<string, number>();
  for (const n of needs) {
    const q = Math.abs(n.qty);
    if (!n.itemName || q <= 0) continue;
    want.set(n.itemName, (want.get(n.itemName) ?? 0) + q);
  }
  if (want.size === 0) return [];

  const names = [...want.keys()];
  const { data: items } = await admin
    .from("subjects")
    .select("id, natural_key")
    .eq("organization_id", orgId)
    .eq("subject_type", SUBJECT_ITEM)
    .in("natural_key", names);
  if (!items || items.length === 0) return [];

  const idToName = new Map(items.map((i) => [i.id, i.natural_key]));
  const { data: evs } = await admin
    .from("events")
    .select("subject_id, event_code, payload")
    .eq("organization_id", orgId)
    .in("event_code", MOVE_CODES)
    .in(
      "subject_id",
      items.map((i) => i.id),
    );

  const onHand = new Map<string, number>();
  for (const e of evs ?? []) {
    const name = idToName.get(e.subject_id);
    if (!name) continue;
    const kind = CODE_KIND[e.event_code];
    if (!kind) continue;
    const p = (e.payload ?? {}) as Record<string, unknown>;
    const q = typeof p.qty === "number" ? p.qty : 0;
    onHand.set(name, (onHand.get(name) ?? 0) + signedQty(kind, q));
  }

  const shortages: Shortage[] = [];
  for (const [itemName, need] of want) {
    if (!idToName.size) break;
    const have = onHand.get(itemName);
    // Only items that actually exist as Supply subjects are guarded.
    if (!items.some((i) => i.natural_key === itemName)) continue;
    const cur = have ?? 0;
    if (cur < need)
      shortages.push({
        itemName,
        need: Math.round(need * 100) / 100,
        onHand: Math.round(cur * 100) / 100,
      });
  }
  return shortages;
}

export function shortageMessage(shortages: Shortage[]): string {
  return (
    "Insufficient stock: " +
    shortages
      .map(
        (s) =>
          `${s.itemName} (need ${s.need}, have ${s.onHand})`,
      )
      .join("; ") +
    ". Add a Supply Chain receipt first."
  );
}

// Resolve a Supply item name to its subject id. `ambiguous` is true
// when more than one item shares the name — callers that MUST track
// the consumable (drugs, genetic material) should treat both "no id"
// and "ambiguous" as hard errors instead of silently skipping.
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

export async function applySupplyMovement(
  admin: Admin,
  orgId: string,
  opts: {
    itemName: string;
    itemId?: string; // pre-resolved id — skips the name lookup
    qty: number;
    date: string;
    direction: "use" | "receive";
    ref?: Record<string, unknown>;
  },
): Promise<void> {
  const qty = Math.abs(opts.qty);
  if (qty <= 0) return;

  let subjectId = opts.itemId ?? null;
  if (!subjectId) {
    if (!opts.itemName) return;
    const { data: item } = await admin
      .from("subjects")
      .select("id")
      .eq("organization_id", orgId)
      .eq("subject_type", SUBJECT_ITEM)
      .eq("natural_key", opts.itemName)
      .maybeSingle();
    if (!item) return;
    subjectId = item.id;
  }

  const code = opts.direction === "receive" ? EC_RECEIVE : EC_USAGE;
  // The events FK requires the code to exist for this org. Orgs
  // created before Supply Chain may lack it; upsert is idempotent.
  await admin.from("event_codes").upsert(
    {
      organization_id: orgId,
      code,
      name: code === EC_RECEIVE ? "SRCV" : "SUSE",
      label:
        code === EC_RECEIVE
          ? "Stock receipt (Supply Chain)"
          : "Stock usage (Supply Chain)",
      is_system: false,
      provenance: "app-defined: Supply Chain",
    },
    { onConflict: "organization_id,code", ignoreDuplicates: true },
  );

  await admin.from("events").insert({
    organization_id: orgId,
    subject_id: subjectId,
    event_code: code,
    event_date: opts.date,
    payload: {
      qty,
      unit_cost: null,
      party: null,
      auto: true,
      ...(opts.ref ?? {}),
    },
    source: "system",
  });
}
