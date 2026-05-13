export type CapacityDefaults = {
  fresh_stocking_pct: number;
  high_stocking_pct: number;
  mid_stocking_pct: number;
  low_stocking_pct: number;
  dry_close_stocking_pct: number;
  dry_far_stocking_pct: number;
  fresh_bunk_in: number;
  high_bunk_in: number;
  mid_bunk_in: number;
  low_bunk_in: number;
  dry_close_bunk_in: number;
  dry_far_bunk_in: number;
};

/**
 * Fallback used when an org has no capacity_defaults row yet. Mirrors
 * the migration's column defaults so behavior is identical.
 */
export const CapacityDefaultsFallback: CapacityDefaults = {
  fresh_stocking_pct: 100,
  high_stocking_pct: 110,
  mid_stocking_pct: 115,
  low_stocking_pct: 115,
  dry_close_stocking_pct: 100,
  dry_far_stocking_pct: 110,
  fresh_bunk_in: 30,
  high_bunk_in: 30,
  mid_bunk_in: 24,
  low_bunk_in: 24,
  dry_close_bunk_in: 30,
  dry_far_bunk_in: 24,
};

export const CapacityGroupClasses: {
  key: keyof CapacityDefaults & string;
  label: string;
}[] = [
  { key: "fresh_stocking_pct", label: "Fresh — stocking %" },
  { key: "fresh_bunk_in", label: "Fresh — bunk in/cow" },
  { key: "high_stocking_pct", label: "High — stocking %" },
  { key: "high_bunk_in", label: "High — bunk in/cow" },
  { key: "mid_stocking_pct", label: "Mid — stocking %" },
  { key: "mid_bunk_in", label: "Mid — bunk in/cow" },
  { key: "low_stocking_pct", label: "Low — stocking %" },
  { key: "low_bunk_in", label: "Low — bunk in/cow" },
  { key: "dry_close_stocking_pct", label: "Close-up dry — stocking %" },
  { key: "dry_close_bunk_in", label: "Close-up dry — bunk in/cow" },
  { key: "dry_far_stocking_pct", label: "Far-off dry — stocking %" },
  { key: "dry_far_bunk_in", label: "Far-off dry — bunk in/cow" },
];

export function isStockingKey(key: keyof CapacityDefaults): boolean {
  return key.endsWith("_stocking_pct");
}
