// Conformance: a cohort snapshot → seed events → correct derived
// state from day one. Zero-dependency node:test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { planSeed, validateSnapshot } from "./intake.ts";
import { derive } from "./engine.ts";

const CTX = { today: "2026-05-16" };

test("lactating cow: FRESH seed → LACT, DIM, RC FRESH from day one", () => {
  const r = planSeed({
    cohort: "lactating",
    animalId: "1001",
    lactation: 3,
    freshDate: "2026-04-16",
    entryDate: "2026-05-16",
  });
  assert.deepEqual(r.problems, []);
  assert.equal(r.facts.baseLactation, 2); // 3 − this FRESH
  const d = derive(
    { events: r.events, facts: r.facts },
    CTX,
    ["LACT", "DIM", "RPRO"],
  );
  assert.deepEqual(d, { LACT: 3, DIM: 30, RPRO: "FRESH" });
});

test("bred cow: BRED seed → RC BRED, DSLH/DCC from bred date", () => {
  const r = planSeed({
    cohort: "lactating",
    animalId: "1002",
    lactation: 2,
    freshDate: "2026-01-01",
    lastBredDate: "2026-03-01",
    serviceSire: "7HO1234",
    dueDate: "2026-12-05",
    entryDate: "2026-05-16",
  });
  assert.deepEqual(r.problems, []);
  const d = derive(
    { events: r.events, facts: r.facts },
    CTX,
    ["LACT", "RPRO", "DSLH", "DUE"],
  );
  assert.equal(d.LACT, 2);
  assert.equal(d.RPRO, "BRED");
  assert.equal(d.DSLH, 76); // today − 2026-03-01
  assert.equal(d.DUE, 203); // 2026-12-05 − today
});

test("dry cow: FRESH + DRY seeds → RC DRY, DDRY counts", () => {
  const r = planSeed({
    cohort: "dry",
    animalId: "1003",
    lactation: 4,
    freshDate: "2025-06-01",
    dryOffDate: "2026-04-26",
    entryDate: "2026-05-16",
  });
  assert.deepEqual(r.problems, []);
  const d = derive(
    { events: r.events, facts: r.facts },
    CTX,
    ["LACT", "RPRO", "DDRY"],
  );
  assert.deepEqual(d, { LACT: 4, RPRO: "DRY", DDRY: 20 });
});

test("open heifer: no FRESH, lactation 0, virgin", () => {
  const r = planSeed({
    cohort: "open_heifer",
    animalId: "H10",
    lactation: 0,
    birthDate: "2024-11-16",
    entryDate: "2026-05-16",
  });
  assert.deepEqual(r.problems, []);
  assert.equal(r.events.length, 0);
  const d = derive(
    { events: r.events, facts: r.facts },
    CTX,
    ["LACT", "RPRO", "AGE"],
  );
  assert.deepEqual(d, { LACT: 0, RPRO: "VIRGIN", AGE: 18 });
});

test("bred heifer: BRED seed only → RC BRED, lactation 0", () => {
  const r = planSeed({
    cohort: "bred_heifer",
    animalId: "H20",
    lactation: 0,
    birthDate: "2024-05-16",
    lastBredDate: "2026-04-01",
    serviceSire: "7HO9",
    entryDate: "2026-05-16",
  });
  assert.deepEqual(r.problems, []);
  const d = derive(
    { events: r.events, facts: r.facts },
    CTX,
    ["LACT", "RPRO"],
  );
  assert.deepEqual(d, { LACT: 0, RPRO: "BRED" });
});

test("required-by-cohort validation fires", () => {
  assert.deepEqual(
    validateSnapshot({
      cohort: "lactating",
      animalId: "",
      lactation: 0,
      entryDate: "",
    }).sort(),
    [
      "A calved cow must be in lactation 1 or more.",
      "Animal ID is required.",
      "Entry date is required.",
      "Fresh (last calving) date is required for this cohort.",
    ].sort(),
  );
  assert.deepEqual(
    validateSnapshot({
      cohort: "dry",
      animalId: "9",
      lactation: 2,
      freshDate: "2025-01-01",
      entryDate: "2026-05-16",
    }),
    ["Dry-off date is required for a dry cow."],
  );
  assert.deepEqual(
    validateSnapshot({
      cohort: "bred_heifer",
      animalId: "9",
      lactation: 0,
      entryDate: "2026-05-16",
    }),
    ["Last bred date is required for a bred heifer."],
  );
});
