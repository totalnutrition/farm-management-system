// DairyComp-style grammar guard: enforce which item kinds may appear
// in which slot, so an impossible query (e.g. SUM of a coded field,
// BY a continuous number) fails with a clear message instead of
// silently producing junk. Used by the server action and the builder.
import { isAggregatable, isGroupable, labelOf } from "./catalog.ts";
import type { Query } from "./query.ts";

export function validateQuery(q: Query): string | null {
  if (q.verb === "SUM") {
    const bad = (q.items ?? []).filter((i) => !isAggregatable(i));
    if (bad.length)
      return `Can only summarize numeric items — ${bad
        .map(labelOf)
        .join(", ")} ${bad.length > 1 ? "are" : "is"} not numeric.`;
    if (!q.items || q.items.length === 0)
      return "Pick at least one numeric item to summarize.";
  }

  if (q.groupBy && q.groupBy.length) {
    const bad = q.groupBy.filter((i) => !isGroupable(i));
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
