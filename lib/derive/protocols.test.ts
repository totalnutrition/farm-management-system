// Conformance: protocol scheduling — due/overdue, done-suppression,
// enrollment + anchor gating. Zero-dependency node:test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePredicateString } from "./query.ts";
import {
  buildProtocolTasks,
  type Protocol,
  type ProtocolMember,
} from "./protocols.ts";

const CTX = { today: "2026-05-16" };

// Fresh cow, FRESH on 2026-05-02 → FDAT anchor.
const fresh: ProtocolMember = {
  id: "200",
  subject: { events: [{ code: 1, date: "2026-05-02" }] },
};
const virgin: ProtocolMember = { id: "900", subject: { events: [] } };

const PRESYNCH: Protocol = {
  name: "Presynch",
  enroll: parsePredicateString("RC=2")!,
  anchor: "FDAT",
  steps: [
    { dayOffset: 7, label: "GnRH", eventCode: 5 },
    { dayOffset: 14, label: "PGF", eventCode: 5 },
    { dayOffset: 30, label: "Breed", eventCode: 5 },
  ],
};

test("schedules from the anchor: past=overdue, today=due, future=skipped", () => {
  const t = buildProtocolTasks([fresh], [PRESYNCH], CTX);
  // FDAT 05-02: +7=05-09 (overdue), +14=05-16 (due today), +30=06-01 (future)
  assert.deepEqual(
    t.map((x) => [x.step, x.dueDate, x.status]),
    [
      ["GnRH", "2026-05-09", "overdue"],
      ["PGF", "2026-05-16", "due"],
    ],
  );
});

test("a recorded event on/after due date completes that step", () => {
  // step uses a non-repro code (40) so the completion event does not
  // change RC and the cow stays enrolled.
  const proto: Protocol = {
    name: "P",
    enroll: parsePredicateString("RC=2")!,
    anchor: "FDAT",
    steps: [
      { dayOffset: 7, label: "S1", eventCode: 40 },
      { dayOffset: 14, label: "S2", eventCode: 40 },
    ],
  };
  const done: ProtocolMember = {
    id: "201",
    subject: {
      events: [
        { code: 1, date: "2026-05-02" },
        { code: 40, date: "2026-05-10" }, // satisfies the 05-09 S1 step
      ],
    },
  };
  const t = buildProtocolTasks([done], [proto], CTX);
  assert.deepEqual(t.map((x) => x.step), ["S2"]); // S1 suppressed
});

test("not enrolled (predicate fails) → no tasks", () => {
  const dry: ProtocolMember = {
    id: "050",
    subject: {
      events: [
        { code: 1, date: "2024-01-01" },
        { code: 11, date: "2026-04-01" },
      ],
    },
  }; // RC 6, not RC 2
  assert.deepEqual(buildProtocolTasks([dry], [PRESYNCH], CTX), []);
});

test("no anchor date (virgin has no FDAT) → no tasks", () => {
  assert.deepEqual(buildProtocolTasks([virgin], [PRESYNCH], CTX), []);
});
