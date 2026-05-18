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
  // Stored animal attributes (subjects.attrs). Identity/metadata the
  // user enters at intake or edits later — first-class so it is
  // queryable, listable and shown, not write-only.
  attrs?: Record<string, unknown>;
};

export type DeriveContext = {
  today: string; // ISO yyyy-mm-dd — injected, never read from a clock
  // Org-scoped user calculated fields (compiled Sheets formulas),
  // keyed by uppercase item code. Resolved by the query executor so
  // they behave like any other item everywhere the engine is used.
  calc?: Record<string, import("./formula.ts").Formula>;
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
  return (
    base + eventsByCode(s, EC.FRESH).length + runMachine(s).lactBonus
  );
}

// --- the reproductive state machine + DC cascades -------------------
// One chronological pass producing the derived repro state plus the
// documented DC branches/cascades. Source: VAS Event Definitions +
// Vet Codes (ABT?). Branches not text-confirmed are tagged inferred.
export type MachineState = {
  rc: number; // reproductive code 0..8
  lactBonus: number; // extra lactations from ABORT with DCC>152
  abt: boolean; // ABT? vet flag (BRED entered while PREG)
};

// VAS Event Definitions: "If DCC > 152 days, a new lactation is started."
const ABORT_NEW_LACTATION_DCC = 152;

function abortDcc(s: Subject, e: Event): number | null {
  const p = e.payload as { dcc?: unknown } | undefined;
  if (p && typeof p.dcc === "number") return p.dcc;
  const c = s.facts?.conceptionDate;
  return c ? daysBetween(e.date, c) : null;
}

export function runMachine(s: Subject): MachineState {
  const ordered = [...s.events].sort(
    (a, b) => toUTC(a.date) - toUTC(b.date),
  );
  // A positive baseLactation means she has already completed
  // lactation(s) — she has calved, so she is NOT a virgin even if no
  // current-lactation FRESH/BRED/DRY event is in the stream. Seeding
  // rc from it keeps RPRO consistent with LACT (LACT>=1 can never be
  // VIRGIN) instead of mis-deriving multiparous cows as maiden heifers.
  const calved = (s.facts?.baseLactation ?? 0) >= 1;
  const st: MachineState = {
    rc: calved ? 2 : 0,
    lactBonus: 0,
    abt: false,
  };
  for (const e of ordered) {
    if (e.code === EC.FRESH) {
      st.rc = 2; // FRESH
      st.abt = false;
    } else if (e.code === EC.BRED) {
      // BRED on a PREG animal does NOT demote her; raises ABT?
      if (st.rc === 5) st.abt = true;
      else {
        st.rc = 4; // BRED
        st.abt = false;
      }
    } else if (e.code === EC.DRY) {
      st.rc = 6; // DRY
    } else if (e.code === EC.ABORT) {
      const dcc = abortDcc(s, e);
      if (dcc !== null && dcc > ABORT_NEW_LACTATION_DCC) {
        st.lactBonus += 1; // DCC>152 → new lactation
      }
      st.rc = 3; // → OPEN
      st.abt = false;
    } else if (e.code === EC.DNB) {
      st.rc = 1; // DNB
    } else if (e.code === EC.DIED) {
      st.rc = 7; // SLD/DIE (terminal)
    }
  }
  return st;
}

export function RC(s: Subject): number {
  return runMachine(s).rc;
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
  item: "ABT",
  provenance: "confirmed",
  note: "BRED entered while PREG keeps her PREG and raises the ABT? vet flag (VAS Vet Codes)",
  compute: (s) => (runMachine(s).abt ? "ABT?" : null),
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

// --- stored attributes (subjects.attrs) -----------------------------
// User-entered identity/metadata. Without these resolvers the fields
// are written at intake but invisible everywhere (list, query, detail)
// — the "fields vanish" gap. Each returns the stored string or null
// (absent → empty, never throws), so they behave like any other item.
const attrText = (item: string, key: string) =>
  register({
    item,
    provenance: "confirmed",
    note: `stored animal attribute "${key}"`,
    compute: (s) => {
      const v = s.attrs?.[key];
      return typeof v === "string" && v.trim() !== "" ? v : null;
    },
  });

attrText("PEN", "pen");
attrText("BREED", "breed");
attrText("EID", "eid");
attrText("DAM", "dam_id");
attrText("SIRE", "sire_id");
attrText("SSIRE", "service_sire");
attrText("REG", "registration");
attrText("RSN", "entry_reason");
attrText("ENTRY", "entry_date");

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
