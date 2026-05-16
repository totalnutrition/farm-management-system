// Ration calculator — pure, zero-dependency. A ration FORMULA is
// balanced on a DRY-MATTER basis (how nutritionists work); ingredients
// are physically fed AS-FED. as-fed kg = DM kg ÷ (DM% / 100). When an
// ingredient's DM% changes (new silage moisture), as-fed recomputes to
// hold the DM formula constant. Nutrient density is DM-weighted.

export type Material = {
  dmPct: number; // dry-matter %
  costPerKgAsFed: number;
  cp?: number; // crude protein, % of DM
  nel?: number; // NEL, Mcal / kg DM
  ndf?: number; // NDF, % of DM
};
export type RecipeLine = { material: string; dmKg: number };

export type RationLine = {
  material: string;
  dmKg: number;
  asFedKg: number;
  cost: number;
};
export type RationResult = {
  lines: RationLine[];
  totalDmKg: number;
  totalAsFedKg: number;
  totalCost: number;
  costPerKgAsFed: number;
  cpPct: number; // DM-basis crude protein %
  nel: number; // Mcal / kg DM
  ndfPct: number;
  missing: string[]; // recipe materials not in the catalog
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeRation(
  recipe: RecipeLine[],
  materials: Record<string, Material>,
): RationResult {
  const lines: RationLine[] = [];
  const missing: string[] = [];
  let totalDm = 0;
  let totalAsFed = 0;
  let totalCost = 0;
  let cpDm = 0;
  let nelDm = 0;
  let ndfDm = 0;

  for (const r of recipe) {
    const m = materials[r.material];
    if (!m) {
      missing.push(r.material);
      continue;
    }
    const dmKg = r.dmKg;
    const asFedKg = m.dmPct > 0 ? dmKg / (m.dmPct / 100) : 0;
    const cost = asFedKg * m.costPerKgAsFed;
    lines.push({
      material: r.material,
      dmKg: r2(dmKg),
      asFedKg: r2(asFedKg),
      cost: r2(cost),
    });
    totalDm += dmKg;
    totalAsFed += asFedKg;
    totalCost += cost;
    cpDm += dmKg * ((m.cp ?? 0) / 100);
    nelDm += dmKg * (m.nel ?? 0);
    ndfDm += dmKg * ((m.ndf ?? 0) / 100);
  }

  return {
    lines,
    totalDmKg: r2(totalDm),
    totalAsFedKg: r2(totalAsFed),
    totalCost: r2(totalCost),
    costPerKgAsFed: totalAsFed > 0 ? r2(totalCost / totalAsFed) : 0,
    cpPct: totalDm > 0 ? r2((cpDm / totalDm) * 100) : 0,
    nel: totalDm > 0 ? r2(nelDm / totalDm) : 0,
    ndfPct: totalDm > 0 ? r2((ndfDm / totalDm) * 100) : 0,
    missing,
  };
}
