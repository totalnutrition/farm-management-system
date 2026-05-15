/**
 * Operations Playbook helper.
 *
 * Loads location_playbook + resolves KPI thresholds with the cascade:
 *   1. Per-location override (location_playbook.kpi_overrides)
 *   2. Org default (future: org_kpi_defaults — TBD)
 *   3. Hardcoded fallback in DEFAULT_KPIS below
 *
 * Server-only. React.cache'd so the playbook page + Hot list + any
 * other consumer share one round-trip per render.
 */

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase-admin";

// ---------------------------------------------------------------------
// KPI keys + hardcoded fallback values. Locations override via the
// playbook UI; if missing we fall back to these. Adding a new KPI
// means: add it here, add to KPI_LABELS, expose it on the playbook
// page, and import where it's consumed.
// ---------------------------------------------------------------------

export const KPI_KEYS = {
  // Hot-list / pen-moves thresholds
  stocking_overstock_pct: "stocking_overstock_pct",
  stocking_understock_pct: "stocking_understock_pct",
  due_to_calve_window_days: "due_to_calve_window_days",
  open_threshold_dim: "open_threshold_dim",
  withdrawal_expiring_window_hours: "withdrawal_expiring_window_hours",
  lameness_locomotion_threshold: "lameness_locomotion_threshold",
  lameness_window_days: "lameness_window_days",
  test_day_stale_days: "test_day_stale_days",
  // Reproduction targets
  pr21_target_pct: "pr21_target_pct",
  cr_target_pct: "cr_target_pct",
  s_per_c_target: "s_per_c_target",
  days_open_target: "days_open_target",
  // Health targets
  scc_ceiling_thousands: "scc_ceiling_thousands",
  mastitis_incidence_target_pct: "mastitis_incidence_target_pct",
  lameness_prevalence_target_pct: "lameness_prevalence_target_pct",
  // Feeding targets
  refusal_target_pct: "refusal_target_pct",
  dmi_target_kg: "dmi_target_kg",
  iofc_target_per_cow_per_day: "iofc_target_per_cow_per_day",
} as const;

export type KpiKey = (typeof KPI_KEYS)[keyof typeof KPI_KEYS];

export const DEFAULT_KPIS: Record<KpiKey, number> = {
  stocking_overstock_pct: 1.15,
  stocking_understock_pct: 0.7,
  due_to_calve_window_days: 14,
  open_threshold_dim: 150,
  withdrawal_expiring_window_hours: 24,
  lameness_locomotion_threshold: 3,
  lameness_window_days: 14,
  test_day_stale_days: 30,
  pr21_target_pct: 22,
  cr_target_pct: 40,
  s_per_c_target: 2.5,
  days_open_target: 110,
  scc_ceiling_thousands: 250,
  mastitis_incidence_target_pct: 25,
  lameness_prevalence_target_pct: 10,
  refusal_target_pct: 3,
  dmi_target_kg: 24,
  iofc_target_per_cow_per_day: 6,
};

export const KPI_LABELS: Record<KpiKey, string> = {
  stocking_overstock_pct: "Overstocked threshold",
  stocking_understock_pct: "Understocked threshold",
  due_to_calve_window_days: "Due-to-calve alert window (d)",
  open_threshold_dim: "Open-too-long threshold (DIM)",
  withdrawal_expiring_window_hours: "Withdrawal expiring window (h)",
  lameness_locomotion_threshold: "Lameness locomotion score (≥)",
  lameness_window_days: "Lameness alert window (d)",
  test_day_stale_days: "Test-day stale threshold (d)",
  pr21_target_pct: "21-day pregnancy rate target (%)",
  cr_target_pct: "Conception rate target (%)",
  s_per_c_target: "Services per conception target",
  days_open_target: "Days-open target",
  scc_ceiling_thousands: "Tank SCC ceiling (× 1000)",
  mastitis_incidence_target_pct: "Mastitis incidence target (%/yr)",
  lameness_prevalence_target_pct: "Lameness prevalence target (%)",
  refusal_target_pct: "Bunk refusal target (%)",
  dmi_target_kg: "DMI target (kg/cow/day)",
  iofc_target_per_cow_per_day: "Income over feed cost target (/cow/day)",
};

