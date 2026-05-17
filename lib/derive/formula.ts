// Google-Sheets-style formula engine for user calculated fields.
//
// Pure, sandboxed, deterministic: no eval, no DB, no clock, no network.
// Identifiers are item references (MILK, DIM, RPRO, or other calc
// fields) resolved through an injected resolver — the spreadsheet
// equivalent of a named range. Grammar mirrors Sheets:
//
//   = + - * / ^ %         arithmetic (^ right-assoc, unary ±)
//   & = <> < <= > >=      concat & comparison
//   FN(a, b, …)           function calls (curated standard library)
//   "text"  123  TRUE     literals
//
// Full Sheets has hundreds of functions; we ship the standard set that
// covers defined-field needs (logic, math, text, a little date). Type
// errors yield #ERROR (null) like Sheets; IFERROR traps them.

export type Cell = number | string | boolean | null;
export type Resolver = (name: string) => Cell;
export type FormulaCtx = { today: string };

export class FormulaError extends Error {}

// ---------------------------------------------------------------- AST
type Node =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "ref"; name: string }
  | { t: "unary"; op: "-" | "+"; x: Node }
  | { t: "bin"; op: string; a: Node; b: Node }
  | { t: "call"; name: string; args: Node[] };

export type Formula = { ast: Node; refs: string[] };

// -------------------------------------------------------------- lexer
type Tok =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "id"; v: string }
  | { k: "op"; v: string }
  | { k: "("; }
  | { k: ")"; }
  | { k: ","; }
  | { k: "eof" };

const OPS = ["<=", ">=", "<>", "=", "<", ">", "+", "-", "*", "/", "^", "&", "%"];

function lex(src: string): Tok[] {
  const s = src.trim().replace(/^=/, "");
  const out: Tok[] = [];
  let i = 0;
  const isId = (c: string) => /[A-Za-z0-9_.]/.test(c);
  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let str = "";
      while (j < s.length) {
        if (s[j] === '"') {
          if (s[j + 1] === '"') {
            str += '"';
            j += 2;
            continue;
          }
          break;
        }
        str += s[j++];
      }
      if (j >= s.length) throw new FormulaError("Unterminated string.");
      out.push({ k: "str", v: str });
      i = j + 1;
      continue;
    }
    if (c === "(") {
      out.push({ k: "(" });
      i++;
      continue;
    }
    if (c === ")") {
      out.push({ k: ")" });
      i++;
      continue;
    }
    if (c === "," || c === ";") {
      out.push({ k: "," });
      i++;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(s[i + 1] ?? ""))) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const n = Number(s.slice(i, j));
      if (!Number.isFinite(n))
        throw new FormulaError(`Bad number "${s.slice(i, j)}".`);
      out.push({ k: "num", v: n });
      i = j;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (OPS.includes(two)) {
      out.push({ k: "op", v: two });
      i += 2;
      continue;
    }
    if (OPS.includes(c)) {
      out.push({ k: "op", v: c });
      i++;
      continue;
    }
    if (isId(c) && !/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && isId(s[j])) j++;
      out.push({ k: "id", v: s.slice(i, j) });
      i = j;
      continue;
    }
    throw new FormulaError(`Unexpected character "${c}".`);
  }
  out.push({ k: "eof" });
  return out;
}

