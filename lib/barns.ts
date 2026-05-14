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

export const BarnLayouts = [
  { value: "single_side", label: "Single-side (pens on one side of feed alley)" },
  { value: "double_side", label: "Double-side (pens both sides of central feed alley)" },
  { value: "free", label: "Free (custom)" },
] as const;
export type BarnLayout = (typeof BarnLayouts)[number]["value"];

// ---------------------------------------------------------------------
// Categorical dropdown option lists. Stored as plain text in the DB
// today so we can extend the lists in code without a migration; the
// form uses strict Selects so two people don't end up entering
// "rubber" vs "rubber mat" vs "rubber matting".
// ---------------------------------------------------------------------

export const StallSurfaces = [
  { value: "sand", label: "Sand" },
  { value: "mattress", label: "Mattress / waterbed" },
  { value: "rubber_mat", label: "Rubber mat" },
  { value: "deep_bedded_pack", label: "Deep-bedded pack" },
  { value: "compost_pack", label: "Compost pack" },
  { value: "concrete", label: "Bare concrete" },
] as const;

export const BeddingTypes = [
  { value: "sand", label: "Sand" },
  { value: "sawdust", label: "Sawdust" },
  { value: "wheat_straw", label: "Wheat straw" },
  { value: "rice_husk", label: "Rice husk" },
  { value: "wood_shavings", label: "Wood shavings" },
  { value: "recycled_manure_solids", label: "Recycled manure solids" },
  { value: "dried_dung_cake", label: "Dried dung cake" },
  { value: "none", label: "None" },
] as const;

export const BunkTypes = [
  { value: "drive_through", label: "Drive-through (truck unloads inside)" },
  { value: "feed_alley", label: "Feed alley (cows + truck share a strip)" },
  { value: "fenceline", label: "Fenceline (cows eat through a fence)" },
  { value: "j_bunk", label: "J-bunk / pre-cast" },
] as const;

export const FloorTypes = [
  { value: "grooved_concrete", label: "Grooved concrete" },
  { value: "smooth_concrete", label: "Smooth concrete" },
  { value: "rubber", label: "Rubber matting" },
  { value: "slatted", label: "Slatted floor" },
  { value: "earthen", label: "Earthen / open lot" },
  { value: "sand_laneway", label: "Sand laneway" },
] as const;

export const ManureHandlingTypes = [
  { value: "scrape_tractor", label: "Tractor scrape" },
  { value: "scrape_alley", label: "Automatic alley scraper" },
  { value: "flush", label: "Flush" },
  { value: "vacuum", label: "Vacuum / slurry tanker" },
  { value: "robot_scraper", label: "Robotic scraper" },
  { value: "hand", label: "Manual / hand-cleaned" },
] as const;

export const DrinkerTypes = [
  { value: "concrete_trough", label: "Concrete trough" },
  { value: "tip_trough", label: "Tip-over trough (cleanable)" },
  { value: "individual_bowl", label: "Individual ball / pressure bowl" },
  { value: "ball_float", label: "Ball-float / floater" },
  { value: "fast_fill", label: "Fast-fill water station" },
] as const;

export type Barn = {
  id: string;
  location_id: string;
  name: string;
  barn_code: string | null;
  type: string;
  row_configuration: string | null;
  /** Long-axis length, ft. Drives the visual renderer. */
  length_ft: number | null;
  /** Short-axis width, ft. */
  width_ft: number | null;
  layout: string;
  alley_width_ft: number | null;
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
  /** Number of drinker stations (waterers) in the barn. */
  drinker_count: number | null;
  /** Style of drinker — trough, ball-float, individual bowl, etc. */
  drinker_type: string | null;
  /** Total linear feet of trough water access (for water-space audits). */
  drinker_linear_ft: number | null;
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
