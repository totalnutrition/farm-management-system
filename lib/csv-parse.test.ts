import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "./csv-parse.ts";

test("basic header + rows, trimming", () => {
  const p = parseCsv("a,b\n1, 2 \n3,4\n");
  assert.deepEqual(p.headers, ["a", "b"]);
  assert.deepEqual(p.rows, [
    { a: "1", b: "2" },
    { a: "3", b: "4" },
  ]);
});

test("quoted commas, escaped quotes, quoted newline, CRLF", () => {
  const p = parseCsv(
    'name,note\r\n"Doe, John","he said ""hi"""\r\n"multi\nline",x\r\n',
  );
  assert.deepEqual(p.rows, [
    { name: "Doe, John", note: 'he said "hi"' },
    { name: "multi\nline", note: "x" },
  ]);
});

test("ragged row → missing cols become empty; BOM stripped", () => {
  const p = parseCsv("﻿a,b,c\n1,2\n");
  assert.deepEqual(p.rows, [{ a: "1", b: "2", c: "" }]);
});

test("empty / header-only input", () => {
  assert.deepEqual(parseCsv(""), { headers: [], rows: [] });
  assert.deepEqual(parseCsv("a,b\n"), { headers: ["a", "b"], rows: [] });
});
