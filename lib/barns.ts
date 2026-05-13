export const BarnTypes = [
  { value: "freestall", label: "Freestall" },
  { value: "tie_stall", label: "Tie-stall" },
  { value: "bedded_pack", label: "Bedded pack" },
  { value: "compost", label: "Compost barn" },
  { value: "drylot", label: "Drylot / open lot" },
  { value: "robotic", label: "Robotic milking" },
  { value: "parlor", label: "Parlor barn" },
  { value: "calf", label: "Calf barn" },
  { value: "maternity_transition", label: "Maternity / Transition" },
  { value: "hospital", label: "Hospital" },
  { value: "heifer", label: "Heifer" },
  { value: "hutches", label: "Calf hutches" },
] as const;

export const RowConfigurations = [
  { value: "2_row", label: "2-row" },
  { value: "3_row", label: "3-row" },
  { value: "4_row", label: "4-row" },
  { value: "6_row", label: "6-row" },
  { value: "other", label: "Other" },
] as const;

export const VentilationTypes = [
  { value: "natural", label: "Natural" },
  { value: "tunnel", label: "Tunnel" },
  { value: "cross", label: "Cross" },
  { value: "hybrid", label: "Hybrid" },
] as const;

export const ParlorTypes = [
  { value: "parallel", label: "Parallel" },
  { value: "herringbone", label: "Herringbone" },
  { value: "rotary", label: "Rotary" },
  { value: "robot", label: "Robotic" },
  { value: "swing", label: "Swing" },
  { value: "none", label: "None" },
] as const;

export type Barn = {
  id: string;
  location_id: string;
  name: string;
  barn_code: string | null;
  type: string;
  row_configuration: string | null;
  freestall_count: number | null;
  headlock_count: number | null;
  loafing_area_sqft: number | null;
  holding_pen_capacity: number | null;
  stall_surface: string | null;
  bedding_type: string | null;
  stall_length_ft: number | null;
  stall_width_in: number | null;
  neck_rail_height_in: number | null;
  bunk_type: string | null;
  bunk_total_linear_ft: number | null;
  floor_type: string | null;
  manure_handling: string | null;
  ventilation_type: string | null;
  fan_count: number | null;
  fan_diameter_in: number | null;
  soaker_lines_present: boolean;
  soaker_nozzle_height_in: number | null;
  sprinklers: boolean;
  fans_over_stalls: boolean;
  brushes_count: number | null;
  footbath_present: boolean;
  parlor_type: string | null;
  parlor_stalls: number | null;
  robot_count: number | null;
  notes: string | null;
};

export const BarnTypeView: Record<string, string> = Object.fromEntries(
  BarnTypes.map((b) => [b.value, b.label]),
);

export const RowConfigView: Record<string, string> = Object.fromEntries(
  RowConfigurations.map((r) => [r.value, r.label]),
);
