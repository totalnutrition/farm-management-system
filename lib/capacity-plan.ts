import type { HerdProfile, LocationGroup } from "./herd-profile";
import type { CapacityDefaults } from "./capacity-defaults";

/**
 * Computes the capacity plan per docs/plan.md §3.4. The math:
 *   pen_cap = ceil(estimated_head × stocking_pct / 100)
 *   total_bunk_in = pen_cap × bunk_in_per_head
 *
 * Estimated head per group is a best-effort allocation of the herd
 * profile counts across the location's groups based on group_class
 * and the rule predicates (DIM, parity, pregnancy_days).
 */

export type CapacityPlanRow = {
  group_id: string;
  group_label: string;
  group_class: string;
  estimated_head: number;
  stocking_pct: number;
  pen_capacity: number;
  bunk_in_per_head: number;
  bunk_total_in: number;
  bunk_total_ft: number;
};

export type CapacityPlan = {
  rows: CapacityPlanRow[];
  totals: {
    estimated_head: number;
    pen_capacity: number;
    bunk_total_ft: number;
  };
};

function estimateHead(
  group: LocationGroup,
  profile: HerdProfile,
): number {
  const predicates = group.rule_predicates;
  switch (group.group_class) {
    case "lactating": {
      const cls = group.group_slug;
      const total = profile.target_lactating_count;
      // Lactating slug-specific allocations
      const dimMin = predicates.dim_min as number | undefined;
      const dimMax = predicates.dim_max as number | undefined;
      if (cls === "lactating") return total;
      if (cls === "fresh" || cls === "fresh-primip" || cls === "fresh-multip") {
        const window = (dimMax ?? 21) - (dimMin ?? 0) + 1;
        const lactationLength = profile.calving_interval_days - 60;
        const fraction = lactationLength > 0 ? window / lactationLength : 0;
        const base = total * fraction;
        if (cls === "fresh-primip") return Math.round(base * (profile.pct_primiparous / 100));
        if (cls === "fresh-multip") return Math.round(base * (1 - profile.pct_primiparous / 100));
        return Math.round(base);
      }
      // Generic DIM-window fraction of lactation
      if (dimMin !== undefined || dimMax !== undefined) {
        const lo = dimMin ?? 0;
        const hi = dimMax ?? Math.max(305, profile.calving_interval_days - 60);
        const span = Math.max(1, hi - lo + 1);
        const lactationLength = Math.max(1, profile.calving_interval_days - 60);
        return Math.round(total * (span / lactationLength));
      }
      return 0;
    }
    case "dry": {
      return profile.target_dry_count;
    }
    case "transition": {
      // Close-up. Typically last 21 days of dry period.
      return Math.round(profile.target_dry_count * (21 / 60));
    }
    case "special": {
      // Hospital + maternity: rough buffer based on lactating herd.
      // Hospital ≈ 5% of lactating, Maternity ≈ 3 days of calvings.
      if (group.group_slug.includes("hospital")) {
        return Math.max(2, Math.round(profile.target_lactating_count * 0.05));
      }
      if (group.group_slug.includes("maternity")) {
        return Math.max(
          2,
          Math.round(
            (profile.target_lactating_count + profile.target_dry_count) /
              Math.max(1, profile.calving_interval_days),
          ) * 3,
        );
      }
      return 0;
    }
    case "heifer": {
      const ageMin = predicates.age_months_min as number | undefined;
      const ageMax = predicates.age_months_max as number | undefined;
      const total = profile.target_heifer_count;
      if (ageMin !== undefined || ageMax !== undefined) {
        const lo = ageMin ?? 0;
        const hi = ageMax ?? 24;
        const span = Math.max(1, hi - lo);
        const totalSpan = 24; // 0-24mo by convention
        return Math.round(total * (span / totalSpan));
      }
      return total;
    }
    case "calf": {
      return profile.target_calf_count;
    }
    default:
      return 0;
  }
}

function stockingPctFor(
  group: LocationGroup,
  defaults: CapacityDefaults,
): number {
  const slug = group.group_slug;
  if (slug === "fresh" || slug.startsWith("fresh-"))
    return defaults.fresh_stocking_pct;
  if (slug === "high") return defaults.high_stocking_pct;
  if (slug === "mid") return defaults.mid_stocking_pct;
  if (slug === "low") return defaults.low_stocking_pct;
  if (slug === "close-up") return defaults.dry_close_stocking_pct;
  if (slug === "far-off") return defaults.dry_far_stocking_pct;
  if (group.group_class === "dry") return defaults.dry_far_stocking_pct;
  // lactating bucket without a more specific slug
  if (group.group_class === "lactating") return defaults.high_stocking_pct;
  return 100;
}

function bunkInFor(
  group: LocationGroup,
  defaults: CapacityDefaults,
): number {
  const slug = group.group_slug;
  if (slug === "fresh" || slug.startsWith("fresh-"))
    return defaults.fresh_bunk_in;
  if (slug === "high") return defaults.high_bunk_in;
  if (slug === "mid") return defaults.mid_bunk_in;
  if (slug === "low") return defaults.low_bunk_in;
  if (slug === "close-up") return defaults.dry_close_bunk_in;
  if (slug === "far-off") return defaults.dry_far_bunk_in;
  if (group.group_class === "dry") return defaults.dry_far_bunk_in;
  if (group.group_class === "lactating") return defaults.high_bunk_in;
  if (group.group_class === "special") return defaults.fresh_bunk_in;
  return defaults.mid_bunk_in;
}

export function computeCapacityPlan(
  profile: HerdProfile,
  groups: LocationGroup[],
  defaults: CapacityDefaults,
): CapacityPlan {
  const rows: CapacityPlanRow[] = groups.map((g) => {
    const head = Math.max(0, estimateHead(g, profile));
    const stocking = stockingPctFor(g, defaults);
    const bunkIn = bunkInFor(g, defaults);
    const penCap = Math.ceil((head * stocking) / 100);
    const bunkTotalIn = penCap * bunkIn;
    return {
      group_id: g.id,
      group_label: g.label,
      group_class: g.group_class,
      estimated_head: head,
      stocking_pct: stocking,
      pen_capacity: penCap,
      bunk_in_per_head: bunkIn,
      bunk_total_in: bunkTotalIn,
      bunk_total_ft: Math.round((bunkTotalIn / 12) * 10) / 10,
    };
  });
  return {
    rows,
    totals: {
      estimated_head: rows.reduce((s, r) => s + r.estimated_head, 0),
      pen_capacity: rows.reduce((s, r) => s + r.pen_capacity, 0),
      bunk_total_ft:
        Math.round(rows.reduce((s, r) => s + r.bunk_total_ft, 0) * 10) / 10,
    },
  };
}
