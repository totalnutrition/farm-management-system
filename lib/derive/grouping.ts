// Grouping engine — isomorphic, zero-dependency. Computes each animal's
// TARGET pen from an ordered ruleset over derived items, then the
// pen-move worklist = where physical pen ≠ target. Pure: no DB/DOM.

import {
  deriveItem,
  type Subject,
  type DeriveContext,
  type ItemValue,
} from "./engine.ts";
import { matchPredicate, type Predicate } from "./query.ts";

export type GroupingRule = {
  name: string;
  when: Predicate; // ordered; first matching rule wins
  targetPen: string;
};
export type Ruleset = GroupingRule[];

// Resolve an item for rule evaluation: PEN = the physical pen the
// animal is currently in; everything else is engine-derived. Unknown
// items resolve to null (a bad rule simply never matches — it must
// not crash a herd-wide worklist).
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

export function targetPen(
  subject: Subject,
  physicalPen: string | null,
  ruleset: Ruleset,
  ctx: DeriveContext,
): { pen: string | null; rule: string | null } {
  const get = resolver(subject, physicalPen, ctx);
  for (const r of ruleset) {
    if (matchPredicate(r.when, get)) {
      return { pen: r.targetPen, rule: r.name };
    }
  }
  return { pen: null, rule: null };
}

export type WorklistRow = {
  id: string;
  from: string | null;
  to: string;
  rule: string;
};

export type GroupingMember = {
  id: string;
  subject: Subject;
  pen: string | null; // current physical pen
};

// Animals whose physical pen differs from where the ruleset says they
// should be. No rule match ⇒ left where they are (not on the list).
export function buildWorklist(
  population: GroupingMember[],
  ruleset: Ruleset,
  ctx: DeriveContext,
): WorklistRow[] {
  const out: WorklistRow[] = [];
  for (const m of population) {
    const t = targetPen(m.subject, m.pen, ruleset, ctx);
    if (t.pen !== null && t.pen !== m.pen) {
      out.push({ id: m.id, from: m.pen, to: t.pen, rule: t.rule! });
    }
  }
  return out;
}
