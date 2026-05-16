import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRation, type Material } from "./ration.ts";

const MAT: Record<string, Material> = {
  "Corn silage": { dmPct: 35, costPerKgAsFed: 0.06, cp: 8, nel: 1.5, ndf: 45 },
  "Alfalfa hay": { dmPct: 88, costPerKgAsFed: 0.25, cp: 20, nel: 1.3, ndf: 40 },
  "Corn grain": { dmPct: 88, costPerKgAsFed: 0.3, cp: 9, nel: 2.0, ndf: 9 },
};

test("DM → as-fed via DM%; cost & DM-weighted nutrients", () => {
  // 12 kg DM silage @35% DM → 34.29 kg as-fed
  const r = computeRation(
    [
      { material: "Corn silage", dmKg: 12 },
      { material: "Alfalfa hay", dmKg: 5 },
      { material: "Corn grain", dmKg: 8 },
    ],
    MAT,
  );
  assert.equal(r.lines[0].asFedKg, 34.29); // 12 / 0.35
  assert.equal(r.lines[1].asFedKg, 5.68); // 5 / 0.88
  assert.equal(r.totalDmKg, 25);
  // CP density = (12*8 + 5*20 + 8*9)/25 % = (96+100+72)/25 = 10.72
  assert.equal(r.cpPct, 10.72);
  assert.equal(
    r.totalCost,
    r2(34.2857 * 0.06 + 5.6818 * 0.25 + 9.0909 * 0.3),
  );
});

test("DM% drop → as-fed rises, DM formula held constant", () => {
  const dry = computeRation([{ material: "Corn silage", dmKg: 12 }], MAT);
  const wet = computeRation([{ material: "Corn silage", dmKg: 12 }], {
    ...MAT,
    "Corn silage": { ...MAT["Corn silage"], dmPct: 30 },
  });
  assert.equal(dry.totalDmKg, 12);
  assert.equal(wet.totalDmKg, 12); // formula unchanged
  assert.ok(wet.lines[0].asFedKg > dry.lines[0].asFedKg); // feed more wet
  assert.equal(wet.lines[0].asFedKg, 40); // 12 / 0.30
});

test("unknown material reported, not silently dropped from missing", () => {
  const r = computeRation(
    [
      { material: "Corn grain", dmKg: 5 },
      { material: "Mystery", dmKg: 3 },
    ],
    MAT,
  );
  assert.deepEqual(r.missing, ["Mystery"]);
  assert.equal(r.totalDmKg, 5);
});

function r2(n: number) {
  return Math.round(n * 100) / 100;
}