// ------------------------------------------------------------- parser
// Precedence (low→high): comparison < concat < add < mul < power <
// unary < primary. Mirrors Google Sheets.
function parse(toks: Tok[]): Node {
  let p = 0;
  const peek = () => toks[p];
  const eat = (): Tok => toks[p++];
  const expect = (k: Tok["k"]) => {
    if (peek().k !== k) throw new FormulaError(`Expected "${k}".`);
    return eat();
  };

  const parseExpr = (): Node => parseCmp();

  const parseCmp = (): Node => {
    let a = parseConcat();
    while (peek().k === "op" && ["=", "<>", "<", "<=", ">", ">="].includes((peek() as { v: string }).v)) {
      const op = (eat() as { v: string }).v;
      a = { t: "bin", op, a, b: parseConcat() };
    }
    return a;
  };
  const parseConcat = (): Node => {
    let a = parseAdd();
    while (peek().k === "op" && (peek() as { v: string }).v === "&") {
      eat();
      a = { t: "bin", op: "&", a, b: parseAdd() };
    }
    return a;
  };
  const parseAdd = (): Node => {
    let a = parseMul();
    while (peek().k === "op" && ["+", "-"].includes((peek() as { v: string }).v)) {
      const op = (eat() as { v: string }).v;
      a = { t: "bin", op, a, b: parseMul() };
    }
    return a;
  };
  const parseMul = (): Node => {
    let a = parsePow();
    while (peek().k === "op" && ["*", "/"].includes((peek() as { v: string }).v)) {
      const op = (eat() as { v: string }).v;
      a = { t: "bin", op, a, b: parsePow() };
    }
    return a;
  };
  // Sheets binds unary minus tighter than ^ (so -2^2 = 4); ^ is
  // right-associative.
  const parsePow = (): Node => {
    const a = parseUnary();
    if (peek().k === "op" && (peek() as { v: string }).v === "^") {
      eat();
      return { t: "bin", op: "^", a, b: parsePow() };
    }
    return a;
  };
  const parseUnary = (): Node => {
    if (peek().k === "op" && ["-", "+"].includes((peek() as { v: string }).v)) {
      const op = (eat() as { v: string }).v as "-" | "+";
      return { t: "unary", op, x: parseUnary() };
    }
    return parsePostfix();
  };
  const parsePostfix = (): Node => {
    let a = parsePrimary();
    while (peek().k === "op" && (peek() as { v: string }).v === "%") {
      eat();
      a = { t: "bin", op: "/", a, b: { t: "num", v: 100 } };
    }
    return a;
  };
  const parsePrimary = (): Node => {
    const tk = peek();
    if (tk.k === "(") {
      eat();
      const e = parseExpr();
      expect(")");
      return e;
    }
    if (tk.k === "num") {
      eat();
      return { t: "num", v: tk.v };
    }
    if (tk.k === "str") {
      eat();
      return { t: "str", v: tk.v };
    }
    if (tk.k === "id") {
      eat();
      const name = tk.v;
      if (peek().k === "(") {
        eat();
        const args: Node[] = [];
        if (peek().k !== ")") {
          args.push(parseExpr());
          while (peek().k === ",") {
            eat();
            args.push(parseExpr());
          }
        }
        expect(")");
        return { t: "call", name: name.toUpperCase(), args };
      }
      const up = name.toUpperCase();
      if (up === "TRUE") return { t: "bool", v: true };
      if (up === "FALSE") return { t: "bool", v: false };
      return { t: "ref", name: up };
    }
    throw new FormulaError("Unexpected end of formula.");
  };

  const ast = parseExpr();
  if (peek().k !== "eof")
    throw new FormulaError("Unexpected trailing input in formula.");
  return ast;
}

function collectRefs(n: Node, acc: Set<string>): void {
  if (n.t === "ref") acc.add(n.name);
  else if (n.t === "unary") collectRefs(n.x, acc);
  else if (n.t === "bin") {
    collectRefs(n.a, acc);
    collectRefs(n.b, acc);
  } else if (n.t === "call") n.args.forEach((a) => collectRefs(a, acc));
}

/** Parse + collect item references. Throws FormulaError on bad syntax. */
export function compileFormula(src: string): Formula {
  if (!src || !src.trim()) throw new FormulaError("Formula is empty.");
  if (src.length > 2000) throw new FormulaError("Formula too long.");
  const ast = parse(lex(src));
  const refs = new Set<string>();
  collectRefs(ast, refs);
  return { ast, refs: [...refs] };
}

