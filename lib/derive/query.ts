// Query IR + executor — isomorphic, zero-dependency. The typed AST that
// both surfaces (plain-language bar, DC command line) will compile to,
// and the executor that runs it over a population of subjects using
// the Phase 2 derivation engine. DC-exact predicate semantics, with the
// range-inclusivity quirk normalized INTO the IR so it never leaks to a
// surface.

import {
  deriveItem,
  type Subject,
  type DeriveContext,
  type ItemValue,
} from "./engine.ts";
import { stats, pick, type Agg } from "./stats.ts";

export type { Agg } from "./stats.ts";
export type Verb = "LIST" | "COUNT" | "SUM" | "PCT";
export type CmpOp = "=" | "<>" | ">" | ">=" | "<" | "<=";

// One filter atom. `range` stores explicit normalized bounds — the
// DC "ascending inclusive / descending exclusive" rule is resolved at
// construction (see `range()`), so executor + surfaces never see it.
export type Atom =
  | { kind: "cmp"; item: string; op: CmpOp; value: number | string }
  | {
      kind: "range";
      item: string;
      min: number;
      max: number;
      minInclusive: boolean;
      maxInclusive: boolean;
    }
  | { kind: "set"; item: string; values: Array<number | string> };

// space = AND (atoms within a group); paren groups = OR (groups within
// a predicate). A subject passes if ANY group matches fully.
export type AndGroup = Atom[];
export type Predicate = AndGroup[];

export type Sort = { item: string; dir: "asc" | "desc" };

export type Query = {
  verb: Verb;
  items: string[]; // display items (LIST) / aggregated items (SUM)
  for?: Predicate;
  by?: Sort; // default: BY ID ascending
  agg?: Agg; // SUM aggregate (default "mean")
  pct?: Predicate; // PCT numerator condition (over the FOR denominator)
};

export type Row = Record<string, ItemValue>;
export type SumResult = { count: number } & Record<string, number | null>;
export type PctResult = {
  denominator: number;
  numerator: number;
  pct: number | null;
};
export type QueryResult = Row[] | number | SumResult | PctResult;

export type PopulationMember = { id: string; subject: Subject };

// --- DC range construction (the quirk lives ONLY here) --------------
// PEN=1-9  (ascending)  → inclusive both ends
// PEN=9-1  (descending) → exclusive both ends
export function range(item: string, a: number, b: number): Atom {
  if (a <= b) {
    return {
      kind: "range",
      item,
      min: a,
      max: b,
      minInclusive: true,
      maxInclusive: true,
    };
  }
  return {
    kind: "range",
    item,
    min: b,
    max: a,
    minInclusive: false,
    maxInclusive: false,
  };
}

// --- DC command serialization (shared by UI "show as command") -----
function atomToCmd(a: Atom): string {
  if (a.kind === "cmp") return `${a.item}${a.op}${a.value}`;
  if (a.kind === "set") return `${a.item}=${a.values.join(";")}`;
  // range: reconstruct DC text from normalized bounds
  return a.minInclusive && a.maxInclusive
    ? `${a.item}=${a.min}-${a.max}` // ascending inclusive
    : `${a.item}=${a.max}-${a.min}`; // descending exclusive
}

function predText(p: Predicate): string {
  return p.length === 1
    ? p[0].map(atomToCmd).join(" ")
    : p.map((g) => `(${g.map(atomToCmd).join(" ")})`).join("");
}

export function serializeCommand(q: Query): string {
  const parts: string[] = [q.verb];
  if (q.verb === "PCT" && q.pct && q.pct.length)
    parts.push(predText(q.pct));
  if (q.items.length) parts.push(q.items.join(" "));
  if (q.for && q.for.length) parts.push(`FOR ${predText(q.for)}`);
  if (q.by) parts.push(q.by.dir === "desc" ? "DOWNBY" : "BY", q.by.item);
  if (q.verb === "SUM" && q.agg && q.agg !== "mean")
    parts.push(`\\${q.agg.toUpperCase()}`);
  return parts.join(" ");
}

