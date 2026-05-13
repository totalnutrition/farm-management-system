export const TestDayFrequencies = [
  { value: "none", label: "None" },
  { value: "monthly", label: "Monthly" },
  { value: "fortnightly", label: "Fortnightly (every 2 weeks)" },
  { value: "weekly", label: "Weekly" },
] as const;
export type TestDayFrequency = (typeof TestDayFrequencies)[number]["value"];

export const MilkingsPerDay = [
  { value: "1x", label: "1× per day" },
  { value: "2x", label: "2× per day" },
  { value: "3x", label: "3× per day" },
  { value: "robotic", label: "Robotic / variable" },
] as const;
export type MilkingsPerDayValue = (typeof MilkingsPerDay)[number]["value"];

export const RecordingMethods = [
  { value: "parlor_meters_icar", label: "Parlor meters (ICAR-certified)" },
  { value: "walk_thru_meters", label: "Walk-thru meters" },
  { value: "pail", label: "Pail weighing" },
  { value: "visual_estimate", label: "Visual estimate" },
  { value: "mobile_entry", label: "Mobile / manual entry" },
  { value: "robotic", label: "Robotic system (AMS)" },
] as const;
export type RecordingMethodValue = (typeof RecordingMethods)[number]["value"];

export const BulkTankFrequencies = [
  { value: "daily", label: "Daily reading" },
  { value: "per_pickup", label: "Per pickup only" },
  { value: "none", label: "No bulk tank tracking" },
] as const;
export type BulkTankFrequency = (typeof BulkTankFrequencies)[number]["value"];

export const ComponentSamplingMethods = [
  { value: "dhi_lab", label: "DHI lab (test-day samples)" },
  { value: "inline_fat_protein", label: "Inline fat/protein sensor" },
  { value: "bulk_tank_only", label: "Bulk tank only" },
  { value: "none", label: "No component sampling" },
] as const;
export type ComponentSamplingValue =
  (typeof ComponentSamplingMethods)[number]["value"];

export type RecordingProfile = {
  test_day_frequency: TestDayFrequency;
  daily_recording_enabled: boolean;
  milkings_per_day: MilkingsPerDayValue;
  recording_method: RecordingMethodValue;
  bulk_tank_recording: BulkTankFrequency;
  component_sampling: ComponentSamplingValue;
  notes: string | null;
};

export const RecordingProfileDefaults: RecordingProfile = {
  test_day_frequency: "monthly",
  daily_recording_enabled: false,
  milkings_per_day: "2x",
  recording_method: "parlor_meters_icar",
  bulk_tank_recording: "per_pickup",
  component_sampling: "dhi_lab",
  notes: null,
};

export function viewLabel<T extends string>(
  table: readonly { value: T; label: string }[],
  value: T,
): string {
  return table.find((t) => t.value === value)?.label ?? value;
}
