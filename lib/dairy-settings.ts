export const HeatDetectionMethods = [
  { value: "visual", label: "Visual observation" },
  { value: "activity_monitor", label: "Activity monitor (collar / pedometer system)" },
  { value: "tail_paint", label: "Tail paint" },
  { value: "mounting", label: "Mounting detection" },
  { value: "pedometer", label: "Pedometer" },
  { value: "mixed", label: "Mixed / multiple methods" },
] as const;
export type HeatDetectionMethod = (typeof HeatDetectionMethods)[number]["value"];

export const RfidTagTypes = [
  { value: "none", label: "Not used" },
  { value: "hdx", label: "HDX (Half-duplex)" },
  { value: "fdx", label: "FDX (Full-duplex / ISO 11784/85)" },
] as const;
export type RfidTagType = (typeof RfidTagTypes)[number]["value"];

export type DairySettings = {
  // Reproduction
  voluntary_waiting_period_days: number;
  heat_detection_method: HeatDetectionMethod;
  preg_check_initial_days: number;
  preg_check_confirm_days: number;
  expected_gestation_days: number;
  preg_rate_target_pct: number | null;
  conception_rate_target_pct: number | null;
  services_per_conception_target: number | null;
  do_not_breed_days_threshold: number | null;

  // Transition
  dry_off_dcc_days: number;
  close_up_dcc_days: number;
  calving_alert_days_before: number;

  // Milk quality
  scc_hospital_threshold: number;
  scc_linear_score_hospital: number;
  fat_target_pct: number | null;
  protein_target_pct: number | null;

  // Withdrawal
  withdrawal_auto_flag: boolean;
  withdrawal_extra_label_multiplier: number;
  withdrawal_lookback_days: number;

  // Bulk tank
  bulk_tank_reconciliation_threshold_pct: number;
  bulk_tank_pickup_cadence: string | null;

  // Targets
  cull_rate_target_pct: number | null;
  rha_milk_target_kg: number | null;

  // Animal numbering
  animal_id_prefix: string | null;
  animal_id_padding: number;
  rfid_type: RfidTagType;
  require_840_id: boolean;

  notes: string | null;
};

export const DairySettingsDefaults: DairySettings = {
  voluntary_waiting_period_days: 50,
  heat_detection_method: "visual",
  preg_check_initial_days: 28,
  preg_check_confirm_days: 60,
  expected_gestation_days: 280,
  preg_rate_target_pct: null,
  conception_rate_target_pct: null,
  services_per_conception_target: null,
  do_not_breed_days_threshold: null,
  dry_off_dcc_days: 220,
  close_up_dcc_days: 250,
  calving_alert_days_before: 14,
  scc_hospital_threshold: 400000,
  scc_linear_score_hospital: 4.0,
  fat_target_pct: null,
  protein_target_pct: null,
  withdrawal_auto_flag: true,
  withdrawal_extra_label_multiplier: 1.0,
  withdrawal_lookback_days: 30,
  bulk_tank_reconciliation_threshold_pct: 5.0,
  bulk_tank_pickup_cadence: null,
  cull_rate_target_pct: null,
  rha_milk_target_kg: null,
  animal_id_prefix: null,
  animal_id_padding: 0,
  rfid_type: "none",
  require_840_id: false,
  notes: null,
};
