import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compileFormula,
  evalFormula,
  FormulaError,
  type Cell,
} from "./formula.ts";

const CTX = { today: "2026-05-17" };
const env = (m: Record<string, Cell>) => (k: string) =>
  k in m ? m[k] : null;
const run = (src: string, m: Record<string, Cell> = {}) =>
  evalFormula(compileFormula(src), env(m), CTX);

test("arithmetic precedence + parentheses", () => {
  assert.equal(run("1 + 2 * 3"), 7);
  assert.equal(run("(1 + 2) * 3"), 9);
  assert.equal(run("2 ^ 3 ^ 2"), 512); // right-assoc
  assert.equal(run("-2 ^ 2"), 4); // unary binds: (-2)^2 per our grammar
  assert.equal(run("10 / 4"), 2.5);
  assert.equal(run("10 / 0"), null);
});

test("item references resolve through the env", () => {
  assert.equal(run("MTOT / DIM", { MTOT: 9000, DIM: 300 }), 30);
  assert.equal(run("(MILK - PMILK) * 30", { MILK: 40, PMILK: 38 }), 60);
  assert.equal(run("MILK + MISSING", { MILK: 40 }), null);
});

test("leading = is optional (Sheets style)", () => {
  assert.equal(run("=2+2"), 4);
});

test("percent postfix", () => {
  assert.equal(run("50%"), 0.5);
  assert.equal(run("PCTF% * 100", { PCTF: 3.5 }), 3.5);
});

test("comparisons and logic", () => {
  assert.equal(run("SCC > 200", { SCC: 350 }), true);
  assert.equal(run("AND(DIM > 100, MILK < 20)", { DIM: 150, MILK: 12 }), true);
  assert.equal(run("OR(FALSE, 1 = 2)"), false);
  assert.equal(run("NOT(1 = 1)"), false);
});

test("IF / IFS / SWITCH", () => {
  assert.equal(run('IF(SCC > 200, "HIGH", "OK")', { SCC: 50 }), "OK");
  assert.equal(
    run('IFS(DIM<50,"FRESH", DIM<200,"MID", TRUE,"LATE")', { DIM: 210 }),
    "LATE",
  );
  assert.equal(
    run('SWITCH(LCTGP, "1", 1, "2", 2, 9)', { LCTGP: "2" }),
    2,
  );
  assert.equal(
    run('SWITCH(LCTGP, "1", 1, 9)', { LCTGP: "3+" }),
    9,
  );
});

test("math + rounding library", () => {
  assert.equal(run("ROUND(3.14159, 2)"), 3.14);
  assert.equal(run("ROUNDUP(3.1, 0)"), 4);
  assert.equal(run("ABS(-5)"), 5);
  assert.equal(run("MIN(3, 1, 2)"), 1);
  assert.equal(run("MAX(MILK, PMILK)", { MILK: 30, PMILK: 42 }), 42);
  assert.equal(run("MOD(10, 3)"), 1);
  assert.equal(run("POWER(2, 10)"), 1024);
  assert.equal(run("SUM(1, 2, 3, MILK)", { MILK: 4 }), 10);
  assert.equal(run("AVERAGE(2, 4, 6)"), 4);
});

test("text functions and concat", () => {
  assert.equal(run('"cow " & ID', { ID: "514" }), "cow 514");
  assert.equal(run('UPPER("hi")'), "HI");
  assert.equal(run('LEFT("ABCDE", 2)'), "AB");
  assert.equal(run('LEN("hello")'), 5);
});

test("IFERROR / COALESCE trap missing & errors", () => {
  assert.equal(run("IFERROR(MILK / 0, -1)", { MILK: 5 }), -1);
  assert.equal(run("IFERROR(MISSING, 0)"), 0);
  assert.equal(run("COALESCE(MISSING, MILK, 0)", { MILK: 7 }), 7);
});

test("date helpers use injected today (no clock)", () => {
  assert.equal(run("DAYS(TODAY(), FDAT)", { FDAT: "2026-05-07" }), 10);
  assert.equal(run("TODAY()"), "2026-05-17");
});

test("collects item references, ignoring functions & literals", () => {
  const f = compileFormula('IF(SCC > 200, MILK / DIM, "x") + TODAY()');
  assert.deepEqual(f.refs.sort(), ["DIM", "MILK", "SCC"]);
});

test("syntax errors throw FormulaError", () => {
  assert.throws(() => compileFormula("1 + "), FormulaError);
  assert.throws(() => compileFormula("(1 + 2"), FormulaError);
  assert.throws(() => compileFormula('"unterminated'), FormulaError);
  assert.throws(() => compileFormula("1 2 3"), FormulaError);
  assert.throws(() => compileFormula(""), FormulaError);
});

test("unknown function is an error value, not a crash", () => {
  assert.equal(run("BOGUS(1)"), null);
});
