// Conformance harness for the Query IR + executor. Golden cases encode
// DC-exact predicate/range/sort semantics. Zero-dependency node:test.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runQuery,
  range,
  serializeCommand,
  type PopulationMember,
} from "./query.ts";

const CTX = { today: "2026-05-16" };

// A small herd. RC/LACT/DIM derive via the Phase 2 engine.
const POP: PopulationMember[] = [
  // virgin heifer: RC 0, LACT 0
  { id: "100", subject: { events: [] } },
  // fresh ~30 DIM, lact 1, RC 2
  { id: "200", subject: { events: [{ code: 1, date: "2026-04-16" }] } },
  // bred, lact 1, RC 4, DIM ~135
  {
    id: "300",
    subject: {
      events: [
        { code: 1, date: "2026-01-01" },
        { code: 5, date: "2026-03-01" },
      ],
    },
  },
  // dry, lact 2, RC 6
  {
    id: "050",
    subject: {
      events: [
        { code: 1, date: "2024-06-01" },
        { code: 11, date: "2025-03-01" },
        { code: 1, date: "2025-06-01" },
        { code: 11, date: "2026-04-01" },
      ],
    },
  },
];

test("LIST with AND predicate (space = AND)", () => {
  // RC=4 (bred) AND LACT=1  → only 300
  const r = runQuery(
    {
      verb: "LIST",
      items: ["RC", "LACT"],
      for: [[{ kind: "cmp", item: "RC", op: "=", value: 4 },
             { kind: "cmp", item: "LACT", op: "=", value: 1 }]],
    },
    POP,
    CTX,
  ) as Array<Record<string, unknown>>;
  assert.deepEqual(r, [{ ID: "300", RC: 4, LACT: 1 }]);
});

test("OR via two paren groups", () => {
  // (RC=0) OR (RC=6) → 100 and 050, default BY ID asc
  const r = runQuery(
    {
      verb: "LIST",
      items: ["RC"],
      for: [
        [{ kind: "cmp", item: "RC", op: "=", value: 0 }],
        [{ kind: "cmp", item: "RC", op: "=", value: 6 }],
      ],
    },
    POP,
    CTX,
  ) as Array<Record<string, unknown>>;
  assert.deepEqual(r.map((x) => x.ID), ["050", "100"]);
});

test("ascending range is inclusive (LACT=1-2)", () => {
  const r = runQuery(
    { verb: "COUNT", items: [], for: [[range("LACT", 1, 2)]] },
    POP,
    CTX,
  );
  assert.equal(r, 3); // 200(1),300(1),050(2)
});

test("descending range is EXCLUSIVE (LACT=2-1 → strictly between)", () => {
  // 2-1 exclusive → no integer strictly between 1 and 2 → none
  const r = runQuery(
    { verb: "COUNT", items: [], for: [[range("LACT", 2, 1)]] },
    POP,
    CTX,
  );
  assert.equal(r, 0);
});

test("<> excludes matching, missing also excluded", () => {
  // RC<>0 → everyone except the virgin (100). nulls n/a here.
  const r = runQuery(
    { verb: "LIST", items: ["RC"], for: [[{ kind: "cmp", item: "RC", op: "<>", value: 0 }]] },
    POP,
    CTX,
  ) as Array<Record<string, unknown>>;
  assert.deepEqual(r.map((x) => x.ID).sort(), ["050", "200", "300"]);
});

test("set membership (RC = 0;6)", () => {
  const r = runQuery(
    {
      verb: "COUNT",
      items: [],
      for: [[{ kind: "set", item: "RC", values: [0, 6] }]],
    },
    POP,
    CTX,
  );
  assert.equal(r, 2);
});

test("BY ascending and DOWNBY (desc) on a derived item", () => {
  const asc = runQuery(
    { verb: "LIST", items: ["LACT"], by: { item: "LACT", dir: "asc" } },
    POP,
    CTX,
  ) as Array<Record<string, unknown>>;
  assert.deepEqual(asc.map((x) => x.LACT), [0, 1, 1, 2]);

  const desc = runQuery(
    { verb: "LIST", items: ["LACT"], by: { item: "LACT", dir: "desc" } },
    POP,
    CTX,
  ) as Array<Record<string, unknown>>;
  assert.deepEqual(desc.map((x) => x.LACT), [2, 1, 1, 0]);
});

test("default sort is BY ID ascending", () => {
  const r = runQuery({ verb: "LIST", items: [] }, POP, CTX) as Array<
    Record<string, unknown>
  >;
  assert.deepEqual(r.map((x) => x.ID), ["050", "100", "200", "300"]);
});

test("COUNT respects the predicate", () => {
  const r = runQuery(
    { verb: "COUNT", items: [], for: [[{ kind: "cmp", item: "LACT", op: ">", value: 0 }]] },
    POP,
    CTX,
  );
  assert.equal(r, 3);
});

test("SUM gives count + average, ignoring nulls (DC default)", () => {
  // LACT across all 4: values 0,1,1,2 → avg 1; DIM has nulls (virgin)
  const r = runQuery({ verb: "SUM", items: ["LACT"] }, POP, CTX) as {
    count: number;
    LACT: number | null;
  };
  assert.equal(r.count, 4);
  assert.equal(r.LACT, 1);
});

test("serializeCommand round-trips IR to DC syntax", () => {
  assert.equal(
    serializeCommand({
      verb: "LIST",
      items: ["ID", "PEN", "DIM"],
      for: [[{ kind: "cmp", item: "LACT", op: ">", value: 1 },
             { kind: "cmp", item: "DIM", op: "<", value: 70 }]],
      by: { item: "DIM", dir: "desc" },
    }),
    "LIST ID PEN DIM FOR LACT>1 DIM<70 DOWNBY DIM",
  );
  // OR groups + the range quirk preserved in the command text
  assert.equal(
    serializeCommand({
      verb: "COUNT",
      items: [],
      for: [[range("PEN", 1, 9)], [range("PEN", 9, 1)]],
    }),
    "COUNT FOR (PEN=1-9)(PEN=9-1)",
  );
});

test("the range quirk is normalized INTO the IR (never leaks)", () => {
  const asc = range("PEN", 1, 9);
  const desc = range("PEN", 9, 1);
  assert.deepEqual(asc, {
    kind: "range", item: "PEN", min: 1, max: 9,
    minInclusive: true, maxInclusive: true,
  });
  assert.deepEqual(desc, {
    kind: "range", item: "PEN", min: 1, max: 9,
    minInclusive: false, maxInclusive: false,
  });
});
