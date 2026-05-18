import { createAdminClient } from "@/lib/supabase-admin";
import {
  requireAnyRole,
  getOrganizationIdFromUser,
} from "@/lib/supabase-auth";
import {
  SUBJECT_ITEM,
  SUBJECT_CATEGORY,
  DEFAULT_CATEGORIES,
  MOVE_CODES,
  CODE_KIND,
  computeStock,
  type SupplyItem,
  type SupplyMove,
  type AutoDeduct,
} from "@/lib/supply";
import { SupplyClient } from "./supply-client";

export const metadata = { title: "Supply Chain" };
export const dynamic = "force-dynamic";

export default async function SupplyPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );
  const admin = createAdminClient();

  const [{ data: itemRows }, { data: catRows }] = await Promise.all([
    admin
      .from("subjects")
      .select("id, natural_key, attrs")
      .eq("organization_id", orgId)
      .eq("subject_type", SUBJECT_ITEM)
      .order("natural_key"),
    admin
      .from("subjects")
      .select("natural_key")
      .eq("organization_id", orgId)
      .eq("subject_type", SUBJECT_CATEGORY)
      .order("natural_key"),
  ]);

  const items: SupplyItem[] = (itemRows ?? []).map((s) => {
    const a = (s.attrs ?? {}) as Record<string, unknown>;
    return {
      id: s.id,
      name: s.natural_key,
      category: typeof a.category === "string" ? a.category : "Uncategorized",
      unit: typeof a.unit === "string" ? a.unit : "ea",
      cost: typeof a.cost === "number" ? a.cost : null,
      reorderPoint:
        typeof a.reorder_point === "number" ? a.reorder_point : null,
      trackLots: a.track_lots === true,
      trackExpiry: a.track_expiry === true,
      autoDeduct:
        typeof a.auto_deduct === "string"
          ? (a.auto_deduct as AutoDeduct)
          : "none",
      notes: typeof a.notes === "string" ? a.notes : null,
    };
  });

  const itemById = new Map(items.map((i) => [i.id, i]));
  const moves: SupplyMove[] = [];
  if (items.length) {
    const { data: evs } = await admin
      .from("events")
      .select("id, subject_id, event_code, event_date, remark, payload")
      .eq("organization_id", orgId)
      .in("event_code", MOVE_CODES)
      .in(
        "subject_id",
        items.map((i) => i.id),
      )
      .order("event_date", { ascending: false });
    for (const e of evs ?? []) {
      const it = itemById.get(e.subject_id);
      if (!it) continue;
      const p = (e.payload ?? {}) as Record<string, unknown>;
      moves.push({
        id: e.id,
        itemId: e.subject_id,
        itemName: it.name,
        kind: CODE_KIND[e.event_code] ?? "adjust",
        date: e.event_date,
        qty: typeof p.qty === "number" ? p.qty : 0,
        unitCost: typeof p.unit_cost === "number" ? p.unit_cost : null,
        party: typeof p.party === "string" ? p.party : null,
        lot: typeof p.lot === "string" ? p.lot : null,
        expiry: typeof p.expiry === "string" ? p.expiry : null,
        remark: typeof e.remark === "string" ? e.remark : null,
      });
    }
  }

  const movesByItem = new Map<string, SupplyMove[]>();
  for (const m of moves) {
    const l = movesByItem.get(m.itemId) ?? [];
    l.push(m);
    movesByItem.set(m.itemId, l);
  }
  const stock = items.map((i) =>
    computeStock(i, movesByItem.get(i.id) ?? []),
  );

  const categories = Array.from(
    new Set([
      ...DEFAULT_CATEGORIES,
      ...(catRows ?? []).map((c) => c.natural_key),
      ...items.map((i) => i.category),
    ]),
  ).sort();

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Supply Chain</h1>
        <p className="text-xs text-muted-foreground">
          One catalogue and stock ledger for every farm input — semen,
          vet drugs, feed, additives, fuel, utilities and anything else
          you stock. On-hand is derived from receipts, adjustments and
          usage; there is no separate issue step.
        </p>
      </header>
      <SupplyClient
        items={items}
        stock={stock}
        moves={moves}
        categories={categories}
      />
    </div>
  );
}
