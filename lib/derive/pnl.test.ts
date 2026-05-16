import { test } from "node:test";
import assert from "node:assert/strict";
import { computePnl, type Entry } from "./pnl.ts";

const E: Entry[] = [
  { kind: "sale", category: "milk", amount: 5000, date: "2026-05-05" },
  { kind: "sale", category: "cull", amount: 1200, date: "2026-05-12" },
  { kind: "purchase", category: "feed", amount: 3000, date: "2026-05-03" },
  { kind: "purchase", category: "drugs", amount: 200, date: "2026-04-28" },
];

test("revenue, cost, gross + per-category", () => {
  const p = computePnl(E);
  assert.equal(p.revenue, 6200);
  assert.equal(p.cost, 3200);
  assert.equal(p.gross, 3000);
  assert.deepEqual(p.byCategory.milk, { revenue: 5000, cost: 0 });
  assert.deepEqual(p.byCategory.feed, { revenue: 0, cost: 3000 });
});

test("date range filters inclusive", () => {
  const p = computePnl(E, "2026-05-01", "2026-05-31");
  assert.equal(p.cost, 3000); // drugs (04-28) excluded
  assert.equal(p.gross, 3200);
});

test("empty / all-cost (negative gross)", () => {
  assert.deepEqual(computePnl([]), {
    revenue: 0,
    cost: 0,
    gross: 0,
    byCategory: {},
  });
  const loss = computePnl([
    { kind: "purchase", category: "feed", amount: 100, date: "2026-05-01" },
  ]);
  assert.equal(loss.gross, -100);
});
