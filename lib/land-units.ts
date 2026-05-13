/**
 * Granular land-area units. Storage is always in hectares (the columns
 * on locations / arable_parcels are *_hectares); the unit is purely a
 * display preference resolved from ORG default → LOC override.
 *
 * Conversion factors: how many hectares one unit equals.
 *   1 hectare       = 1 ha
 *   1 acre          ≈ 0.4046856 ha
 *   1 square meter  = 0.0001 ha
 *   1 square foot   ≈ 9.2903e-6 ha
 *   1 marla         ≈ 0.002529  ha   (272.25 sq ft, Punjab standard)
 *   1 kanal         ≈ 0.05058   ha   (20 marlas)
 *   1 murabba       = 10.1171   ha   (25 acres, 1 square in Punjab)
 */

export const LandAreaUnits = [
  { value: "hectare", label: "Hectare (ha)", short: "ha", haPerUnit: 1 },
  { value: "acre", label: "Acre (ac)", short: "ac", haPerUnit: 0.4046856 },
  { value: "square_meter", label: "Square meter (m²)", short: "m²", haPerUnit: 0.0001 },
  { value: "square_foot", label: "Square foot (sq ft)", short: "sq ft", haPerUnit: 0.00000929 },
  { value: "marla", label: "Marla (Punjab, 272 sq ft)", short: "marla", haPerUnit: 0.002529 },
  { value: "kanal", label: "Kanal (20 marlas)", short: "kanal", haPerUnit: 0.05058 },
  { value: "murabba", label: "Murabba (25 acres)", short: "murabba", haPerUnit: 10.1171 },
] as const;

export type LandAreaUnit = (typeof LandAreaUnits)[number]["value"];

const factorByUnit: Record<LandAreaUnit, number> = Object.fromEntries(
  LandAreaUnits.map((u) => [u.value, u.haPerUnit]),
) as Record<LandAreaUnit, number>;

const shortByUnit: Record<LandAreaUnit, string> = Object.fromEntries(
  LandAreaUnits.map((u) => [u.value, u.short]),
) as Record<LandAreaUnit, string>;

const labelByUnit: Record<LandAreaUnit, string> = Object.fromEntries(
  LandAreaUnits.map((u) => [u.value, u.label]),
) as Record<LandAreaUnit, string>;

export function landUnitShort(unit: LandAreaUnit): string {
  return shortByUnit[unit] ?? unit;
}

export function landUnitLabel(unit: LandAreaUnit): string {
  return labelByUnit[unit] ?? unit;
}

/**
 * Convert hectares (storage) to the user's chosen display unit.
 */
export function hectaresToDisplay(
  hectares: number | null,
  unit: LandAreaUnit,
): number | null {
  if (hectares === null || hectares === undefined) return null;
  const factor = factorByUnit[unit];
  if (!factor) return hectares;
  return hectares / factor;
}

/**
 * Convert from the user's display unit back to hectares for storage.
 */
export function displayToHectares(
  value: number | null,
  unit: LandAreaUnit,
): number | null {
  if (value === null || value === undefined) return null;
  const factor = factorByUnit[unit];
  if (!factor) return value;
  return value * factor;
}

export function formatArea(
  hectares: number | null,
  unit: LandAreaUnit,
  digits = 2,
): string {
  if (hectares === null || hectares === undefined) return "—";
  const display = hectaresToDisplay(hectares, unit);
  if (display === null) return "—";
  return `${display.toFixed(digits)} ${landUnitShort(unit)}`;
}
