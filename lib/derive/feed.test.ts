// Conformance + the independence proof: a NON-animal subject (a pen)
// with feed events derives feed items and is queryable through the
// SAME engine/executor — no core file changed. Zero-dep node:test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveItem } from "./engine.ts";
import { runQuery, type PopulationMember } from "./query.ts";
import { FEED_EC } from "./feed.ts";

const CTX = { today: "2026-05-16" };

const pen1: PopulationMember = {
  id: "1",
  subject: {
    events: [
      { code: FEED_EC, date: "2026-05-15", payload: { kg: 1000, refused: 50, cost: 280 } },
      { code: FEED_EC, date: "2026-05-16", payload: { kg: 1000, refused: 30, cost: 280 } },
    ],
  },
};
const pen2: PopulationMember = {
  id: "2",
  subject: {
    events: [
      { code: FEED_EC, date: "2026-05-16", payload: { kg: 500, refused: 0, cost: 140 } },
    ],
  },
};
const emptyPen: PopulationMember = { id: "3", subject: { events: [] } };

test("feed items derive on a pen subject (same deriveItem)", () => {
  const s = pen1.subject;
  assert.equal(deriveItem("FEEDKG", s, CTX), 2000);
  assert.equal(deriveItem("REFKG", s, CTX), 80);
  assert.equal(deriveItem("FEEDCOST", s, CTX), 560);
  assert.equal(deriveItem("SHRINK", s, CTX), 4); // 80/2000 = 4%
});

test("no feed events → null (not a misleading zero)", () => {
  assert.equal(deriveItem("FEEDKG", emptyPen.subject, CTX), null);
  assert.equal(deriveItem("SHRINK", emptyPen.subject, CTX), null);
});

test("the SAME runQuery executor lists/aggregates feed subjects", () => {
  const rows = runQuery(
    {
      verb: "LIST",
      items: ["FEEDKG", "FEEDCOST", "SHRINK"],
      for: [[{ kind: "cmp", item: "FEEDKG", op: ">", value: 0 }]],
      by: { item: "FEEDCOST", dir: "desc" },
    },
    [pen1, pen2, emptyPen],
    CTX,
  ) as Array<Record<string, unknown>>;
  assert.deepEqual(rows, [
    { ID: "1", FEEDKG: 2000, FEEDCOST: 560, SHRINK: 4 },
    { ID: "2", FEEDKG: 500, FEEDCOST: 140, SHRINK: 0 },
  ]);

  const sum = runQuery(
    { verb: "SUM", items: ["FEEDCOST"] },
    [pen1, pen2],
    CTX,
  ) as { count: number; FEEDCOST: number | null };
  assert.equal(sum.count, 2);
  assert.equal(sum.FEEDCOST, 350); // (560 + 140) / 2
});
