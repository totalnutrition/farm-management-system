// Conformance harness for the grouping engine. Zero-dependency.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePredicateString, type Predicate } from "./query.ts";
import {
  targetPen,
  buildWorklist,
  type Ruleset,
  type GroupingMember,
} from "./grouping.ts";

const CTX = { today: "2026-05-16" };
const P = (s: string): Predicate => {
  const p = parsePredicateString(s);
  if (!p) throw new Error("bad test predicate");
  return p;
};

// Ordered ruleset: first match wins.
const RULES: Ruleset = [
  { name: "Dry", when: P("RC=6"), targetPen: "DRYLOT" },
  { name: "Fresh", when: P("RC=2 DIM=0-30"), targetPen: "FRESH" },
  { name: "Catch-all milking", when: P("RC=3;4;5"), targetPen: "MILK1" },
];

const fresh: GroupingMember = {
  id: "200",
  subject: { events: [{ code: 1, date: "2026-05-01" }] }, // RC2, DIM 15
  pen: null,
};
const dry: GroupingMember = {
  id: "050",
  subject: {
    events: [
      { code: 1, date: "2025-01-01" },
      { code: 11, date: "2026-04-01" },
    ],
  }, // RC6
  pen: "DRYLOT",
};
const virgin: GroupingMember = {
  id: "900",
  subject: { events: [] },
  pen: "HEIFER",
};

test("targetPen: first matching rule wins", () => {
  assert.deepEqual(targetPen(fresh.subject, fresh.pen, RULES, CTX), {
    pen: "FRESH",
    rule: "Fresh",
  });
  assert.deepEqual(targetPen(dry.subject, dry.pen, RULES, CTX), {
    pen: "DRYLOT",
    rule: "Dry",
  });
});

test("no rule matches ⇒ no target (animal stays put)", () => {
  assert.deepEqual(targetPen(virgin.subject, virgin.pen, RULES, CTX), {
    pen: null,
    rule: null,
  });
});

test("PEN in a rule resolves to the physical pen", () => {
  const r: Ruleset = [
    { name: "Relocate", when: P("PEN=OLD"), targetPen: "NEW" },
  ];
  assert.equal(targetPen(virgin.subject, "OLD", r, CTX).pen, "NEW");
  assert.equal(targetPen(virgin.subject, "ELSEWHERE", r, CTX).pen, null);
});

test("ordering: a later broad rule never overrides an earlier one", () => {
  const r: Ruleset = [
    { name: "Specific", when: P("RC=6"), targetPen: "CLOSEUP" },
    { name: "Broad", when: P("RC=0-9"), targetPen: "GENERAL" },
  ];
  assert.equal(targetPen(dry.subject, dry.pen, r, CTX).rule, "Specific");
});

test("buildWorklist: only physical≠target mismatches are listed", () => {
  const wl = buildWorklist([fresh, dry, virgin], RULES, CTX);
  // fresh: null → FRESH (listed); dry: DRYLOT==DRYLOT (not); virgin: no rule (not)
  assert.deepEqual(wl, [
    { id: "200", from: null, to: "FRESH", rule: "Fresh" },
  ]);
});

test("unknown item in a rule never crashes the worklist", () => {
  const bad: Ruleset = [
    { name: "Bad", when: P("NOSUCHITEM=1"), targetPen: "X" },
  ];
  assert.doesNotThrow(() => buildWorklist([fresh, dry], bad, CTX));
  assert.deepEqual(buildWorklist([fresh, dry], bad, CTX), []);
});
