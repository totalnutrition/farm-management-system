// Server-side helpers for user calculated fields: load + compile an
// org's fields for the derive context, and validate a definition
// (syntax, key collisions, unknown refs, dependency cycles) before it
// is saved. Not a server-action module — imported by actions and by
// runQueryAction.
import { compileFormula, FormulaError, type Formula } from "@/lib/derive/formula";
import { ITEMS } from "@/lib/derive/catalog";
import type { createAdminClient } from "@/lib/supabase-admin";

type Admin = ReturnType<typeof createAdminClient>;

export type CalcKind = "num" | "flag" | "text";
export type CalcFieldRow = {
  id: string;
  key: string;
  label: string;
  expression: string;
  kind: CalcKind;
};

export type LoadedCalc = {
  rows: CalcFieldRow[];
  /** key → compiled formula, for DeriveContext.calc */
  compiled: Record<string, Formula>;
  /** key → kind, for the query grammar guard */
  kinds: Record<string, CalcKind>;
};

const BUILTIN = new Set(ITEMS.map((i) => i.value));
const KEY_RE = /^[A-Z][A-Z0-9_]{1,15}$/;

export async function loadCalcFields(
  admin: Admin,
  orgId: string,
): Promise<LoadedCalc> {
  const { data } = await admin
    .from("calculated_fields")
    .select("id, key, label, expression, kind")
    .eq("organization_id", orgId)
    .order("label");

  const rows = (data ?? []) as CalcFieldRow[];
  const compiled: Record<string, Formula> = {};
  const kinds: Record<string, CalcKind> = {};
  for (const r of rows) {
    try {
      compiled[r.key] = compileFormula(r.expression);
      kinds[r.key] = r.kind;
    } catch {
      // A field that no longer compiles (e.g. a referenced item was
      // removed) is skipped rather than breaking every query.
    }
  }
  return { rows, compiled, kinds };
}

/**
 * Validate a calc-field definition against the builtin catalog and the
 * org's existing fields. Returns an error string, or null if valid.
 * `existing` excludes the field being edited (pass its id).
 */
export function validateCalcField(
  input: { key: string; label: string; expression: string },
  existing: CalcFieldRow[],
): string | null {
  const key = input.key.trim().toUpperCase();
  if (!KEY_RE.test(key))
    return "Key must be 2–16 chars: a letter then letters/digits/underscore.";
  if (BUILTIN.has(key))
    return `“${key}” is a built-in item — pick another key.`;
  if (!input.label.trim()) return "Give the field a name.";

  let formula: Formula;
  try {
    formula = compileFormula(input.expression);
  } catch (e) {
    return e instanceof FormulaError
      ? e.message
      : "Formula could not be parsed.";
  }

  const known = new Set<string>([
    ...BUILTIN,
    "ID",
    "TODAY",
    ...existing.map((r) => r.key),
  ]);
  const unknown = formula.refs.filter((r) => !known.has(r));
  if (unknown.length)
    return `Unknown item${unknown.length > 1 ? "s" : ""}: ${unknown.join(
      ", ",
    )}.`;

  // Cycle detection across the whole calc graph including this edit.
  const graph = new Map<string, string[]>();
  for (const r of existing) {
    try {
      graph.set(r.key, compileFormula(r.expression).refs);
    } catch {
      graph.set(r.key, []);
    }
  }
  graph.set(key, formula.refs);
  const seen = new Set<string>();
  const onPath = new Set<string>();
  const hasCycle = (node: string): boolean => {
    if (onPath.has(node)) return true;
    if (seen.has(node)) return false;
    seen.add(node);
    onPath.add(node);
    for (const dep of graph.get(node) ?? [])
      if (graph.has(dep) && hasCycle(dep)) return true;
    onPath.delete(node);
    return false;
  };
  if (hasCycle(key))
    return "This formula creates a circular reference.";

  return null;
}
