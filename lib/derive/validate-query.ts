// DairyComp-style grammar guard: enforce which item kinds may appear
// in which slot, so an impossible query (e.g. SUM of a coded field,
// BY a continuous number) fails with a clear message instead of
// silently producing junk. Used by the server action and the builder.
import { isAggregatable, isGroupable, labelOf } from "./catalog.ts";
import type { Query } from "./query.ts";

// Calc-field kinds, so the guard treats user fields by their declared
// type: num → summarizable; flag → summarizable + groupable; text →
// neither. Built-in items fall back to the static catalog rules.
export type CalcKindMap = Record<string, "num" | "flag" | "text">;

export function validateQuery(
  q: Query,
  calc: CalcKindMap = {},
): string | null {
  const aggOk = (i: string) =>
    i in calc ? calc[i] !== "text" : isAggregatable(i);
  const grpOk = (i: string) =>
    i in calc ? calc[i] === "flag" : isGroupable(i);

  if (q.verb === "SUM") {
    const bad = (q.items ?? []).filter((i) => !aggOk(i));
    if (bad.length)
      return `Can only summarize numeric items — ${bad
        .map(labelOf)
        .join(", ")} ${bad.length > 1 ? "are" : "is"} not numeric.`;
    if (!q.items || q.items.length === 0)
      return "Pick at least one numeric item to summarize.";
  }

  if (q.groupBy && q.groupBy.length) {
    const bad = q.groupBy.filter((i) => !grpOk(i));
    if (bad.length)
      return `Can't group by ${bad
        .map(labelOf)
        .join(", ")} — only category items can be grouped.`;
    if (q.verb === "LIST" || q.verb === "PCT")
      return `${q.verb === "LIST" ? "Show" : "Percentage"} can't be grouped.`;
  }

  if (q.having && !(q.groupBy && q.groupBy.length))
    return "“Having” filters groups — add a group-by first.";

  return null;
}
