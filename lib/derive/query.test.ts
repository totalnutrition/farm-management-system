// Conformance harness for the Query IR + executor. Golden cases encode
// DC-exact predicate/range/sort semantics. Zero-dependency node:test.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runQuery,
  range,
  serializeCommand,
  parseCommand,
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

test("parseCommand parses the user's example to IR", () => {
  const q = parseCommand("LIST ID RPRO FOR RC>5 DDRY=5-10 DOWNBY RPRO");
  assert.deepEqual(q, {
    verb: "LIST",
    items: ["ID", "RPRO"],
    for: [
      [
        { kind: "cmp", item: "RC", op: ">", value: 5 },
        {
          kind: "range",
          item: "DDRY",
          min: 5,
          max: 10,
          minInclusive: true,
          maxInclusive: true,
        },
      ],
    ],
    by: { item: "RPRO", dir: "desc" },
  });
});

test("parseCommand: SHOW→LIST, sets, OR groups, descending range", () => {
  assert.equal(parseCommand("SHOW ID").verb, "LIST");
  const set = parseCommand("COUNT FOR RC=0;6");
  assert.deepEqual(set.for, [
    [{ kind: "set", item: "RC", values: [0, 6] }],
  ]);
  const or = parseCommand("COUNT FOR (PEN=1)(DCC>0)");
  assert.equal(or.for?.length, 2);
  const desc = parseCommand("COUNT FOR PEN=9-1");
  assert.deepEqual(desc.for?.[0][0], {
    kind: "range",
    item: "PEN",
    min: 1,
    max: 9,
    minInclusive: false,
    maxInclusive: false,
  });
});

test("serialize ∘ parse round-trips", () => {
  for (const cmd of [
    "LIST ID PEN DIM FOR LACT>1 DIM<70 DOWNBY DIM",
    "COUNT FOR (PEN=1-9)(DCC>0)",
    "SUM LACT FOR RC=0;6 BY LACT",
  ]) {
    assert.equal(serializeCommand(parseCommand(cmd)), cmd);
  }
});

test("parseCommand rejects garbage", () => {
  assert.throws(() => parseCommand(""));
  assert.throws(() => parseCommand("FROBNICATE ID"));
  assert.throws(() => parseCommand("LIST FOR RCfoo"));
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

test("PCT: numerator over the FOR denominator", () => {
  const pop = [
    { id: "1", subject: { events: [{ code: 1, date: "2026-04-16" }] } }, // RC2 lact1
    { id: "2", subject: { events: [{ code: 1, date: "2026-04-16" }, { code: 5, date: "2026-05-01" }] } }, // RC4
    { id: "3", subject: { events: [] } }, // RC0
  ];
  const r = runQuery(
    {
      verb: "PCT",
      items: [],
      pct: [[{ kind: "cmp", item: "RC", op: "=", value: 4 }]],
      for: [[{ kind: "cmp", item: "LACT", op: ">", value: 0 }]],
    },
    pop,
    { today: "2026-05-16" },
  ) as { denominator: number; numerator: number; pct: number };
  assert.deepEqual(r, { denominator: 2, numerator: 1, pct: 50 });
});

test("SUM aggregate is selectable (median/min/max/total/stdev)", () => {
  const pop = [10, 20, 30, 40].map((n, i) => ({
    id: String(i),
    subject: { facts: { baseLactation: n }, events: [] },
  }));
  const q = (agg: "mean" | "median" | "min" | "max" | "total" | "range") =>
    (
      runQuery(
        { verb: "SUM", items: ["LACT"], agg },
        pop,
        { today: "2026-05-16" },
      ) as { LACT: number | null }
    ).LACT;
  assert.equal(q("mean"), 25);
  assert.equal(q("median"), 25);
  assert.equal(q("min"), 10);
  assert.equal(q("max"), 40);
  assert.equal(q("total"), 100);
  assert.equal(q("range"), 30);
});

test("SUM default stays mean (back-compat)", () => {
  const pop = [2, 4].map((n, i) => ({
    id: String(i),
    subject: { facts: { baseLactation: n }, events: [] },
  }));
  const r = runQuery({ verb: "SUM", items: ["LACT"] }, pop, {
    today: "2026-05-16",
  }) as { count: number; LACT: number | null };
  assert.deepEqual(r, { count: 2, LACT: 3 });
});

test("serialize∘parse round-trips PCT and the agg switch", () => {
  for (const cmd of [
    "PCT RC=4 FOR LACT>0",
    "SUM MILK FOR DDAT=0 \\MEDIAN",
    "SUM DIM \\STDEV",
  ]) {
    assert.equal(serializeCommand(parseCommand(cmd)), cmd);
  }
});

test("group-by produces per-group counts; HAVING filters groups", () => {
  const pop = [
    { id: "1", subject: { events: [{ code: 1, date: "2026-04-16" }] } },
    { id: "2", subject: { events: [{ code: 1, date: "2026-04-16" }] } },
    {
      id: "3",
      subject: {
        events: [
          { code: 1, date: "2024-01-01" },
          { code: 11, date: "2026-04-01" },
        ],
      },
    },
  ];
  const g = runQuery(
    { verb: "COUNT", items: [], groupBy: ["RPRO"] },
    pop,
    { today: "2026-05-16" },
  ) as { grouped: { group: string; count: number }[] };
  assert.deepEqual(
    g.grouped.map((r) => [r.group, r.count]).sort(),
    [["DRY", 1], ["FRESH", 2]],
  );
  const h = runQuery(
    {
      verb: "COUNT",
      items: [],
      groupBy: ["RPRO"],
      having: { op: ">", value: 1 },
    },
    pop,
    { today: "2026-05-16" },
  ) as { grouped: { group: string }[] };
  assert.deepEqual(h.grouped.map((r) => r.group), ["FRESH"]);
});

test("computed expression item (binary, no precedence)", () => {
  const pop = [
    {
      id: "1",
      subject: { facts: { baseLactation: 4 }, events: [{ code: 1, date: "2026-04-16" }] },
    },
  ];
  const r = runQuery(
    { verb: "LIST", items: ["LACT*2", "LACT+1", "DIM/2"] },
    pop,
    { today: "2026-05-16" },
  ) as Array<Record<string, unknown>>;
  // LACT = 4 (base) + 1 fresh = 5; DIM = 30
  assert.equal(r[0]["LACT*2"], 10);
  assert.equal(r[0]["LACT+1"], 6);
  assert.equal(r[0]["DIM/2"], 15);
});

test("serialize∘parse round-trips group-by + HAVING", () => {
  for (const cmd of [
    "COUNT FOR LACT>0 BY RPRO HAVING >5",
    "SUM MILK BY PEN LCTGP \\MEDIAN",
  ]) {
    assert.equal(serializeCommand(parseCommand(cmd)), cmd);
  }
});
