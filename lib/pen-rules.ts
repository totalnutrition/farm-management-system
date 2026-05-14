/**
 * Pen-split suggester: distribute a group's animals across its pens
 * by sorting on (parity, DIM) and slicing proportional to capacity.
 *
 * The output is intentionally just a Map<animal_id, pen_id> — the
 * caller compares against current_pen_id to flag moves.
 *
 * Capacity is a soft target. If declared capacities are missing the
 * suggester falls back to an equal split.
 */

export type SplitAnimal = {
  id: string;
  animal_id: string;
  name: string | null;
  parity: number;
  dim: number | null;
  current_pen_id: string | null;
};

export type SplitPen = {
  id: string;
  name: string;
  capacity_head: number | null;
};

export function suggestPenSplit(
  animals: SplitAnimal[],
  pens: SplitPen[],
): Map<string, string> {
  const out = new Map<string, string>();
  if (pens.length === 0) return out;
  if (pens.length === 1) {
    for (const a of animals) out.set(a.id, pens[0].id);
    return out;
  }

  // Sort animals: primiparous first (parity=1 then 2..), then DIM asc.
  // Heifers (parity=0) cluster together. Within each parity, ascending DIM.
  const sorted = [...animals].sort((a, b) => {
    if (a.parity !== b.parity) return a.parity - b.parity;
    const da = a.dim ?? Number.MAX_SAFE_INTEGER;
    const db = b.dim ?? Number.MAX_SAFE_INTEGER;
    return da - db;
  });

  // Capacities. If any pen lacks a stated capacity, fall back to equal.
  const totalDeclared = pens.reduce((s, p) => s + (p.capacity_head ?? 0), 0);
  let weights: number[];
  if (totalDeclared > 0 && pens.every((p) => (p.capacity_head ?? 0) > 0)) {
    weights = pens.map((p) => p.capacity_head ?? 1);
  } else {
    weights = pens.map(() => 1);
  }
  const weightSum = weights.reduce((s, w) => s + w, 0);

  // Compute how many cows each pen should receive (round, then redistribute).
  const targets = weights.map((w) => Math.floor((animals.length * w) / weightSum));
  let leftover = animals.length - targets.reduce((s, n) => s + n, 0);
  // Hand out leftover to pens with the largest weight first.
  const order = pens
    .map((_, i) => i)
    .sort((a, b) => weights[b] - weights[a]);
  let idx = 0;
  while (leftover > 0) {
    targets[order[idx % order.length]] += 1;
    leftover -= 1;
    idx += 1;
  }

  // Walk the sorted cow list, filling each pen in order.
  let cursor = 0;
  for (let pi = 0; pi < pens.length; pi += 1) {
    const want = targets[pi];
    for (let k = 0; k < want && cursor < sorted.length; k += 1) {
      out.set(sorted[cursor].id, pens[pi].id);
      cursor += 1;
    }
  }
  // Catch-all if rounding leaves a cow unassigned.
  for (const a of sorted) {
    if (!out.has(a.id)) out.set(a.id, pens[pens.length - 1].id);
  }
  return out;
}
