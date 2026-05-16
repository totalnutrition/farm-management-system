// Behavioral conformance harness: golden cases encoding documented
// DC305 behaviour (input events → expected derived state). Run with
// the zero-dependency built-in runner:  npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  derive,
  deriveItem,
  register,
  getFormula,
  provenanceReport,
  type Subject,
} from "./engine.ts";

const CTX = { today: "2026-05-16" };

type Golden = {
  name: string;
  subject: Subject;
  expect: Record<string, number | string | null>;
};

const GOLDEN: Golden[] = [
  {
    name: "virgin heifer — no events",
    subject: { events: [] },
    expect: { RC: 0, RPRO: "VIRGIN", LACT: 0, FDAT: null, DIM: null },
  },
  {
    name: "FRESH → new lactation, FRESH status, DIM counts",
    subject: { events: [{ code: 1, date: "2026-04-16" }] },
    expect: { RC: 2, RPRO: "FRESH", LACT: 1, FDAT: "2026-04-16", DIM: 30 },
  },
  {
    name: "FRESH then BRED → BRED",
    subject: {
      events: [
        { code: 1, date: "2026-02-01" },
        { code: 5, date: "2026-04-01" },
      ],
    },
    expect: { RC: 4, RPRO: "BRED", LACT: 1 },
  },
  {
    name: "FRESH, BRED, DRY → DRY with DDRY counted",
    subject: {
      events: [
        { code: 1, date: "2025-06-01" },
        { code: 5, date: "2025-08-01" },
        { code: 11, date: "2026-04-26" },
      ],
    },
    expect: { RC: 6, RPRO: "DRY", DDRY: 20 },
  },
  {
    name: "second FRESH starts lactation 2",
    subject: {
      events: [
        { code: 1, date: "2024-01-10" },
        { code: 11, date: "2024-11-10" },
        { code: 1, date: "2025-02-10" },
      ],
    },
    expect: { LACT: 2, RC: 2, FDAT: "2025-02-10" },
  },
  {
    name: "DNB sets Do-Not-Breed; later BRED clears it",
    subject: { events: [{ code: 13, date: "2026-01-01" }] },
    expect: { RC: 1, RPRO: "DNB" },
  },
  {
    name: "DNB then BRED → BRED (DNB cleared)",
    subject: {
      events: [
        { code: 13, date: "2026-01-01" },
        { code: 5, date: "2026-02-01" },
      ],
    },
    expect: { RC: 4, RPRO: "BRED" },
  },
  {
    name: "DIED → SLD/DIE",
    subject: {
      events: [
        { code: 1, date: "2025-01-01" },
        { code: 15, date: "2026-01-01" },
      ],
    },
    expect: { RC: 7, RPRO: "SLD/DIE" },
  },
  {
    name: "BRED then ABORT → OPEN (inferred branch)",
    subject: {
      events: [
        { code: 1, date: "2025-09-01" },
        { code: 5, date: "2025-12-01" },
        { code: 12, date: "2026-02-01" },
      ],
    },
    expect: { RC: 3, RPRO: "OPEN" },
  },
  {
    name: "AGE from intake birth date (whole months)",
    subject: { events: [], facts: { birthDate: "2024-05-16" } },
    expect: { AGE: 24 },
  },
  {
    name: "DUE = expected calving − today",
    subject: { events: [], facts: { dueDate: "2026-06-15" } },
    expect: { DUE: 30 },
  },
];

for (const g of GOLDEN) {
  test(`golden: ${g.name}`, () => {
    const got = derive(g.subject, CTX, Object.keys(g.expect));
    assert.deepEqual(got, g.expect);
  });
}

test("provenance is tagged on every formula", () => {
  const rep = provenanceReport();
  assert.equal(rep.DIM, "confirmed");
  assert.equal(rep.RC, "confirmed");
  assert.equal(rep.DOPN, "inferred", "unconfirmed formulas must say so");
  for (const p of Object.values(rep)) {
    assert.ok(
      ["confirmed", "standard-science", "inferred"].includes(p),
      `bad provenance: ${p}`,
    );
  }
});

test("registry is pluggable — a formula can be swapped", () => {
  const original = getFormula("DIM");
  assert.ok(original);
  register({
    item: "DIM",
    provenance: "standard-science",
    compute: () => 999,
  });
  assert.equal(deriveItem("DIM", { events: [] }, CTX), 999);
  register(original); // restore
  assert.equal(provenanceReport().DIM, "confirmed");
});

test("unknown item throws (no silent wrong answers)", () => {
  assert.throws(() => deriveItem("NOPE", { events: [] }, CTX));
});
