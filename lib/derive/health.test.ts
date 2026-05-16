import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveItem } from "./engine.ts";
import { runQuery, type PopulationMember } from "./query.ts";
import { TREAT_EC } from "./health.ts";

const CTX = { today: "2026-05-16" };

const onHold: PopulationMember = {
  id: "1",
  subject: {
    events: [
      {
        code: TREAT_EC,
        date: "2026-05-14",
        payload: { drug: "Excede", mwUntil: "2026-05-20", bwUntil: "2026-06-10" },
      },
    ],
  },
};
const cleared: PopulationMember = {
  id: "2",
  subject: {
    events: [
      {
        code: TREAT_EC,
        date: "2026-04-01",
        payload: { drug: "Pen", mwUntil: "2026-04-06", bwUntil: "2026-04-20" },
      },
    ],
  },
};
const never: PopulationMember = { id: "3", subject: { events: [] } };

test("under withhold → DNSHIP YES, MWHOLD set", () => {
  assert.equal(deriveItem("MWHOLD", onHold.subject, CTX), "2026-05-20");
  assert.equal(deriveItem("DNSHIP", onHold.subject, CTX), "YES");
  assert.equal(deriveItem("DNSELL", onHold.subject, CTX), "YES");
});

test("withhold passed → DNSHIP no", () => {
  assert.equal(deriveItem("DNSHIP", cleared.subject, CTX), "no");
  assert.equal(deriveItem("DNSELL", cleared.subject, CTX), "no");
});

test("never treated → null / no", () => {
  assert.equal(deriveItem("MWHOLD", never.subject, CTX), null);
  assert.equal(deriveItem("DNSHIP", never.subject, CTX), "no");
  assert.equal(deriveItem("LTDAT", never.subject, CTX), null);
});

test("latest withhold across multiple treatments wins", () => {
  const s = {
    events: [
      { code: TREAT_EC, date: "2026-05-01", payload: { mwUntil: "2026-05-05" } },
      { code: TREAT_EC, date: "2026-05-14", payload: { mwUntil: "2026-05-25" } },
    ],
  };
  assert.equal(deriveItem("MWHOLD", s, CTX), "2026-05-25");
  assert.equal(deriveItem("LTDAT", s, CTX), "2026-05-14");
});

test("do-not-ship list via the same executor", () => {
  const rows = runQuery(
    {
      verb: "LIST",
      items: ["MWHOLD"],
      for: [[{ kind: "cmp", item: "DNSHIP", op: "=", value: "YES" }]],
    },
    [onHold, cleared, never],
    CTX,
  ) as Array<Record<string, unknown>>;
  assert.deepEqual(rows, [{ ID: "1", MWHOLD: "2026-05-20" }]);
});
