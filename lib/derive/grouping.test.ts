// Conformance harness for the grouping engine. Zero-dependency.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePredicateString, type Predicate } from "./query.ts";
import {
  matchGroup,
  buildWorklist,
  unmappedGroups,
  describePredicate,
  legacyPlacement,
  type Ruleset,
  type GroupingMember,
} from "./grouping.ts";

const CTX = { today: "2026-05-16" };
const P = (s: string): Predicate => {
  const p = parsePredicateString(s);
  if (!p) throw new Error("bad test predicate");
  return p;
};
const one = (pen: string) => ({ kind: "single" as const, pen });

const RULES: Ruleset = [
  { name: "Dry", when: P("RC=6"), placement: one("DRYLOT") },
  { name: "Fresh", when: P("RC=2 DIM=0-30"), placement: one("FRESH") },
  {
    name: "Catch-all milking",
    when: P("RC=3;4;5"),
    placement: one("MILK1"),
  },
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

test("matchGroup: first matching group wins", () => {
  assert.equal(matchGroup(fresh.subject, fresh.pen, RULES, CTX)?.name, "Fresh");
  assert.equal(matchGroup(dry.subject, dry.pen, RULES, CTX)?.name, "Dry");
  assert.equal(matchGroup(virgin.subject, virgin.pen, RULES, CTX), null);
});

test("ordering: a later broad group never overrides an earlier one", () => {
  const r: Ruleset = [
    { name: "Specific", when: P("RC=6"), placement: one("CLOSEUP") },
    { name: "Broad", when: P("RC=0-9"), placement: one("GENERAL") },
  ];
  assert.equal(matchGroup(dry.subject, dry.pen, r, CTX)?.name, "Specific");
});

test("buildWorklist: only physical≠resolved pen are listed", () => {
  const wl = buildWorklist([fresh, dry, virgin], RULES, CTX);
  assert.deepEqual(wl, [
    { id: "200", from: null, to: "FRESH", rule: "Fresh", overCapacity: false },
  ]);
});

test("unmapped group never produces a move", () => {
  const r: Ruleset = [
    { name: "Fresh", when: P("RC=2"), placement: { kind: "none" } },
  ];
  assert.deepEqual(buildWorklist([fresh], r, CTX), []);
  assert.deepEqual(unmappedGroups(r), ["Fresh"]);
});

test("parity split: 1st-lactation vs mature go to different pens", () => {
  const r: Ruleset = [
    {
      name: "Milking",
      when: P("RC=2;3;4;5"),
      placement: {
        kind: "parity",
        buckets: [
          { lacts: [1], pen: "MILK-H" },
          { lacts: [2, 3, 4, 5], pen: "MILK-C" },
        ],
      },
    },
  ];
  assert.equal(buildWorklist([fresh], r, CTX)[0].to, "MILK-H");
  const mature: GroupingMember = {
    id: "5",
    pen: null,
    subject: {
      events: [
        { code: 1, date: "2023-01-01" },
        { code: 11, date: "2023-11-01" },
        { code: 1, date: "2024-02-01" },
        { code: 11, date: "2024-12-01" },
        { code: 1, date: "2026-05-01" },
      ],
    },
  };
  assert.equal(buildWorklist([mature], r, CTX)[0].to, "MILK-C");
});

test("capacity split: fills first pen, overflows to the next", () => {
  const e = [{ code: 1, date: "2026-05-01" }];
  const pop = [
    { id: "1", pen: null, subject: { events: e } },
    { id: "2", pen: null, subject: { events: e } },
    { id: "3", pen: null, subject: { events: e } },
  ];
  const r: Ruleset = [
    {
      name: "High",
      when: P("RC=2"),
      placement: { kind: "capacity", pens: ["HI-1", "HI-2"] },
    },
  ];
  const wl = buildWorklist(pop, r, CTX, [
    { name: "HI-1", capacity: 2 },
    { name: "HI-2", capacity: null },
  ]);
  assert.deepEqual(
    wl.map((w) => w.to),
    ["HI-1", "HI-1", "HI-2"],
  );
});

test("item split: numeric cut sends low producers elsewhere", () => {
  const r: Ruleset = [
    {
      name: "Lactating",
      when: P("RC=2"),
      placement: {
        kind: "item",
        item: "DIM",
        cuts: [{ lt: 10, pen: "FRESH" }],
        elsePen: "MAIN",
      },
    },
  ];
  // fresh cow DIM 15 → not < 10 → elsePen
  assert.equal(buildWorklist([fresh], r, CTX)[0].to, "MAIN");
});

test("capacity is advisory: over-subscribed pen flags its moves", () => {
  const r: Ruleset = [
    { name: "All", when: P("RC=2"), placement: one("FRESH") },
  ];
  const e = [{ code: 1, date: "2026-05-01" }];
  const pop = [
    { id: "1", pen: null, subject: { events: e } },
    { id: "2", pen: null, subject: { events: e } },
  ];
  const tight = buildWorklist(pop, r, CTX, [{ name: "FRESH", capacity: 1 }]);
  assert.equal(
    tight.some((x) => x.overCapacity),
    true,
  );
  const roomy = buildWorklist(pop, r, CTX, [
    { name: "FRESH", capacity: null },
  ]);
  assert.equal(roomy.every((x) => !x.overCapacity), true);
});

test("unknown item in a rule never crashes the worklist", () => {
  const bad: Ruleset = [
    { name: "Bad", when: P("NOSUCHITEM=1"), placement: one("X") },
  ];
  assert.doesNotThrow(() => buildWorklist([fresh, dry], bad, CTX));
  assert.deepEqual(buildWorklist([fresh, dry], bad, CTX), []);
});

test("legacyPlacement adapts old target_pen / split rows", () => {
  assert.deepEqual(legacyPlacement("12", null), {
    kind: "single",
    pen: "12",
  });
  assert.equal(
    legacyPlacement(null, { firstLactation: "A", mature: "B" }).kind,
    "parity",
  );
  assert.deepEqual(legacyPlacement(null, null), { kind: "none" });
});

test("describePredicate renders plain language", () => {
  assert.equal(describePredicate(P("RC=6")), "RC is 6");
  assert.match(describePredicate(P("DIM<=21")), /Days in milk at most 21/);
  assert.equal(describePredicate(P("RPRO=DRY")), "DRY");
});
