import { test } from "node:test";
import assert from "node:assert/strict";
import { stats, pick } from "./stats.ts";

test("full stats on a known set", () => {
  const s = stats([2, 4, 4, 4, 5, 5, 7, 9])!;
  assert.equal(s.n, 8);
  assert.equal(s.mean, 5);
  assert.equal(s.total, 40);
  assert.equal(s.min, 2);
  assert.equal(s.max, 9);
  assert.equal(s.range, 7);
  assert.equal(s.median, 4.5); // (4+5)/2
  assert.equal(s.stdev, 2.14); // sample sd ≈ 2.138
});

test("odd-length median; single value sd = 0", () => {
  assert.equal(stats([3, 1, 2])!.median, 2);
  assert.equal(stats([10])!.stdev, 0);
});

test("empty → null; pick maps agg incl. count", () => {
  assert.equal(stats([]), null);
  const s = stats([1, 2, 3])!;
  assert.equal(pick(s, "mean"), 2);
  assert.equal(pick(s, "total"), 6);
  assert.equal(pick(s, "count"), 3);
  assert.equal(pick(null, "mean"), null);
});
