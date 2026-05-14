/**
 * Group-assignment rule engine.
 *
 * Each location_groups row carries a JSONB rule_predicates that the
 * engine evaluates against an animal's computed facts. The first group
 * (by display_order) whose predicates all match wins.
 *
 * Supported predicate keys (mirrors org_group_strategy_preset_groups
 * seeds in 0005_org_catalogs_presets.sql):
 *
 *   dim_min, dim_max                   - days in milk window
 *   parity                             - exact parity
 *   parity_min                         - parity >= n
 *   dry: true                          - life_stage = 'dry'
 *   pregnancy_days_min, pregnancy_days_max - days pregnant window
 *   age_months_min, age_months_max     - age window
 *   health_flag: true                  - hospitalised (animal-level flag, TBD)
 */

export type AnimalFacts = {
  id: string;
  animal_id: string;
  sex: string;
  status: string;
  life_stage: string | null;
  current_lactation: number | null;
  birth_date: string;
  last_calving_date: string | null;
  is_pregnant: boolean;
  days_pregnant: number | null;
  hospital_flag: boolean;
  /** Recent 7-day average daily kg from milkings, or null if no recent data. */
  avg_daily_milk: number | null;
};

export type GroupDef = {
  id: string;
  label: string;
  group_slug: string;
  group_class: string;
  display_order: number;
  rule_predicates: Record<string, unknown>;
};

export type Suggestion = {
  group_id: string | null;
  group_label: string | null;
  explanation: string;
};

function diffDays(from: string, nowMs: number): number {
  return Math.floor((nowMs - new Date(from).getTime()) / 86400000);
}

function ageMonths(birthDate: string, nowMs: number): number {
  return Math.floor(diffDays(birthDate, nowMs) / 30.4375);
}

function num(p: Record<string, unknown>, key: string): number | null {
  const v = p[key];
  return typeof v === "number" ? v : null;
}
function bool(p: Record<string, unknown>, key: string): boolean {
  return p[key] === true;
}

/**
 * Walk through groups in display_order and return the first match.
 * Returns the matched group + a human-readable explanation of why.
 */
export function suggestGroup(
  animal: AnimalFacts,
  groups: GroupDef[],
  nowMs: number,
): Suggestion {
  const dim = animal.last_calving_date ? diffDays(animal.last_calving_date, nowMs) : null;
  const parity = animal.current_lactation ?? 0;
  const age = ageMonths(animal.birth_date, nowMs);
  const isDry = animal.life_stage === "dry";
  const isHospital = animal.hospital_flag;
  const dp = animal.is_pregnant ? animal.days_pregnant : null;

  // Walk groups in display_order
  const sorted = [...groups].sort((a, b) => a.display_order - b.display_order);
  for (const g of sorted) {
    const p = g.rule_predicates ?? {};
    const reasons: string[] = [];

    const dimMin = num(p, "dim_min");
    const dimMax = num(p, "dim_max");
    const parityExact = num(p, "parity");
    const parityMin = num(p, "parity_min");
    const dry = bool(p, "dry");
    const healthFlag = bool(p, "health_flag");
    const pregMin = num(p, "pregnancy_days_min");
    const pregMax = num(p, "pregnancy_days_max");
    const ageMin = num(p, "age_months_min");
    const ageMax = num(p, "age_months_max");

    // DIM rules require a calving (i.e. lactating window)
    if (dimMin !== null || dimMax !== null) {
      if (dim === null) continue;
      if (dimMin !== null && dim < dimMin) continue;
      if (dimMax !== null && dim > dimMax) continue;
      reasons.push(`DIM ${dim}` + (dimMin !== null && dimMax !== null ? ` in [${dimMin}, ${dimMax}]` : dimMin !== null ? ` ≥ ${dimMin}` : ` ≤ ${dimMax}`));
    }
    // Parity
    if (parityExact !== null) {
      if (parity !== parityExact) continue;
      reasons.push(`parity = ${parityExact}`);
    }
    if (parityMin !== null) {
      if (parity < parityMin) continue;
      reasons.push(`parity ≥ ${parityMin}`);
    }
    // Dry
    if (dry) {
      if (!isDry) continue;
      reasons.push("dry");
    }
    // Hospital
    if (healthFlag) {
      if (!isHospital) continue;
      reasons.push("hospital flag");
    }
    // Pregnancy window
    if (pregMin !== null || pregMax !== null) {
      if (dp === null) continue;
      if (pregMin !== null && dp < pregMin) continue;
      if (pregMax !== null && dp > pregMax) continue;
      reasons.push(`pregnant ${dp}d` + (pregMin !== null && pregMax !== null ? ` in [${pregMin}, ${pregMax}]` : pregMin !== null ? ` ≥ ${pregMin}` : ` ≤ ${pregMax}`));
    }
    // Age window (heifers / calves)
    if (ageMin !== null || ageMax !== null) {
      if (ageMin !== null && age < ageMin) continue;
      if (ageMax !== null && age > ageMax) continue;
      reasons.push(`age ${age}mo` + (ageMin !== null && ageMax !== null ? ` in [${ageMin}, ${ageMax}]` : ageMin !== null ? ` ≥ ${ageMin}` : ` ≤ ${ageMax}`));
    }

    // Daily milk yield (lenient: if predicate exists but cow has no
    // recent milkings, skip the check rather than failing the rule —
    // farms transitioning to per-cow recording shouldn't lose all
    // grouping suggestions until every cow has data).
    const milkMin = num(p, "daily_milk_min");
    const milkMax = num(p, "daily_milk_max");
    if (milkMin !== null || milkMax !== null) {
      const m = animal.avg_daily_milk;
      if (m !== null) {
        if (milkMin !== null && m < milkMin) continue;
        if (milkMax !== null && m > milkMax) continue;
        reasons.push(
          `${m.toFixed(0)} kg/d` +
            (milkMin !== null && milkMax !== null
              ? ` in [${milkMin}, ${milkMax}]`
              : milkMin !== null
                ? ` ≥ ${milkMin}`
                : ` ≤ ${milkMax}`),
        );
      } else {
        reasons.push("milk data N/A");
      }
    }

    return {
      group_id: g.id,
      group_label: g.label,
      explanation: reasons.length > 0 ? `${g.label}: ${reasons.join(" · ")}` : g.label,
    };
  }
  return { group_id: null, group_label: null, explanation: "No matching rule." };
}

/**
 * Hash of an animal's grouping-relevant facts. Used to suppress repeat
 * suggestions for the same state (an "override" sticks until something
 * material about the cow changes).
 */
export function factsHash(animal: AnimalFacts, nowMs: number): string {
  const dim = animal.last_calving_date ? diffDays(animal.last_calving_date, nowMs) : null;
  const milkBucket =
    animal.avg_daily_milk === null
      ? "?"
      : Math.round(animal.avg_daily_milk / 2); // 2-kg buckets
  return [
    animal.life_stage ?? "",
    animal.current_lactation ?? "",
    dim ?? "",
    animal.is_pregnant ? (animal.days_pregnant ?? "") : "",
    ageMonths(animal.birth_date, nowMs),
    animal.hospital_flag ? 1 : 0,
    milkBucket,
  ].join("|");
}
