import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "./csv.ts";

test("basic rows + header order", () => {
  assert.equal(
    toCsv([{ ID: "1", DIM: 30 }, { ID: "2", DIM: 5 }]),
    "ID,DIM\r\n1,30\r\n2,5",
  );
});

test("quotes fields with comma / quote / newline; escapes quotes", () => {
  assert.equal(
    toCsv([{ a: "x,y", b: 'he said "hi"', c: "line1\nline2" }]),
    'a,b,c\r\n"x,y","he said ""hi""","line1\nline2"',
  );
});

test("null/undefined → empty; explicit columns", () => {
  assert.equal(
    toCsv([{ a: null, b: undefined, c: 0 }], ["a", "b", "c"]),
    "a,b,c\r\n,,0",
  );
});

test("empty input → empty header line", () => {
  assert.equal(toCsv([]), "");
});
