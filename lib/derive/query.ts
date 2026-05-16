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

export type Verb = "LIST" | "COUNT" | "SUM";
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
};

export type Row = Record<string, ItemValue>;
export type SumResult = { count: number } & Record<string, number | null>;
export type QueryResult = Row[] | number | SumResult;

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

function matches(
  pred: Predicate | undefined,
  m: PopulationMember,
  ctx: DeriveContext,
): boolean {
  if (!pred || pred.length === 0) return true;
  // OR of AND-groups
  return pred.some((group) =>
    group.every((atom) => evalAtom(atom, resolve(atom.item, m, ctx))),
  );
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

  if (q.verb === "SUM") {
    const out: SumResult = { count: selected.length };
    for (const item of q.items) {
      let sum = 0;
      let n = 0;
      for (const m of selected) {
        const v = asNumber(resolve(item, m, ctx));
        if (v !== null) {
          sum += v; // DC default ignores missing/zero-less values
          n += 1;
        }
      }
      out[item] = n === 0 ? null : sum / n;
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