// Group KPI keys by section for the Playbook UI.
export const KPI_GROUPS = {
  reproduction: [
    "pr21_target_pct",
    "cr_target_pct",
    "s_per_c_target",
    "days_open_target",
    "due_to_calve_window_days",
    "open_threshold_dim",
  ] as KpiKey[],
  health: [
    "lameness_locomotion_threshold",
    "lameness_window_days",
    "lameness_prevalence_target_pct",
    "scc_ceiling_thousands",
    "mastitis_incidence_target_pct",
    "withdrawal_expiring_window_hours",
  ] as KpiKey[],
  milk_recording: ["test_day_stale_days"] as KpiKey[],
  feeding: [
    "refusal_target_pct",
    "dmi_target_kg",
    "iofc_target_per_cow_per_day",
  ] as KpiKey[],
  capacity: [
    "stocking_overstock_pct",
    "stocking_understock_pct",
  ] as KpiKey[],
} as const;

// ---------------------------------------------------------------------
// Playbook row + helpers
// ---------------------------------------------------------------------

export type Playbook = {
  id: string;
  location_id: string;
  repro_protocol_id: string | null;
  vaccination_protocol_id: string | null;
  treatment_protocol_id: string | null;
  hoof_trim_protocol_id: string | null;
  deworming_protocol_id: string | null;
  dry_off_protocol_id: string | null;
  kpi_overrides: Record<string, number>;
  notes: string | null;
};

const EMPTY_PLAYBOOK = (locationId: string): Playbook => ({
  id: "",
  location_id: locationId,
  repro_protocol_id: null,
  vaccination_protocol_id: null,
  treatment_protocol_id: null,
  hoof_trim_protocol_id: null,
  deworming_protocol_id: null,
  dry_off_protocol_id: null,
  kpi_overrides: {},
  notes: null,
});

export const loadPlaybook = cache(
  async (locationId: string): Promise<Playbook> => {
    if (!locationId) return EMPTY_PLAYBOOK(locationId);
    const admin = createAdminClient();
    const { data } = await admin
      .from("location_playbook")
      .select("*")
      .eq("location_id", locationId)
      .maybeSingle();
    if (!data) return EMPTY_PLAYBOOK(locationId);
    return {
      id: data.id as string,
      location_id: data.location_id as string,
      repro_protocol_id: (data.repro_protocol_id as string | null) ?? null,
      vaccination_protocol_id:
        (data.vaccination_protocol_id as string | null) ?? null,
      treatment_protocol_id:
        (data.treatment_protocol_id as string | null) ?? null,
      hoof_trim_protocol_id:
        (data.hoof_trim_protocol_id as string | null) ?? null,
      deworming_protocol_id:
        (data.deworming_protocol_id as string | null) ?? null,
      dry_off_protocol_id:
        (data.dry_off_protocol_id as string | null) ?? null,
      kpi_overrides:
        (data.kpi_overrides as Record<string, number> | null) ?? {},
      notes: (data.notes as string | null) ?? null,
    };
  },
);

/** Resolve a KPI value: location override → hardcoded default. */
export function resolveKpi(playbook: Playbook | null, key: KpiKey): number {
  const override = playbook?.kpi_overrides?.[key];
  if (typeof override === "number") return override;
  return DEFAULT_KPIS[key];
}

/** Same as resolveKpi but takes the raw overrides map (for non-cache callers). */
export function resolveKpiFromMap(
  overrides: Record<string, number> | null | undefined,
  key: KpiKey,
): number {
  const v = overrides?.[key];
  return typeof v === "number" ? v : DEFAULT_KPIS[key];
}
