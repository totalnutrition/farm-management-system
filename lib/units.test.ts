import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toDisplay,
  toCanonical,
  unitLabel,
  formatQty,
} from "./units.ts";

test("metric passes through unchanged", () => {
  assert.equal(toDisplay(100, "mass", "metric"), 100);
  assert.equal(toCanonical(100, "mass", "metric"), 100);
  assert.equal(unitLabel("mass", "metric"), "kg");
});

test("mass kg ↔ lb", () => {
  assert.equal(toDisplay(100, "mass", "imperial"), 220.46);
  assert.equal(unitLabel("mass", "imperial"), "lb");
  // round-trip canonical
  assert.equal(
    Math.round(toCanonical(toDisplay(50, "mass", "imperial"), "mass", "imperial")),
    50,
  );
});

test("temperature °C ↔ °F", () => {
  assert.equal(toDisplay(0, "temperature", "imperial"), 32);
  assert.equal(toDisplay(100, "temperature", "imperial"), 212);
  assert.equal(toCanonical(32, "temperature", "imperial"), 0);
});

test("volume L ↔ gal and formatQty", () => {
  assert.equal(toDisplay(10, "volume", "imperial"), 2.64);
  assert.equal(formatQty(100, "mass", "imperial"), "220.46 lb");
  assert.equal(formatQty(100, "mass", "metric"), "100 kg");
});
