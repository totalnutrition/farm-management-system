// Isomorphic derivation engine — pure TypeScript, zero dependencies.
// Runs identically on the server and on-device (offline requirement):
// no DB, no DOM, no Node APIs. Computes item values from a subject's
// event stream. Every formula carries a provenance tag so unconfirmed
// dairy constants can be swapped without touching the engine.

export type Provenance = "confirmed" | "standard-science" | "inferred";

// A recorded event (mirrors the public.events ledger shape, minimally).
export type Event = {
  code: number; // EC
  date: string; // EDAY, ISO yyyy-mm-dd
  payload?: Record<string, unknown>;
};

// Stored facts supplied at intake that are not (yet) event-derived in
// the confirmed seed set (e.g. birth date, expected calving date).
export type IntakeFacts = {
  birthDate?: string; // BDAT
  conceptionDate?: string; // CDAT
  dueDate?: string; // expected calving date
  lastHeatDate?: string; // HDAT
  baseLactation?: number; // lactations before first in-system FRESH
};

export type Subject = {
  events: Event[];
  facts?: IntakeFacts;
};

export type DeriveContext = {
  today: string; // ISO yyyy-mm-dd — injected, never read from a clock
};

export type ItemValue = number | string | null;

export type FormulaSpec = {
  item: string;
  provenance: Provenance;
  note?: string;
  compute: (s: Subject, ctx: DeriveContext) => ItemValue;
};

// --- confirmed event codes (source-confirmed numeric map subset) -----
export const EC = {
  FRESH: 1,
  BRED: 5,
  DRY: 11,
  ABORT: 12,
  DNB: 13,
  DIED: 15,
} as const;

// --- date helpers (UTC, calendar-day exact) -------------------------
function toUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
function daysBetween(aIso: string, bIso: string): number {
  return Math.floor((toUTC(aIso) - toUTC(bIso)) / 86_400_000);
}
function wholeMonthsBetween(aIso: string, bIso: string): number {
  const [ay, am, ad] = aIso.split("-").map(Number);
  const [by, bm, bd] = bIso.split("-").map(Number);
  let months = (ay - by) * 12 + (am - bm);
  if (ad < bd) months -= 1;
  return months;
}
function eventsByCode(s: Subject, code: number): Event[] {
  return s.events
    .filter((e) => e.code === code)
    .sort((x, y) => toUTC(x.date) - toUTC(y.date));
}
function lastEventDate(s: Subject, code: number): string | null {
  const es = eventsByCode(s, code);
  return es.length ? es[es.length - 1].date : null;
}

// --- base facts derived from the event stream -----------------------
export function FDAT(s: Subject): string | null {
  return lastEventDate(s, EC.FRESH);
}
export function DDAT(s: Subject): string | null {
  return lastEventDate(s, EC.DRY);
}
export function LACT(s: Subject): number {
  const base = s.facts?.baseLactation ?? 0;
  return base + eventsByCode(s, EC.FRESH).length;
}

// --- the reproductive-code state machine ----------------------------
// Processes events chronologically applying source-confirmed
// transitions (VAS Event Definitions). Branch nuances that are not
// number/text-confirmed are tagged inferred.
export type RcRule = {
  code: number;
  provenance: Provenance;
  apply: (rc: number, s: Subject, e: Event) => number;
};

export const RC_RULES: RcRule[] = [
  { code: EC.FRESH, provenance: "confirmed", apply: () => 2 }, // → FRESH
  {
    code: EC.BRED,
    provenance: "confirmed",
    // BRED on a PREG animal does NOT demote her; vet flags ABT? (kept PREG)
    apply: (rc) => (rc === 5 ? 5 : 4),
  },
  { code: EC.DRY, provenance: "confirmed", apply: () => 6 }, // → DRY
  {
    code: EC.ABORT,
    provenance: "inferred",
    // DCC>152 starts a new lactation (handled by LACT); status → OPEN
    apply: () => 3,
  },
  { code: EC.DNB, provenance: "confirmed", apply: () => 1 }, // → DNB
  { code: EC.DIED, provenance: "confirmed", apply: () => 7 }, // → SLD/DIE
];

export function RC(s: Subject): number {
  const ordered = [...s.events].sort(
    (a, b) => toUTC(a.date) - toUTC(b.date),
  );
  let rc = 0; // virgin/no status
  for (const e of ordered) {
    const rule = RC_RULES.find((r) => r.code === e.code);
    if (rule) rc = rule.apply(rc, s, e);
  }
  return rc;
}

