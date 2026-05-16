// Conformance: milking-event production — frequency-agnostic daily
// totals (2×/3×/robotic), rolling avg, lactation-to-date, components,
// linear score, lactation group, and queryable via runQuery.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveItem } from "./engine.ts";
import { runQuery, type PopulationMember } from "./query.ts";
import { MILK_EC } from "./production.ts";

const CTX = { today: "2026-05-16" };

// 3× cow: fresh 2026-05-01; milked 3×/day on the 15th and 16th.
const m = (date: string, y: number, extra = {}) => ({
  code: MILK_EC,
  date,
  payload: { yield: y, ...extra },
});
const cow: PopulationMember = {
  id: "100",
  subject: {
    events: [
      { code: 1, date: "2026-05-01" },
      m("2026-05-15", 12),
      m("2026-05-15", 13),
      m("2026-05-15", 11),
      m("2026-05-16", 13, { fat: 3.8, prot: 3.1, scc: 200 }),
      m("2026-05-16", 14),
      m("2026-05-16", 12),
    ],
  },
};

test("daily total = sum of that day's milkings (3× here)", () => {
  assert.equal(deriveItem("MILK", cow.subject, CTX), 39); // 13+14+12
  assert.equal(deriveItem("PMILK", cow.subject, CTX), 36); // 12+13+11
  assert.equal(deriveItem("PEAK", cow.subject, CTX), 39);
});

test("MAVG over last 7 days, MTOT since FRESH", () => {
  assert.equal(deriveItem("MAVG", cow.subject, CTX), 37.5); // (36+39)/2
  assert.equal(deriveItem("MTOT", cow.subject, CTX), 75); // 36+39
});

test("latest components + linear score", () => {
  assert.equal(deriveItem("PCTF", cow.subject, CTX), 3.8);
  assert.equal(deriveItem("SCC", cow.subject, CTX), 200);
  assert.equal(deriveItem("LS", cow.subject, CTX), 4); // log2(200/100)+3
});

test("lactation group from LACT", () => {
  assert.equal(deriveItem("LCTGP", cow.subject, CTX), "1"); // 1 FRESH
  const heifer = { events: [] };
  assert.equal(deriveItem("LCTGP", heifer, CTX), "H");
});

test("no milkings → null (not zero)", () => {
  assert.equal(
    deriveItem("MILK", { events: [{ code: 1, date: "2026-05-01" }] }, CTX),
    null,
  );
});

test("queryable through the same executor", () => {
  const rows = runQuery(
    {
      verb: "LIST",
      items: ["MILK", "SCC", "LCTGP"],
      for: [[{ kind: "cmp", item: "MILK", op: ">", value: 30 }]],
    },
    [cow],
    CTX,
  ) as Array<Record<string, unknown>>;
  assert.deepEqual(rows, [
    { ID: "100", MILK: 39, SCC: 200, LCTGP: "1" },
  ]);
});
