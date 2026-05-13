export type HerdProfile = {
  target_lactating_count: number;
  target_dry_count: number;
  target_heifer_count: number;
  target_calf_count: number;
  pct_primiparous: number;
  calving_interval_days: number;
  replacement_rate_pct: number;
  target_rolling_herd_avg_kg_yr: number | null;
  notes: string | null;
};

export const HerdProfileDefaults: HerdProfile = {
  target_lactating_count: 0,
  target_dry_count: 0,
  target_heifer_count: 0,
  target_calf_count: 0,
  pct_primiparous: 35,
  calving_interval_days: 395,
  replacement_rate_pct: 35,
  target_rolling_herd_avg_kg_yr: null,
  notes: null,
};

/**
 * Total herd size for sizing-related calculations.
 */
export function totalHerd(p: HerdProfile): number {
  return (
    p.target_lactating_count +
    p.target_dry_count +
    p.target_heifer_count +
    p.target_calf_count
  );
}

/**
 * Picks the recommended strategy preset slug given herd size.
 * Mirrors the ranges in `org_group_strategy_presets` seed rows.
 */
export function suggestStrategySlug(lactatingCount: number): string {
  if (lactatingCount < 100) return "single-group";
  if (lactatingCount < 300) return "2-group";
  if (lactatingCount < 800) return "3-group";
  return "4-group";
}

export type LocationGroup = {
  id: string;
  location_id: string;
  preset_slug: string | null;
  group_slug: string;
  label: string;
  group_class: string;
  display_order: number;
  rule_predicates: Record<string, unknown>;
  is_custom: boolean;
};

export const GroupClassView: Record<string, string> = {
  lactating: "Lactating",
  dry: "Dry",
  transition: "Transition",
  special: "Special",
  heifer: "Heifer",
  calf: "Calf",
};

/**
 * Pretty-prints rule predicates for display.
 */
export function describePredicates(predicates: Record<string, unknown>): string {
  const parts: string[] = [];

  const dimMin = predicates.dim_min as number | undefined;
  const dimMax = predicates.dim_max as number | undefined;
  if (dimMin !== undefined || dimMax !== undefined) {
    if (dimMin !== undefined && dimMax !== undefined) {
      parts.push(`DIM ${dimMin}–${dimMax}`);
    } else if (dimMin !== undefined) {
      parts.push(`DIM ≥${dimMin}`);
    } else if (dimMax !== undefined) {
      parts.push(`DIM ≤${dimMax}`);
    }
  }

  const pregMin = predicates.pregnancy_days_min as number | undefined;
  const pregMax = predicates.pregnancy_days_max as number | undefined;
  if (pregMin !== undefined || pregMax !== undefined) {
    if (pregMin !== undefined && pregMax !== undefined) {
      parts.push(`pregnancy ${pregMin}–${pregMax} d`);
    } else if (pregMin !== undefined) {
      parts.push(`pregnancy ≥${pregMin} d`);
    } else if (pregMax !== undefined) {
      parts.push(`pregnancy ≤${pregMax} d`);
    }
  }

  if (predicates.parity !== undefined) {
    parts.push(`parity = ${predicates.parity}`);
  }
  if (predicates.parity_min !== undefined) {
    parts.push(`parity ≥${predicates.parity_min}`);
  }

  const ageMin = predicates.age_months_min as number | undefined;
  const ageMax = predicates.age_months_max as number | undefined;
  if (ageMin !== undefined || ageMax !== undefined) {
    if (ageMin !== undefined && ageMax !== undefined) {
      parts.push(`age ${ageMin}–${ageMax} mo`);
    } else if (ageMin !== undefined) {
      parts.push(`age ≥${ageMin} mo`);
    } else if (ageMax !== undefined) {
      parts.push(`age ≤${ageMax} mo`);
    }
  }

  if (predicates.dry === true) parts.push("dry");
  if (predicates.health_flag === true) parts.push("flagged sick");

  return parts.join(" · ") || "(no rule)";
}