const RPRO_TEXT: Record<number, string> = {
  0: "VIRGIN",
  1: "DNB",
  2: "FRESH",
  3: "OPEN",
  4: "BRED",
  5: "PREG",
  6: "DRY",
  7: "SLD/DIE",
  8: "BULLCAF",
};

// --- the pluggable formula registry ---------------------------------
const REGISTRY = new Map<string, FormulaSpec>();

export function register(spec: FormulaSpec): void {
  REGISTRY.set(spec.item, spec);
}
export function getFormula(item: string): FormulaSpec | undefined {
  return REGISTRY.get(item);
}
export function registeredItems(): string[] {
  return [...REGISTRY.keys()].sort();
}

// --- confirmed default formulas -------------------------------------
register({
  item: "FDAT",
  provenance: "confirmed",
  compute: (s) => FDAT(s),
});
register({
  item: "DDAT",
  provenance: "confirmed",
  compute: (s) => DDAT(s),
});
register({
  item: "LACT",
  provenance: "confirmed",
  note: "each FRESH event starts a new lactation",
  compute: (s) => LACT(s),
});
register({
  item: "RC",
  provenance: "confirmed",
  note: "event→repro state machine; some branches inferred",
  compute: (s) => RC(s),
});
register({
  item: "RPRO",
  provenance: "confirmed",
  compute: (s) => RPRO_TEXT[RC(s)] ?? null,
});
register({
  item: "DIM",
  provenance: "confirmed",
  note: "today − FDAT",
  compute: (s, ctx) => {
    const f = FDAT(s);
    return f ? daysBetween(ctx.today, f) : null;
  },
});
register({
  item: "DDRY",
  provenance: "confirmed",
  note: "today − DDAT while dry",
  compute: (s, ctx) => {
    const d = DDAT(s);
    if (!d) return null;
    return RC(s) === 6 ? daysBetween(ctx.today, d) : null;
  },
});
register({
  item: "AGE",
  provenance: "confirmed",
  note: "whole months since BDAT",
  compute: (s, ctx) => {
    const b = s.facts?.birthDate;
    return b ? wholeMonthsBetween(ctx.today, b) : null;
  },
});
register({
  item: "DCC",
  provenance: "confirmed",
  note: "today − conception date (days carrying calf)",
  compute: (s, ctx) => {
    const c = s.facts?.conceptionDate;
    return c && RC(s) === 5 ? daysBetween(ctx.today, c) : null;
  },
});
register({
  item: "DUE",
  provenance: "confirmed",
  note: "expected calving date − today",
  compute: (s, ctx) => {
    const due = s.facts?.dueDate;
    return due ? daysBetween(due, ctx.today) : null;
  },
});
register({
  item: "DSLH",
  provenance: "confirmed",
  note: "today − last heat date",
  compute: (s, ctx) => {
    const h = s.facts?.lastHeatDate;
    return h ? daysBetween(ctx.today, h) : null;
  },
});
register({
  item: "DOPN",
  provenance: "inferred",
  note: "open: today−FDAT; pregnant: CDAT−FDAT. Exact DC definition unconfirmed.",
  compute: (s, ctx) => {
    const f = FDAT(s);
    if (!f) return null;
    const c = s.facts?.conceptionDate;
    if (RC(s) === 5 && c) return daysBetween(c, f);
    return daysBetween(ctx.today, f);
  },
});

// --- public surface --------------------------------------------------
export function deriveItem(
  item: string,
  s: Subject,
  ctx: DeriveContext,
): ItemValue {
  const spec = REGISTRY.get(item);
  if (!spec) throw new Error(`No formula registered for item "${item}"`);
  return spec.compute(s, ctx);
}

export function derive(
  s: Subject,
  ctx: DeriveContext,
  items?: string[],
): Record<string, ItemValue> {
  const keys = items ?? registeredItems();
  const out: Record<string, ItemValue> = {};
  for (const k of keys) out[k] = deriveItem(k, s, ctx);
  return out;
}

export function provenanceReport(): Record<string, Provenance> {
  const out: Record<string, Provenance> = {};
  for (const [k, v] of REGISTRY) out[k] = v.provenance;
  return out;
}
