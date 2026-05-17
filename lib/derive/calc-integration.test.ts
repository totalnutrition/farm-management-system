import { test } from "node:test";
import assert from "node:assert/strict";
import { runQuery, type PopulationMember } from "./query.ts";
import { compileFormula } from "./formula.ts";
import { EC } from "./engine.ts";

// A cow fresh 2026-02-06 → DIM = 100 as of 2026-05-17.
const pop: PopulationMember[] = [
  {
    id: "100",
    subject: {
      events: [{ code: EC.FRESH, date: "2026-02-06", payload: {} }],
    },
  },
];
const ctx = {
  today: "2026-05-17",
  calc: {
    // weeks in milk from the built-in DIM item
    WIM: compileFormula("ROUND(DIM / 7, 1)"),
    // a flag calc field, used downstream
    FRESHFLAG: compileFormula("IF(DIM < 150, 1, 0)"),
    // references another calc field (chained)
    DBL: compileFormula("WIM * 2"),
  },
};

test("calc field is resolvable as a LIST column", () => {
  const rows = runQuery(
    { verb: "LIST", items: ["ID", "DIM", "WIM", "DBL"] },
    pop,
    ctx,
  ) as Array<Record<string, unknown>>;
  assert.equal(rows[0].DIM, 100);
  assert.equal(rows[0].WIM, 14.3);
  assert.equal(rows[0].DBL, 28.6); // chained calc → calc
});

test("calc field works in a FOR predicate", () => {
  const n = runQuery(
    {
      verb: "COUNT",
      items: [],
      for: [[{ kind: "cmp", item: "FRESHFLAG", op: "=", value: 1 }]],
    },
    pop,
    ctx,
  );
  assert.equal(n, 1);
});

test("calc field can be summarized", () => {
  const out = runQuery(
    { verb: "SUM", items: ["WIM"], agg: "mean" },
    pop,
    ctx,
  ) as Record<string, number>;
  assert.equal(out.WIM, 14.3);
});

test("circular calc definitions resolve to null, not a hang", () => {
  const bad = {
    today: "2026-05-17",
    calc: {
      A: compileFormula("B + 1"),
      B: compileFormula("A + 1"),
    },
  };
  const rows = runQuery(
    { verb: "LIST", items: ["ID", "A"] },
    pop,
    bad,
  ) as Array<Record<string, unknown>>;
  assert.equal(rows[0].A, null);
});
