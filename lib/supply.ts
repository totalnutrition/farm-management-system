// Supply Chain — shared model. Items and user categories are
// subjects; stock movements are events on the item subject. On-hand
// is derived from signed movement quantities (no manual issue).

export const SUBJECT_ITEM = "supply_item";
export const SUBJECT_CATEGORY = "supply_category";

export const EC_RECEIVE = 210; // SRCV  +qty
export const EC_ADJUST = 212; //  SADJ  ±qty
export const EC_PRICE = 213; //   SPRC   price only, qty 0
export const EC_USAGE = 214; //   SUSE  −qty

export const MOVE_CODES = [EC_RECEIVE, EC_ADJUST, EC_PRICE, EC_USAGE];

export type MoveKind = "receive" | "adjust" | "price" | "usage";

export const KIND_CODE: Record<MoveKind, number> = {
  receive: EC_RECEIVE,
  adjust: EC_ADJUST,
  price: EC_PRICE,
  usage: EC_USAGE,
};

export const CODE_KIND: Record<number, MoveKind> = {
  [EC_RECEIVE]: "receive",
  [EC_ADJUST]: "adjust",
  [EC_PRICE]: "price",
  [EC_USAGE]: "usage",
};

// Major farm stock categories shipped as the baseline. The category
// field on an item is free text — these are defaults, and any extra
// category the org adds (a supply_category subject) is merged in. No
// enum, no code change to add more.
export const DEFAULT_CATEGORIES = [
  "Semen & Genetics",
  "Veterinary Drugs & Vaccines",
  "Feed Materials",
  "Feed Additives & Minerals",
  "Bedding",
  "Hygiene & Sanitation",
  "Milking Supplies",
  "Fuel & Lubricants",
  "Utilities",
  "Machinery Spares & Tools",
  "Fencing & Infrastructure",
  "Crop Inputs",
  "Animal Supplies",
  "PPE & Workwear",
  "Office & General",
] as const;

export const UNIT_SUGGESTIONS = [
  "kg",
  "ton",
  "L",
  "straw",
  "dose",
  "bottle",
  "bag",
  "bale",
  "ea",
  "box",
  "roll",
  "kWh",
  "m³",
] as const;

// auto_deduct sources. Phase 1 ships "none"; feed/treatment/breeding
// bindings and the usage log are wired in later phases. Kept here so
// the catalogue is forward-compatible without a schema change.
export const AUTO_DEDUCT = [
  "none",
  "feed-event",
  "treatment-event",
  "breeding-event",
  "usage-log",
] as const;
export type AutoDeduct = (typeof AUTO_DEDUCT)[number];

export type SupplyItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  cost: number | null; // standard / reference unit cost
  reorderPoint: number | null;
  trackLots: boolean;
  trackExpiry: boolean;
  autoDeduct: AutoDeduct;
  notes: string | null;
};

export type SupplyMove = {
  id: string;
  itemId: string;
  itemName: string;
  kind: MoveKind;
  date: string;
  qty: number; // as entered (always >= 0 except adjust which may be ±)
  unitCost: number | null;
  party: string | null;
  lot: string | null;
  expiry: string | null;
  remark: string | null;
};

export type StockRow = SupplyItem & {
  onHand: number;
  avgCost: number | null;
  value: number | null;
  lastReceipt: string | null;
  low: boolean;
};

// Signed contribution of a movement to on-hand.
export function signedQty(kind: MoveKind, qty: number): number {
  if (kind === "receive") return Math.abs(qty);
  if (kind === "usage") return -Math.abs(qty);
  if (kind === "adjust") return qty; // may be negative
  return 0; // price
}

export function computeStock(
  item: SupplyItem,
  moves: SupplyMove[],
): StockRow {
  let onHand = 0;
  let rcvQty = 0;
  let rcvCost = 0;
  let lastReceipt: string | null = null;
  for (const m of moves) {
    onHand += signedQty(m.kind, m.qty);
    if (m.kind === "receive") {
      const q = Math.abs(m.qty);
      rcvQty += q;
      if (m.unitCost != null) rcvCost += q * m.unitCost;
      if (!lastReceipt || m.date > lastReceipt) lastReceipt = m.date;
    }
  }
  const avgCost =
    rcvQty > 0 && rcvCost > 0
      ? rcvCost / rcvQty
      : item.cost != null
        ? item.cost
        : null;
  const value = avgCost != null ? onHand * avgCost : null;
  const low =
    item.reorderPoint != null && onHand <= item.reorderPoint;
  return {
    ...item,
    onHand: round2(onHand),
    avgCost: avgCost != null ? round2(avgCost) : null,
    value: value != null ? round2(value) : null,
    lastReceipt,
    low,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
