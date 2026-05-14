export const PenTypes = [
  { value: "milking", label: "Milking" },
  { value: "dry", label: "Dry" },
  { value: "close_up", label: "Close-up" },
  { value: "far_off", label: "Far-off" },
  { value: "fresh", label: "Fresh" },
  { value: "hospital", label: "Hospital" },
  { value: "maternity", label: "Maternity" },
  { value: "AI_breeding", label: "AI / Breeding" },
  { value: "bull", label: "Bull" },
  { value: "heifer", label: "Heifer" },
  { value: "calf", label: "Calf" },
  { value: "other", label: "Other" },
] as const;

export type PenType = (typeof PenTypes)[number]["value"];

export type Pen = {
  id: string;
  location_id: string;
  barn_id: string | null;
  group_id: string | null;
  name: string;
  pen_code: string | null;
  type: string;
  capacity_head: number | null;
  bunk_running_ft: number | null;
  stocking_target_pct: number | null;
  is_AI_pen: boolean;
  is_BULL_pen: boolean;
  is_DRY_pen: boolean;
  is_HOSP_pen: boolean;
  is_FRESH_pen: boolean;
  is_placeholder: boolean;
  notes: string | null;
};

export const PenTypeView: Record<string, string> = Object.fromEntries(
  PenTypes.map((p) => [p.value, p.label]),
);
