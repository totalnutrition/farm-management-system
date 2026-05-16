// Profit & loss — pure, zero-dependency. Sales (revenue) and
// purchases (cost) over a date range → gross margin, plus a
// per-category breakdown. Pure: no DB/DOM.

export type Entry = {
  kind: "sale" | "purchase";
  category: string;
  amount: number;
  date: string; // yyyy-mm-dd
};

export type Pnl = {
  revenue: number;
  cost: number;
  gross: number;
  byCategory: Record<string, { revenue: number; cost: number }>;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computePnl(
  entries: Entry[],
  from?: string,
  to?: string,
): Pnl {
  let revenue = 0;
  let cost = 0;
  const byCategory: Record<string, { revenue: number; cost: number }> = {};

  for (const e of entries) {
    if (from && e.date < from) continue;
    if (to && e.date > to) continue;
    const slot = (byCategory[e.category] ??= { revenue: 0, cost: 0 });
    if (e.kind === "sale") {
      revenue += e.amount;
      slot.revenue += e.amount;
    } else {
      cost += e.amount;
      slot.cost += e.amount;
    }
  }

  for (const k of Object.keys(byCategory)) {
    byCategory[k].revenue = r2(byCategory[k].revenue);
    byCategory[k].cost = r2(byCategory[k].cost);
  }
  return {
    revenue: r2(revenue),
    cost: r2(cost),
    gross: r2(revenue - cost),
    byCategory,
  };
}
