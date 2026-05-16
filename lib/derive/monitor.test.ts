// Conformance: KPI evaluation (count & avg, both directions, ok/warn/
// alert/nodata). Zero-dependency node:test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePredicateString, type PopulationMember } from "./query.ts";
import { evaluateKpi, type Kpi } from "./monitor.ts";

const CTX = { today: "2026-05-16" };

// 4 fresh cows (RC 2), 1 dry (RC 6).
const POP: PopulationMember[] = [
  ...["1", "2", "3", "4"].map((id) => ({
    id,
    subject: { events: [{ code: 1, date: "2026-04-16" }] },
  })),
  {
    id: "9",
    subject: {
      events: [
        { code: 1, date: "2025-01-01" },
        { code: 11, date: "2026-04-01" },
      ],
    },
  },
];

test("count KPI, higher-better: meets goal → ok", () => {
  const k: Kpi = {
    name: "Fresh cows",
    filter: parsePredicateString("RC=2"),
    metric: { kind: "count" },
    goal: 4,
    direction: "higher_better",
  };
  const r = evaluateKpi(k, POP, CTX);
  assert.equal(r.value, 4);
  assert.equal(r.status, "ok");
  assert.equal(r.deltaPct, 0);
});

test("count KPI, higher-better: shortfall grades warn then alert", () => {
  const base: Kpi = {
    name: "Fresh",
    filter: parsePredicateString("RC=2"),
    metric: { kind: "count" },
    goal: 4,
    direction: "higher_better",
  };
  // value 4, goal 4 → ok; goal 4.3 (≈7% short) → warn; goal 5 (20%) → alert
  assert.equal(evaluateKpi({ ...base, goal: 4 }, POP, CTX).status, "ok");
  assert.equal(
    evaluateKpi({ ...base, goal: 4.3 }, POP, CTX).status,
    "warn",
  );
  assert.equal(evaluateKpi({ ...base, goal: 5 }, POP, CTX).status, "alert");
});

test("avg KPI, lower-better: DIM average graded against a ceiling", () => {
  // all fresh cows: DIM = 30. lower_better goal 30 → ok; goal 28 → over
  const k: Kpi = {
    name: "Avg DIM",
    filter: parsePredicateString("RC=2"),
    metric: { kind: "avg", item: "DIM" },
    goal: 30,
    direction: "lower_better",
  };
  const r = evaluateKpi(k, POP, CTX);
  assert.equal(r.value, 30);
  assert.equal(r.status, "ok");
  // 30 vs goal 28 ≈ 7% over → warn; goal 25 (20% over) → alert
  assert.equal(evaluateKpi({ ...k, goal: 28 }, POP, CTX).status, "warn");
  assert.equal(evaluateKpi({ ...k, goal: 25 }, POP, CTX).status, "alert");
});

test("avg KPI with no matching animals → nodata", () => {
  const k: Kpi = {
    name: "Avg DIM of bred",
    filter: parsePredicateString("RC=4"),
    metric: { kind: "avg", item: "DIM" },
    goal: 100,
    direction: "lower_better",
  };
  const r = evaluateKpi(k, POP, CTX);
  assert.equal(r.value, null);
  assert.equal(r.status, "nodata");
});