// ---------------------------------------------------------- evaluation
const numify = (v: Cell): number | null => {
  if (v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v);
  return v !== "" && Number.isFinite(n) ? n : null;
};
const boolify = (v: Cell): boolean => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (v === null) return false;
  const s = String(v).toUpperCase();
  return s === "TRUE" || (s !== "" && s !== "0" && s !== "FALSE");
};
const strify = (v: Cell): string => (v === null ? "" : String(v));

type Fn = (args: Node[], ev: (n: Node) => Cell, ctx: FormulaCtx) => Cell;

const need = (a: Node[], n: number, name: string) => {
  if (a.length < n)
    throw new FormulaError(`${name} needs ${n} argument(s).`);
};
const daysBetween = (a: string, b: string): number | null => {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.round((ta - tb) / 86400000);
};

const FNS: Record<string, Fn> = {
  IF: (a, ev) => {
    need(a, 2, "IF");
    return boolify(ev(a[0]))
      ? ev(a[1])
      : a[2] !== undefined
        ? ev(a[2])
        : false;
  },
  IFS: (a, ev) => {
    for (let i = 0; i + 1 < a.length; i += 2)
      if (boolify(ev(a[i]))) return ev(a[i + 1]);
    return null;
  },
  SWITCH: (a, ev) => {
    need(a, 3, "SWITCH");
    const key = ev(a[0]);
    let i = 1;
    for (; i + 1 < a.length; i += 2)
      if (looseEq(key, ev(a[i]))) return ev(a[i + 1]);
    return i < a.length ? ev(a[i]) : null;
  },
  AND: (a, ev) => a.every((n) => boolify(ev(n))),
  OR: (a, ev) => a.some((n) => boolify(ev(n))),
  NOT: (a, ev) => {
    need(a, 1, "NOT");
    return !boolify(ev(a[0]));
  },
  XOR: (a, ev) => a.reduce((acc, n) => acc !== boolify(ev(n)), false),
  IFERROR: (a, ev) => {
    need(a, 1, "IFERROR");
    try {
      const v = ev(a[0]);
      return v === null && a[1] !== undefined ? ev(a[1]) : v;
    } catch {
      return a[1] !== undefined ? ev(a[1]) : null;
    }
  },
  IFBLANK: (a, ev) => {
    need(a, 2, "IFBLANK");
    const v = ev(a[0]);
    return v === null || v === "" ? ev(a[1]) : v;
  },
  ISBLANK: (a, ev) => {
    const v = ev(a[0]);
    return v === null || v === "";
  },
  ISNUMBER: (a, ev) => numify(ev(a[0])) !== null,
  ISTEXT: (a, ev) => typeof ev(a[0]) === "string",
  COALESCE: (a, ev) => {
    for (const n of a) {
      const v = ev(n);
      if (v !== null && v !== "") return v;
    }
    return null;
  },
  ABS: (a, ev) => mathU(ev(a[0]), Math.abs),
  SIGN: (a, ev) => mathU(ev(a[0]), Math.sign),
  SQRT: (a, ev) => mathU(ev(a[0]), Math.sqrt),
  EXP: (a, ev) => mathU(ev(a[0]), Math.exp),
  LN: (a, ev) => mathU(ev(a[0]), Math.log),
  LOG10: (a, ev) => mathU(ev(a[0]), Math.log10),
  INT: (a, ev) => mathU(ev(a[0]), Math.floor),
  TRUNC: (a, ev) => mathU(ev(a[0]), Math.trunc),
  LOG: (a, ev) => {
    const x = numify(ev(a[0]));
    const base = a[1] !== undefined ? numify(ev(a[1])) : 10;
    return x === null || base === null || x <= 0 ? null : Math.log(x) / Math.log(base);
  },
  ROUND: (a, ev) => roundTo(ev(a[0]), a[1] ? ev(a[1]) : 0, "round"),
  ROUNDUP: (a, ev) => roundTo(ev(a[0]), a[1] ? ev(a[1]) : 0, "up"),
  ROUNDDOWN: (a, ev) => roundTo(ev(a[0]), a[1] ? ev(a[1]) : 0, "down"),
  CEILING: (a, ev) => {
    const x = numify(ev(a[0]));
    const f = a[1] !== undefined ? numify(ev(a[1])) : 1;
    return x === null || f === null || f === 0 ? null : Math.ceil(x / f) * f;
  },
  FLOOR: (a, ev) => {
    const x = numify(ev(a[0]));
    const f = a[1] !== undefined ? numify(ev(a[1])) : 1;
    return x === null || f === null || f === 0 ? null : Math.floor(x / f) * f;
  },
  MROUND: (a, ev) => {
    const x = numify(ev(a[0]));
    const m = numify(ev(a[1]));
    return x === null || m === null || m === 0 ? null : Math.round(x / m) * m;
  },
  MOD: (a, ev) => {
    const x = numify(ev(a[0]));
    const d = numify(ev(a[1]));
    return x === null || d === null || d === 0 ? null : ((x % d) + d) % d;
  },
  POWER: (a, ev) => {
    const x = numify(ev(a[0]));
    const y = numify(ev(a[1]));
    return x === null || y === null ? null : x ** y;
  },
  MIN: (a, ev) => agg(a, ev, (xs) => Math.min(...xs)),
  MAX: (a, ev) => agg(a, ev, (xs) => Math.max(...xs)),
  SUM: (a, ev) => agg(a, ev, (xs) => xs.reduce((s, x) => s + x, 0), true),
  PRODUCT: (a, ev) =>
    agg(a, ev, (xs) => xs.reduce((s, x) => s * x, 1), true),
  AVERAGE: (a, ev) =>
    agg(a, ev, (xs) => xs.reduce((s, x) => s + x, 0) / xs.length),
  COUNT: (a, ev) =>
    a.filter((n) => numify(ev(n)) !== null).length,
  CONCAT: (a, ev) => a.map((n) => strify(ev(n))).join(""),
  CONCATENATE: (a, ev) => a.map((n) => strify(ev(n))).join(""),
  LEN: (a, ev) => strify(ev(a[0])).length,
  UPPER: (a, ev) => strify(ev(a[0])).toUpperCase(),
  LOWER: (a, ev) => strify(ev(a[0])).toLowerCase(),
  TRIM: (a, ev) => strify(ev(a[0])).trim(),
  LEFT: (a, ev) =>
    strify(ev(a[0])).slice(0, a[1] ? (numify(ev(a[1])) ?? 1) : 1),
  RIGHT: (a, ev) => {
    const s = strify(ev(a[0]));
    const k = a[1] ? (numify(ev(a[1])) ?? 1) : 1;
    return s.slice(Math.max(0, s.length - k));
  },
  MID: (a, ev) => {
    const s = strify(ev(a[0]));
    const start = (numify(ev(a[1])) ?? 1) - 1;
    const len = numify(ev(a[2])) ?? 0;
    return s.slice(Math.max(0, start), Math.max(0, start) + len);
  },
  SUBSTITUTE: (a, ev) =>
    strify(ev(a[0])).split(strify(ev(a[1]))).join(strify(ev(a[2]))),
  TEXT: (a, ev) => strify(ev(a[0])),
  VALUE: (a, ev) => numify(ev(a[0])),
  N: (a, ev) => numify(ev(a[0])) ?? 0,
  TODAY: (_a, _ev, ctx) => ctx.today,
  DAYS: (a, ev) => {
    const e = daysBetween(strify(ev(a[0])), strify(ev(a[1])));
    return e;
  },
  DATEDIF: (a, ev) => {
    const d = daysBetween(strify(ev(a[1])), strify(ev(a[0])));
    return d === null ? null : Math.abs(d);
  },
};