// --- DC command parsing (the power surface → IR) --------------------
function coerce(v: string): number | string {
  const n = Number(v);
  return v !== "" && Number.isFinite(n) ? n : v;
}

function parseAtom(tok: string): Atom {
  const m = tok.match(/^([A-Za-z0-9_]+)(<>|>=|<=|=|>|<)(.+)$/);
  if (!m) throw new Error(`Cannot parse condition "${tok}"`);
  const item = m[1].toUpperCase();
  const op = m[2];
  const rhs = m[3];
  if (op === "=") {
    if (rhs.includes(";")) {
      return { kind: "set", item, values: rhs.split(";").map(coerce) };
    }
    const r = rhs.match(/^(-?\d+)-(-?\d+)$/);
    if (r) return range(item, Number(r[1]), Number(r[2]));
    return { kind: "cmp", item, op: "=", value: coerce(rhs) };
  }
  return { kind: "cmp", item, op: op as CmpOp, value: coerce(rhs) };
}

function parsePredicate(s: string): Predicate | undefined {
  const t = s.trim();
  if (!t) return undefined;
  let groups: string[];
  if (t.startsWith("(")) {
    groups = [];
    const re = /\(([^()]*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) groups.push(m[1]);
    if (!groups.length) throw new Error("Unbalanced parentheses in FOR");
  } else {
    groups = [t];
  }
  return groups.map((g) =>
    g.trim().split(/\s+/).filter(Boolean).map(parseAtom),
  );
}

export function parseCommand(input: string): Query {
  const raw = input.trim();
  if (!raw) throw new Error("Empty command");
  const tokens = raw.split(/\s+/);
  const v = tokens[0].toUpperCase();
  const verb: Verb =
    v === "SHOW"
      ? "LIST"
      : v === "LIST" || v === "COUNT" || v === "SUM" || v === "PCT"
        ? (v as Verb)
        : (() => {
            throw new Error(`Unknown verb "${tokens[0]}"`);
          })();

  const AGGS = [
    "mean", "total", "min", "max", "range", "median", "stdev", "count",
  ];
  const isKw = (t: string) => /^(FOR|BY|DOWNBY)$/i.test(t);
  const isSw = (t: string) => t.startsWith("\\");
  const stop = (t: string) => isKw(t) || isSw(t);

  let i = 1;
  const head: string[] = [];
  while (i < tokens.length && !stop(tokens[i])) {
    head.push(tokens[i]);
    i++;
  }
  const items = verb === "PCT" ? [] : head.map((t) => t.toUpperCase());
  const pct =
    verb === "PCT" && head.length ? parsePredicate(head.join(" ")) : undefined;

  let forPred: Predicate | undefined;
  let by: Sort | undefined;
  let agg: Agg | undefined;
  while (i < tokens.length) {
    const tk = tokens[i];
    if (isSw(tk)) {
      const a = tk.slice(1).toLowerCase();
      if (AGGS.includes(a)) agg = a as Agg;
      i++;
      continue;
    }
    const kw = tk.toUpperCase();
    if (kw === "FOR") {
      i++;
      const pred: string[] = [];
      while (i < tokens.length && !stop(tokens[i])) {
        pred.push(tokens[i]);
        i++;
      }
      forPred = parsePredicate(pred.join(" "));
    } else if (kw === "BY" || kw === "DOWNBY") {
      i++;
      if (i >= tokens.length) throw new Error(`${kw} needs a field`);
      by = {
        item: tokens[i].toUpperCase(),
        dir: kw === "DOWNBY" ? "desc" : "asc",
      };
      i++;
    } else {
      i++;
    }
  }

  const out: Query = { verb, items, for: forPred, by };
  if (agg) out.agg = agg;
  if (pct) out.pct = pct;
  return out;
}

// --- value resolution ------------------------------------------------
// "ID" is the subject's natural key (DC's default identity / BY ID).
function resolve(
  item: string,
  m: PopulationMember,
  ctx: DeriveContext,
): ItemValue {
  if (item === "ID") return m.id;
  return deriveItem(item, m.subject, ctx);
}

function asNumber(v: ItemValue): number | null {
  if (v === null) return null;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) && v !== "" ? n : null;
}

