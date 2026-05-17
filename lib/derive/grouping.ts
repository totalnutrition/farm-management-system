// Grouping engine — isomorphic, zero-dependency. Ordered GROUPS over
// derived items decide each animal's group (first match wins). A group
// then resolves to one of YOUR physical pens via its placement:
//   • none      — not mapped yet → never produces a move
//   • single    — the whole group goes to one pen
//   • parity    — split into pens by lactation bucket (heifer/mature)
//   • item      — split by a numeric cut (e.g. production) into pens
//   • capacity  — fill pens in order, overflow to the next
// The worklist = animals whose real pen ≠ their resolved pen. Pure.

import {
  deriveItem,
  type Subject,
  type DeriveContext,
  type ItemValue,
} from "./engine.ts";
import { matchPredicate, type Predicate } from "./query.ts";
import { labelOf } from "./catalog.ts";

export type ParityBucket = { lacts: number[]; pen: string };
export type ItemCut = { lt: number; pen: string };

export type Placement =
  | { kind: "none" }
  | { kind: "single"; pen: string }
  | { kind: "parity"; buckets: ParityBucket[] }
  | { kind: "item"; item: string; cuts: ItemCut[]; elsePen: string }
  | { kind: "capacity"; pens: string[] };

export type GroupingRule = {
  name: string;
  when: Predicate; // ordered; first matching group wins
  placement: Placement;
};
export type Ruleset = GroupingRule[];

export type Pen = { name: string; capacity: number | null };

// Back-compat: legacy rows stored target_pen / {firstLactation,mature}.
export function legacyPlacement(
  targetPen: string | null | undefined,
  split: { firstLactation: string; mature: string } | null | undefined,
): Placement {
  if (split)
    return {
      kind: "parity",
      buckets: [
        { lacts: [1], pen: split.firstLactation },
        { lacts: [2, 3, 4, 5, 6, 7, 8, 9, 10], pen: split.mature },
      ],
    };
  if (targetPen) return { kind: "single", pen: targetPen };
  return { kind: "none" };
}

function resolver(
  subject: Subject,
  physicalPen: string | null,
  ctx: DeriveContext,
): (item: string) => ItemValue {
  return (item) => {
    if (item === "PEN") return physicalPen;
    try {
      return deriveItem(item, subject, ctx);
    } catch {
      return null;
    }
  };
}

const lactOf = (subject: Subject, ctx: DeriveContext) =>
  Number(deriveItem("LACT", subject, ctx) ?? 0);

// Resolve a matched group to a concrete pen. `occupancy` is the live
// per-pen count built up across the population pass (capacity fill).
function resolvePen(
  pl: Placement,
  subject: Subject,
  ctx: DeriveContext,
  occupancy: Map<string, number>,
  caps: Map<string, number | null>,
): string | null {
  if (pl.kind === "none") return null;
  if (pl.kind === "single") return pl.pen;
  if (pl.kind === "parity") {
    const l = lactOf(subject, ctx);
    const hit =
      pl.buckets.find((b) => b.lacts.includes(l)) ??
      pl.buckets[pl.buckets.length - 1];
    return hit?.pen ?? null;
  }
  if (pl.kind === "item") {
    const v = Number(deriveItem(pl.item, subject, ctx) ?? NaN);
    if (Number.isFinite(v))
      for (const c of pl.cuts) if (v < c.lt) return c.pen;
    return pl.elsePen;
  }
  // capacity: first pen with room, else last (overflow)
  for (const p of pl.pens) {
    const cap = caps.get(p);
    const used = occupancy.get(p) ?? 0;
    if (cap === null || cap === undefined || used < cap) return p;
  }
  return pl.pens[pl.pens.length - 1] ?? null;
}

export function matchGroup(
  subject: Subject,
  physicalPen: string | null,
  ruleset: Ruleset,
  ctx: DeriveContext,
): GroupingRule | null {
  const get = resolver(subject, physicalPen, ctx);
  for (const r of ruleset) if (matchPredicate(r.when, get)) return r;
  return null;
}

export type WorklistRow = {
  id: string;
  from: string | null;
  to: string;
  rule: string;
  overCapacity: boolean;
};

export type GroupingMember = {
  id: string;
  subject: Subject;
  pen: string | null; // current physical pen
};

// Animals whose physical pen ≠ resolved pen. A group with placement
// "none" (not mapped to your pens yet) NEVER produces a move — the
// herd is only touched once you've attached real pens.
export function buildWorklist(
  population: GroupingMember[],
  ruleset: Ruleset,
  ctx: DeriveContext,
  pens: Pen[] = [],
): WorklistRow[] {
  const caps = new Map<string, number | null>(
    pens.map((p) => [p.name, p.capacity]),
  );
  const occupancy = new Map<string, number>();
  const out: WorklistRow[] = [];

  for (const m of population) {
    const g = matchGroup(m.subject, m.pen, ruleset, ctx);
    if (!g || g.placement.kind === "none") continue;
    const to = resolvePen(g.placement, m.subject, ctx, occupancy, caps);
    if (to === null) continue;
    occupancy.set(to, (occupancy.get(to) ?? 0) + 1);
    if (to !== m.pen) {
      const cap = caps.get(to);
      out.push({
        id: m.id,
        from: m.pen,
        to,
        rule: g.name,
        overCapacity:
          cap !== null && cap !== undefined && (occupancy.get(to) ?? 0) > cap,
      });
    }
  }
  return out;
}

// Names of groups still without a pen mapping (UI nudges the farmer).
export function unmappedGroups(ruleset: Ruleset): string[] {
  return ruleset
    .filter((r) => r.placement.kind === "none")
    .map((r) => r.name);
}

// --- plain-language rule text --------------------------------------
const OP_WORD: Record<string, string> = {
  "=": "is",
  "<>": "is not",
  ">": "more than",
  ">=": "at least",
  "<": "less than",
  "<=": "at most",
};

type Atom =
  | { kind: "cmp"; item: string; op: string; value: number | string }
  | {
      kind: "range";
      item: string;
      min: number;
      max: number;
      minInclusive: boolean;
      maxInclusive: boolean;
    }
  | { kind: "set"; item: string; values: Array<number | string> };

function atomText(a: Atom): string {
  if (a.kind === "range")
    return `${labelOf(a.item)} between ${a.min} and ${a.max}`;
  if (a.kind === "set")
    return `${labelOf(a.item)} is one of ${a.values.join(", ")}`;
  // a few readable shortcuts for the common repro cases
  if (a.item === "RPRO" && a.op === "=") return `${a.value}`;
  return `${labelOf(a.item)} ${OP_WORD[a.op] ?? a.op} ${a.value}`;
}

/** Predicate IR → human sentence ("Dry and Days to due at most 21"). */
export function describePredicate(p: Predicate): string {
  if (!p || p.length === 0) return "everyone";
  return p
    .map((group) => (group as Atom[]).map(atomText).join(" and "))
    .join(" or ");
}

/** One-line summary of where a group sends animals. */
export function describePlacement(pl: Placement): string {
  if (pl.kind === "none") return "—";
  if (pl.kind === "single") return `pen ${pl.pen}`;
  if (pl.kind === "parity")
    return pl.buckets
      .map((b) => `L${b.lacts.join("/")}→${b.pen}`)
      .join(" · ");
  if (pl.kind === "item")
    return `${labelOf(pl.item)}: ${pl.cuts
      .map((c) => `<${c.lt}→${c.pen}`)
      .join(" · ")} · else→${pl.elsePen}`;
  return `fill ${pl.pens.join(" → ")}`;
}