function mathU(v: Cell, f: (n: number) => number): Cell {
  const n = numify(v);
  return n === null ? null : f(n);
}
function roundTo(v: Cell, dv: Cell, mode: "round" | "up" | "down"): Cell {
  const n = numify(v);
  const d = numify(dv) ?? 0;
  if (n === null) return null;
  const p = 10 ** d;
  const x = n * p;
  const r =
    mode === "up" ? Math.ceil(x) : mode === "down" ? Math.floor(x) : Math.round(x);
  return r / p;
}
function agg(
  a: Node[],
  ev: (n: Node) => Cell,
  f: (xs: number[]) => number,
  emptyZero = false,
): Cell {
  const xs = a.map((n) => numify(ev(n))).filter((x): x is number => x !== null);
  if (xs.length === 0) return emptyZero ? 0 : null;
  return f(xs);
}
function looseEq(a: Cell, b: Cell): boolean {
  const x = numify(a);
  const y = numify(b);
  if (x !== null && y !== null) return x === y;
  return strify(a) === strify(b);
}

function evalNode(n: Node, resolve: Resolver, ctx: FormulaCtx): Cell {
  switch (n.t) {
    case "num":
      return n.v;
    case "str":
      return n.v;
    case "bool":
      return n.v;
    case "ref":
      return resolve(n.name);
    case "unary": {
      const x = numify(evalNode(n.x, resolve, ctx));
      return x === null ? null : n.op === "-" ? -x : x;
    }
    case "call": {
      const fn = FNS[n.name];
      if (!fn) throw new FormulaError(`Unknown function ${n.name}().`);
      return fn(n.args, (m) => evalNode(m, resolve, ctx), ctx);
    }
    case "bin": {
      if (n.op === "&")
        return (
          strify(evalNode(n.a, resolve, ctx)) +
          strify(evalNode(n.b, resolve, ctx))
        );
      const av = evalNode(n.a, resolve, ctx);
      const bv = evalNode(n.b, resolve, ctx);
      if (["=", "<>", "<", "<=", ">", ">="].includes(n.op)) {
        const x = numify(av);
        const y = numify(bv);
        const cmpNum = x !== null && y !== null;
        switch (n.op) {
          case "=":
            return looseEq(av, bv);
          case "<>":
            return !looseEq(av, bv);
          case "<":
            return cmpNum ? x! < y! : strify(av) < strify(bv);
          case "<=":
            return cmpNum ? x! <= y! : strify(av) <= strify(bv);
          case ">":
            return cmpNum ? x! > y! : strify(av) > strify(bv);
          default:
            return cmpNum ? x! >= y! : strify(av) >= strify(bv);
        }
      }
      const x = numify(av);
      const y = numify(bv);
      if (x === null || y === null) return null;
      switch (n.op) {
        case "+":
          return x + y;
        case "-":
          return x - y;
        case "*":
          return x * y;
        case "/":
          return y === 0 ? null : x / y;
        case "^":
          return x ** y;
        default:
          throw new FormulaError(`Bad operator ${n.op}.`);
      }
    }
  }
}

/** Evaluate a compiled formula. Type errors return null (Sheets #ERROR). */
export function evalFormula(
  f: Formula,
  resolve: Resolver,
  ctx: FormulaCtx,
): Cell {
  try {
    const v = evalNode(f.ast, resolve, ctx);
    if (typeof v === "number") {
      if (!Number.isFinite(v)) return null;
      // Kill binary-float noise (3.5000000000000004 → 3.5) like a
      // spreadsheet's displayed value, without faking precision.
      return Math.round(v * 1e9) / 1e9;
    }
    return v;
  } catch (e) {
    if (e instanceof FormulaError) return null;
    throw e;
  }
}

/** Names of every function the engine supports (for the UI hint). */
export const FUNCTION_NAMES = Object.keys(FNS).sort();
