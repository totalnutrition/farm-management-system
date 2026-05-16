// Grouping engine — isomorphic, zero-dependency. Ordered ruleset over
// derived items → each animal's TARGET pen (first match wins), with a
// within-pen parity split and capacity awareness. The worklist = where
// physical pen ≠ target. Pure: no DB/DOM.

import {
  deriveItem,
  type Subject,
  type DeriveContext,
  type ItemValue,
} from "./engine.ts";
import { matchPredicate, type Predicate } from "./query.ts";

// A rule targets a single pen, OR splits by parity (1st-lactation vs
// mature) into two pens for within-group uniformity (DC/Bovisync).
export type ParitySplit = { firstLactation: string; mature: string };
export type GroupingRule = {
  name: string;
  when: Predicate; // ordered; first matching rule wins
  targetPen?: string;
  split?: ParitySplit;
};
export type Ruleset = GroupingRule[];

export type Pen = { name: string; capacity: number | null };

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

function chosenPen(
  rule: GroupingRule,
  subject: Subject,
  ctx: DeriveContext,
): string | null {
  if (rule.split) {
    const lact = Number(deriveItem("LACT", subject, ctx) ?? 0);
    // lactation 1 (and heifers) → first-lactation pen; 2+ → mature
    return lact >= 2 ? rule.split.mature : rule.split.firstLactation;
  }
  return rule.targetPen ?? null;
}

export function targetPen(
  subject: Subject,
  physicalPen: string | null,
  ruleset: Ruleset,
  ctx: DeriveContext,
): { pen: string | null; rule: string | null } {
  const get = resolver(subject, physicalPen, ctx);
  for (const r of ruleset) {
    if (matchPredicate(r.when, get)) {
      return { pen: chosenPen(r, subject, ctx), rule: r.name };
    }
  }
  return { pen: null, rule: null };
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

// Animals whose physical pen ≠ target. No rule match ⇒ left where they
// are. Capacity is advisory: a pen the ruleset assigns more animals
// than its capacity flags every move into it `overCapacity` — the
// system surfaces it; the human decides (it never silently drops one).
export function buildWorklist(
  population: GroupingMember[],
  ruleset: Ruleset,
  ctx: DeriveContext,
  pens: Pen[] = [],
): WorklistRow[] {
  const cap = new Map<string, number | null>(
    pens.map((p) => [p.name, p.capacity]),
  );

  // pass 1: total animals the ruleset assigns to each pen (its target)
  const assigned = new Map<string, number>();
  const targets = population.map((m) => {
    const t = targetPen(m.subject, m.pen, ruleset, ctx);
    if (t.pen !== null) {
      assigned.set(t.pen, (assigned.get(t.pen) ?? 0) + 1);
    }
    return { m, t };
  });

  // pass 2: only physical≠target are moves; flag over-subscribed pens
  const out: WorklistRow[] = [];
  for (const { m, t } of targets) {
    if (t.pen !== null && t.pen !== m.pen) {
      const c = cap.get(t.pen);
      out.push({
        id: m.id,
        from: m.pen,
        to: t.pen,
        rule: t.rule!,
        overCapacity:
          c !== null && c !== undefined && (assigned.get(t.pen) ?? 0) > c,
      });
    }
  }
  return out;
}
