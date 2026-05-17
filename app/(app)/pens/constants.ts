// Plain constants (NOT a "use server" module) — a server-action file
// may only export async functions, so shared values live here.
export const PEN_TYPES = [
  "BULL",
  "AI",
  "MILK",
  "DRY",
  "HOSP",
  "CALF",
  "USER",
] as const;

export type PenType = (typeof PEN_TYPES)[number];
