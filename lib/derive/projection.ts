// Herd projection — pure, zero-dependency. Rolls the herd forward:
// lactating cows follow a Wood's lactation curve, pregnant cows /
// bred heifers enter milk at calving, cows dry off at a DIM target,
// and a cull rate attrites the herd. Curve coefficients are
// standard-science defaults, overridable. Pure: no DB/DOM.

export type Group = 1 | 2; // 1 = 1st lactation, 2 = mature
export type Curve = { a: number; b: number; c: number };
export type Curves = Record<Group, Curve>;

// Wood's incomplete-gamma defaults (illustrative, parity-split).
export const DEFAULT_CURVES: Curves = {
  1: { a: 12, b: 0.2, c: 0.004 },
  2: { a: 16, b: 0.22, c: 0.005 },
};

export function woods(
  dim: number,
  group: Group,
  curves: Curves = DEFAULT_CURVES,
): number {
  if (dim <= 0) return 0;
  const { a, b, c } = curves[group];
  return Math.max(0, a * Math.pow(dim, b) * Math.exp(-c * dim));
}

export type ProjAnimal = {
  dim: number | null; // current days in milk (lactating only)
  group: Group;
  status: "lactating" | "dry" | "bred";
  dueInDays: number | null; // days until calving (dry/bred/pregnant)
};

export type ProjParams = {
  dryAtDim: number; // dry off when DIM reaches this
  cullRatePct: number; // annual, applied as daily attrition
  curves?: Curves;
};

export type ProjPoint = {
  day: number;
  totalKg: number; // herd milk/day
  milking: number;
  dry: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function projectHerd(
  herd: ProjAnimal[],
  params: ProjParams,
  horizon: number,
  checkpoints: number[],
): ProjPoint[] {
  const curves = params.curves ?? DEFAULT_CURVES;
  const sim = herd.map((a) => ({
    dim: a.dim,
    group: a.group,
    status: a.status as "lactating" | "dry" | "bred",
    dueIn: a.dueInDays,
  }));
  const dailySurv = 1 - params.cullRatePct / 100 / 365;
  const want = new Set(checkpoints);
  const out: ProjPoint[] = [];

  for (let day = 0; day <= horizon; day++) {
    if (day > 0) {
      for (const s of sim) {
        // calving: dry cow or bred heifer reaching its due date
        if (s.dueIn !== null) {
          if (s.dueIn <= 0) {
            s.status = "lactating";
            s.dim = 0;
            s.dueIn = null;
          } else {
            s.dueIn -= 1;
          }
        }
        if (s.status === "lactating" && s.dim !== null) {
          s.dim += 1;
          if (s.dim >= params.dryAtDim) {
            s.status = "dry";
          }
        }
      }
    }
    if (want.has(day) || day === 0) {
      const surv = Math.pow(dailySurv, day);
      let kg = 0;
      let milking = 0;
      let dry = 0;
      for (const s of sim) {
        if (s.status === "lactating" && s.dim !== null && s.dim > 0) {
          kg += woods(s.dim, s.group, curves);
          milking += 1;
        } else {
          dry += 1;
        }
      }
      out.push({
        day,
        totalKg: r1(kg * surv),
        milking: Math.round(milking * surv),
        dry: Math.round(dry * surv),
      });
    }
  }
  return out;
}
