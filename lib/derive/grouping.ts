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

export type OrderBy = { item: string; dir: "asc" | "desc" };
export type Placement =
  | { kind: "none" }
  | { kind: "single"; pen: string }
  | { kind: "parity"; buckets: ParityBucket[] }
  | { kind: "item"; item: string; cuts: ItemCut[]; elsePen: string }
  | { kind: "capacity"; pens: string[]; orderBy?: OrderBy };

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

const numItem = (
  item: string,
  subject: Subject,
  ctx: DeriveContext,
): number | null => {
  const v = Number(deriveItem(item, subject, ctx) ?? NaN);
  return Number.isFinite(v) ? v : null;
};

// Resolve a whole GROUP's members to pens at once — capacity/ranked
// splits need the full membership (e.g. "top 60 by milk → A, rest →
// B"). Returns id → pen (null = no pen / unmapped).
function placeGroup(
  members: GroupingMember[],
  pl: Placement,
  ctx: DeriveContext,
  caps: Map<string, number | null>,
): Map<string, string | null> {
  const out = new Map<string, string | null>();
  if (pl.kind === "none") {
    for (const m of members) out.set(m.id, null);
    return out;
  }
  if (pl.kind === "single") {
    for (const m of members) out.set(m.id, pl.pen);
    return out;
  }
  if (pl.kind === "parity") {
    for (const m of members) {
      const l = lactOf(m.subject, ctx);
      const hit =
        pl.buckets.find((b) => b.lacts.includes(l)) ??
        pl.buckets[pl.buckets.length - 1];
      out.set(m.id, hit?.pen ?? null);
    }
    return out;
  }
  if (pl.kind === "item") {
    for (const m of members) {
      const v = numItem(pl.item, m.subject, ctx);
      let pen = pl.elsePen;
      if (v !== null) for (const c of pl.cuts) if (v < c.lt) { pen = c.pen; break; }
      out.set(m.id, pen);
    }
    return out;
  }
  // capacity: optionally rank members, then fill pens in order to
  // their declared capacity; overflow to the last pen.
  const ordered = [...members];
  if (pl.orderBy) {
    const { item, dir } = pl.orderBy;
    ordered.sort((a, b) => {
      const av = numItem(item, a.subject, ctx);
      const bv = numItem(item, b.subject, ctx);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return dir === "desc" ? bv - av : av - bv;
    });
  }
  const used = new Map<string, number>();
  for (const m of ordered) {
    let chosen = pl.pens[pl.pens.length - 1] ?? null;
    for (const p of pl.pens) {
      const cap = caps.get(p);
      if (cap === null || cap === undefined || (used.get(p) ?? 0) < cap) {
        chosen = p;
        break;
      }
    }
    if (chosen) used.set(chosen, (used.get(chosen) ?? 0) + 1);
    out.set(m.id, chosen);
  }
  return out;
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

  // partition into groups (first match wins), preserving order
  const byGroup = new Map<string, GroupingMember[]>();
  const ruleOf = new Map<string, GroupingRule>();
  for (const m of population) {
    const g = matchGroup(m.subject, m.pen, ruleset, ctx);
    if (!g || g.placement.kind === "none") continue;
    (byGroup.get(g.name) ?? byGroup.set(g.name, []).get(g.name)!).push(m);
    ruleOf.set(g.name, g);
  }

  // resolve each group, then tally pen occupancy for capacity flags
  const target = new Map<string, { m: GroupingMember; to: string }>();
  const occupancy = new Map<string, number>();
  for (const [gname, members] of byGroup) {
    const g = ruleOf.get(gname)!;
    const placed = placeGroup(members, g.placement, ctx, caps);
    for (const m of members) {
      const to = placed.get(m.id);
      if (!to) continue;
      target.set(m.id, { m, to });
      occupancy.set(to, (occupancy.get(to) ?? 0) + 1);
    }
  }

  const out: WorklistRow[] = [];
  for (const m of population) {
    const t = target.get(m.id);
    if (!t || t.to === m.pen) continue;
    const g = matchGroup(m.subject, m.pen, ruleset, ctx)!;
    const cap = caps.get(t.to);
    out.push({
      id: m.id,
      from: m.pen,
      to: t.to,
      rule: g.name,
      overCapacity:
        cap !== null && cap !== undefined && (occupancy.get(t.to) ?? 0) > cap,
    });
  }
  return out;
}

// Counts-first sizing: how many animals each group catches (regardless
// of whether it's mapped to pens yet). UI shows this BEFORE pen talk.
export function groupSizes(
  population: GroupingMember[],
  ruleset: Ruleset,
  ctx: DeriveContext,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of ruleset) out[r.name] = 0;
  for (const m of population) {
    const g = matchGroup(m.subject, m.pen, ruleset, ctx);
    if (g) out[g.name] = (out[g.name] ?? 0) + 1;
  }
  return out;
}

// Reconciliation: every animal is assigned to exactly one group (the
// first / most-specific match). Surfaces total vs grouped vs
// ungrouped (ids) so genuine coverage gaps are visible, not dropped.
export function reconcile(
  population: GroupingMember[],
  ruleset: Ruleset,
  ctx: DeriveContext,
): { total: number; grouped: number; ungrouped: string[] } {
  const ungrouped: string[] = [];
  for (const m of population) {
    if (!matchGroup(m.subject, m.pen, ruleset, ctx)) ungrouped.push(m.id);
  }
  return {
    total: population.length,
    grouped: population.length - ungrouped.length,
    ungrouped,
  };
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
  return (
    `fill ${pl.pens.join(" → ")}` +
    (pl.orderBy
      ? ` by ${labelOf(pl.orderBy.item)} ${
          pl.orderBy.dir === "desc" ? "high→low" : "low→high"
        }`
      : "")
  );
}
