import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveItem, type Event } from "./engine.ts";
import { runQuery, type PopulationMember } from "./query.ts";
import { FLAG_EC } from "./flags.ts";

const CTX = { today: "2026-05-16" };
const flag = (
  date: string,
  p: Record<string, unknown>,
): Event => ({
  code: FLAG_EC,
  date,
  payload: p,
});

test("marked → ATTN = activity, FLAGGED YES", () => {
  const s = { events: [flag("2026-05-15", { activity: "HEAT" })] };
  assert.equal(deriveItem("ATTN", s, CTX), "HEAT");
  assert.equal(deriveItem("FLAGGED", s, CTX), "YES");
});

test("mark then clear → resolved", () => {
  const s = {
    events: [
      flag("2026-05-15", { activity: "SICK" }),
      flag("2026-05-16", { cleared: true }),
    ],
  };
  assert.equal(deriveItem("ATTN", s, CTX), null);
  assert.equal(deriveItem("FLAGGED", s, CTX), "no");
});

test("clear then re-mark → flagged again (latest wins)", () => {
  const s = {
    events: [
      flag("2026-05-10", { activity: "LAME" }),
      flag("2026-05-12", { cleared: true }),
      flag("2026-05-15", { activity: "WOUND" }),
    ],
  };
  assert.equal(deriveItem("ATTN", s, CTX), "WOUND");
  assert.equal(deriveItem("FLAGGED", s, CTX), "YES");
});

test("never flagged → null / no", () => {
  assert.equal(deriveItem("ATTN", { events: [] }, CTX), null);
  assert.equal(deriveItem("FLAGGED", { events: [] }, CTX), "no");
});

test("attention list via the same executor", () => {
  const a: PopulationMember = {
    id: "1",
    subject: { events: [flag("2026-05-15", { activity: "CHECK" })] },
  };
  const b: PopulationMember = {
    id: "2",
    subject: {
      events: [
        flag("2026-05-15", { activity: "SICK" }),
        flag("2026-05-16", { cleared: true }),
      ],
    },
  };
  const rows = runQuery(
    {
      verb: "LIST",
      items: ["ATTN"],
      for: [[{ kind: "cmp", item: "FLAGGED", op: "=", value: "YES" }]],
    },
    [a, b],
    CTX,
  ) as Array<Record<string, unknown>>;
  assert.deepEqual(rows, [{ ID: "1", ATTN: "CHECK" }]);
});
