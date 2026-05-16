import { test } from "node:test";
import assert from "node:assert/strict";
import {
  woods,
  projectHerd,
  type ProjAnimal,
  type ProjParams,
} from "./projection.ts";

const P: ProjParams = { dryAtDim: 305, cullRatePct: 0 };

test("Wood's curve rises to a peak then declines", () => {
  assert.equal(woods(0, 2), 0);
  const early = woods(10, 2);
  const peak = woods(44, 2); // ~ b/c = 0.22/0.005 = 44
  const late = woods(250, 2);
  assert.ok(peak > early && peak > late);
});

test("a lactating cow advances DIM along the curve", () => {
  const herd: ProjAnimal[] = [
    { dim: 40, group: 2, status: "lactating", dueInDays: null },
  ];
  const pts = projectHerd(herd, P, 60, [0, 30, 60]);
  assert.equal(pts[0].milking, 1);
  assert.equal(pts[0].totalKg, Math.round(woods(40, 2) * 10) / 10);
  assert.equal(pts[2].totalKg, Math.round(woods(100, 2) * 10) / 10);
});

test("a bred heifer enters milk at calving", () => {
  const herd: ProjAnimal[] = [
    { dim: null, group: 1, status: "bred", dueInDays: 10 },
  ];
  const pts = projectHerd(herd, P, 40, [0, 5, 20, 40]);
  assert.equal(pts[0].milking, 0); // not yet
  assert.equal(pts[1].milking, 0); // day 5, still bred
  assert.equal(pts[2].milking, 1); // day 20, calved at day 10
  assert.ok(pts[3].totalKg > 0);
});

test("dry-off at the DIM target stops production", () => {
  const herd: ProjAnimal[] = [
    { dim: 300, group: 2, status: "lactating", dueInDays: null },
  ];
  const pts = projectHerd(herd, { ...P, dryAtDim: 305 }, 30, [0, 30]);
  assert.equal(pts[0].milking, 1);
  assert.equal(pts[1].milking, 0); // DIM passed 305 → dry
  assert.equal(pts[1].totalKg, 0);
});

test("cull rate attrites herd totals", () => {
  const herd: ProjAnimal[] = Array.from({ length: 100 }, () => ({
    dim: 60,
    group: 2 as const,
    status: "lactating" as const,
    dueInDays: null,
  }));
  const none = projectHerd(herd, { ...P, cullRatePct: 0 }, 100, [100]);
  const culled = projectHerd(
    herd,
    { ...P, cullRatePct: 30 },
    100,
    [100],
  );
  const ln = none[none.length - 1];
  const lc = culled[culled.length - 1];
  assert.ok(lc.milking < ln.milking);
  assert.ok(lc.totalKg < ln.totalKg);
});