// --- atom evaluation (missing/null fails every atom: DC excludes) ---
function evalAtom(atom: Atom, value: ItemValue): boolean {
  if (value === null || value === undefined) return false;

  if (atom.kind === "range") {
    const n = asNumber(value);
    if (n === null) return false;
    const lo = atom.minInclusive ? n >= atom.min : n > atom.min;
    const hi = atom.maxInclusive ? n <= atom.max : n < atom.max;
    return lo && hi;
  }

  if (atom.kind === "set") {
    return atom.values.some((target) => looseEq(value, target));
  }

  // cmp
  if (atom.op === "=") return looseEq(value, atom.value);
  if (atom.op === "<>") return !looseEq(value, atom.value);
  const a = asNumber(value);
  const b = asNumber(atom.value);
  if (a === null || b === null) return false; // ordered ops are numeric
  if (atom.op === ">") return a > b;
  if (atom.op === ">=") return a >= b;
  if (atom.op === "<") return a < b;
  return a <= b; // "<="
}

function looseEq(v: ItemValue, target: number | string): boolean {
  const a = asNumber(v);
  const b = asNumber(target);
  if (a !== null && b !== null) return a === b;
  return String(v) === String(target);
}

// Generic predicate evaluation, reusable anywhere a per-item value
// resolver can be supplied (executor, grouping engine, …).
export function matchPredicate(
  pred: Predicate | undefined,
  get: (item: string) => ItemValue,
): boolean {
  if (!pred || pred.length === 0) return true;
  // OR of AND-groups
  return pred.some((group) =>
    group.every((atom) => evalAtom(atom, get(atom.item))),
  );
}

// Parse a bare DC FOR-style predicate string ("RC=6 DCC>219", OR via
// () groups / ; sets). Exposed for rule authoring.
export function parsePredicateString(s: string): Predicate | undefined {
  return parsePredicate(s);
}

function matches(
  pred: Predicate | undefined,
  m: PopulationMember,
  ctx: DeriveContext,
): boolean {
  return matchPredicate(pred, (item) => resolve(item, m, ctx));
}

// --- sorting (default BY ID ascending) ------------------------------
function compare(x: ItemValue, y: ItemValue): number {
  if (x === null && y === null) return 0;
  if (x === null) return -1;
  if (y === null) return 1;
  const a = asNumber(x);
  const b = asNumber(y);
  if (a !== null && b !== null) return a - b;
  return String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0;
}

// --- executor --------------------------------------------------------
export function runQuery(
  q: Query,
  population: PopulationMember[],
  ctx: DeriveContext,
): QueryResult {
  const selected = population.filter((m) => matches(q.for, m, ctx));

  const sort: Sort = q.by ?? { item: "ID", dir: "asc" };
  selected.sort((m1, m2) => {
    const c = compare(
      resolve(sort.item, m1, ctx),
      resolve(sort.item, m2, ctx),
    );
    return sort.dir === "desc" ? -c : c;
  });

  if (q.verb === "COUNT") return selected.length;

  if (q.verb === "PCT") {
    const denominator = selected.length;
    const numerator = q.pct
      ? selected.filter((m) =>
          matchPredicate(q.pct, (item) => resolve(item, m, ctx)),
        ).length
      : denominator;
    return {
      denominator,
      numerator,
      pct:
        denominator === 0
          ? null
          : Math.round((numerator / denominator) * 1000) / 10,
    };
  }

  if (q.verb === "SUM") {
    const agg: Agg = q.agg ?? "mean";
    const out: SumResult = { count: selected.length };
    for (const item of q.items) {
      const nums: number[] = [];
      for (const m of selected) {
        const v = asNumber(resolve(item, m, ctx));
        if (v !== null) nums.push(v); // DC default ignores missing values
      }
      out[item] = pick(stats(nums), agg);
    }
    return out;
  }

  // LIST
  return selected.map((m) => {
    const row: Row = { ID: m.id };
    for (const item of q.items) row[item] = resolve(item, m, ctx);
    return row;
  });
}
