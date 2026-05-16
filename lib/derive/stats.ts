// Descriptive statistics — pure, zero-dependency. Used by the SUM
// verb's selectable aggregate (mean/total/min/max/range/median/
// stdev/count). stdev is the SAMPLE standard deviation (n−1), the
// herd-analysis convention.

export type Agg =
  | "mean"
  | "total"
  | "min"
  | "max"
  | "range"
  | "median"
  | "stdev"
  | "count";

export type Stats = {
  n: number;
  mean: number;
  total: number;
  min: number;
  max: number;
  range: number;
  median: number;
  stdev: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function stats(values: number[]): Stats | null {
  if (values.length === 0) return null;
  const v = [...values].sort((a, b) => a - b);
  const n = v.length;
  const total = v.reduce((a, b) => a + b, 0);
  const mean = total / n;
  const mid = Math.floor(n / 2);
  const median = n % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  const variance =
    n > 1
      ? v.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)
      : 0;
  return {
    n,
    mean: r2(mean),
    total: r2(total),
    min: v[0],
    max: v[n - 1],
    range: r2(v[n - 1] - v[0]),
    median: r2(median),
    stdev: r2(Math.sqrt(variance)),
  };
}

export function pick(s: Stats | null, agg: Agg): number | null {
  if (!s) return null;
  return agg === "count" ? s.n : s[agg];
}
