// Units — pure, zero-dependency. Canonical storage is METRIC; this
// converts/formats at the edges only, driven by the org's unit_system.
// The engine never sees imperial; conformance tests stay canonical.

export type System = "metric" | "imperial";
export type Quantity = "mass" | "temperature" | "volume" | "length";

type Spec = {
  metric: string;
  imperial: string;
  toImperial: (v: number) => number;
  toMetric: (v: number) => number;
};

const SPECS: Record<Quantity, Spec> = {
  mass: {
    metric: "kg",
    imperial: "lb",
    toImperial: (v) => v * 2.2046226218,
    toMetric: (v) => v / 2.2046226218,
  },
  temperature: {
    metric: "°C",
    imperial: "°F",
    toImperial: (v) => v * 1.8 + 32,
    toMetric: (v) => (v - 32) / 1.8,
  },
  volume: {
    metric: "L",
    imperial: "gal",
    toImperial: (v) => v * 0.2641720524,
    toMetric: (v) => v / 0.2641720524,
  },
  length: {
    metric: "cm",
    imperial: "in",
    toImperial: (v) => v * 0.3937007874,
    toMetric: (v) => v / 0.3937007874,
  },
};

const round = (v: number, dp = 2) => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

// canonical (metric) value → the value shown in `system`
export function toDisplay(
  value: number,
  q: Quantity,
  system: System,
  dp = 2,
): number {
  const s = SPECS[q];
  return round(system === "imperial" ? s.toImperial(value) : value, dp);
}

// a value entered in `system` → canonical (metric) for storage
export function toCanonical(
  value: number,
  q: Quantity,
  system: System,
): number {
  const s = SPECS[q];
  return system === "imperial" ? s.toMetric(value) : value;
}

export function unitLabel(q: Quantity, system: System): string {
  const s = SPECS[q];
  return system === "imperial" ? s.imperial : s.metric;
}

export function formatQty(
  value: number,
  q: Quantity,
  system: System,
  dp = 2,
): string {
  return `${toDisplay(value, q, system, dp)} ${unitLabel(q, system)}`;
}
