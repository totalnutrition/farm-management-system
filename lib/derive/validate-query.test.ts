import { test } from "node:test";
import assert from "node:assert/strict";
import { validateQuery } from "./validate-query.ts";
import type { Query } from "./query.ts";

test("SUM rejects non-numeric items", () => {
  assert.match(
    validateQuery({ verb: "SUM", items: ["RPRO"] } as Query) ?? "",
    /numeric/,
  );
  assert.equal(
    validateQuery({ verb: "SUM", items: ["MILK", "DIM"] } as Query),
    null,
  );
});

test("SUM needs at least one item", () => {
  assert.match(
    validateQuery({ verb: "SUM", items: [] } as Query) ?? "",
    /at least one/,
  );
});

test("group-by rejects continuous numbers / dates", () => {
  assert.match(
    validateQuery({
      verb: "COUNT",
      items: [],
      groupBy: ["MILK"],
    } as Query) ?? "",
    /category/,
  );
  assert.match(
    validateQuery({
      verb: "COUNT",
      items: [],
      groupBy: ["FDAT"],
    } as Query) ?? "",
    /category/,
  );
});

test("group-by accepts category items", () => {
  assert.equal(
    validateQuery({
      verb: "COUNT",
      items: [],
      groupBy: ["RPRO", "LACT"],
    } as Query),
    null,
  );
});

test("LIST / PCT cannot be grouped", () => {
  assert.match(
    validateQuery({
      verb: "LIST",
      items: ["ID"],
      groupBy: ["RPRO"],
    } as Query) ?? "",
    /can't be grouped/,
  );
});

test("having requires a group-by", () => {
  assert.match(
    validateQuery({
      verb: "COUNT",
      items: [],
      having: { op: ">", value: 5 },
    } as Query) ?? "",
    /group-by/,
  );
  assert.equal(
    validateQuery({
      verb: "COUNT",
      items: [],
      groupBy: ["RPRO"],
      having: { op: ">", value: 5 },
    } as Query),
    null,
  );
});

test("plain queries pass", () => {
  assert.equal(
    validateQuery({ verb: "LIST", items: ["ID", "RPRO", "DIM"] } as Query),
    null,
  );
  assert.equal(validateQuery({ verb: "COUNT", items: [] } as Query), null);
});
