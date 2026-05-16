// Monitor — isomorphic, zero-dependency. A KPI = a population filter
// + a metric (count, or average of an item) + a goal. evaluateKpi
// computes the current value via the Phase 3 executor and grades it
// ok / warn / alert / nodata against the goal. Pure: no DB/DOM.

import {
  runQuery,
  type Predicate,
  type PopulationMember,
  type Query,
} from "./query.ts";
import type { DeriveContext } from "./engine.ts";

export type Metric = { kind: "count" } | { kind: "avg"; item: string };
export type Direction = "higher_better" | "lower_better";

export type Kpi = {
  name: string;
  filter?: Predicate; // which animals the KPI is about
  metric: Metric;
  goal: number;
  direction: Direction;
  warnPct?: number; // % off goal → warn (default 5)
  alertPct?: number; // % off goal → alert (default 15)
};

export type KpiStatus = "ok" | "warn" | "alert" | "nodata";
export type KpiResult = {
  name: string;
  value: number | null;
  goal: number;
  status: KpiStatus;
  deltaPct: number | null; // signed: (value − goal) / |goal| · 100
};

export function evaluateKpi(
  kpi: Kpi,
  population: PopulationMember[],
  ctx: DeriveContext,
): KpiResult {
  const q: Query =
    kpi.metric.kind === "count"
      ? { verb: "COUNT", items: [], for: kpi.filter }
      : { verb: "SUM", items: [kpi.metric.item], for: kpi.filter };

  const res = runQuery(q, population, ctx);
  let value: number | null;
  if (typeof res === "number") {
    value = res; // COUNT
  } else if (Array.isArray(res)) {
    value = res.length;
  } else {
    // KPI queries are always plain COUNT/SUM (no groupBy/pct) → SumResult
    const sum = res as { count: number } & Record<string, number | null>;
    const v = sum[kpi.metric.kind === "avg" ? kpi.metric.item : "count"];
    value = typeof v === "number" ? v : null;
  }

  if (value === null) {
    return { name: kpi.name, value: null, goal: kpi.goal, status: "nodata", deltaPct: null };
  }

  const warn = kpi.warnPct ?? 5;
  const alert = kpi.alertPct ?? 15;
  const denom = Math.abs(kpi.goal) || 1;
  const deltaPct = ((value - kpi.goal) / denom) * 100;
  // "off" is how far we are in the BAD direction (positive = bad)
  const off =
    kpi.direction === "higher_better"
      ? kpi.goal - value
      : value - kpi.goal;
  const offPct = (off / denom) * 100;

  let status: KpiStatus;
  if (offPct <= 0) status = "ok";
  else if (offPct >= alert) status = "alert";
  else if (offPct >= warn) status = "warn";
  else status = "ok";

  return { name: kpi.name, value, goal: kpi.goal, status, deltaPct };
}
