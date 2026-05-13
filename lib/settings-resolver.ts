/**
 * Three-level settings resolver (docs/plan.md §2).
 *
 * Inheritable settings: currency, units (overall system), timezone,
 * land_area_unit (granular).
 * Resolution order: LOC override → ORG default → fallback.
 */

import type { LandAreaUnit } from "@/lib/land-units";

export type SettingSource = "location" | "organization" | "fallback";

export type ResolvedSetting<T> = {
  value: T;
  source: SettingSource;
};

export type Units = "metric" | "imperial";

export type OrgDefaults = {
  default_currency: string;
  default_units: Units;
  default_timezone: string;
  default_land_area_unit: LandAreaUnit;
};

export type LocationOverrides = {
  currency_override: string | null;
  units_override: Units | null;
  timezone: string | null;
  land_area_unit_override: LandAreaUnit | null;
};

const SETTINGS_FALLBACK: OrgDefaults = {
  default_currency: "PKR",
  default_units: "metric",
  default_timezone: "Asia/Karachi",
  default_land_area_unit: "acre",
};

function resolve<T>(
  locValue: T | null | undefined,
  orgValue: T | null | undefined,
  fallback: T,
): ResolvedSetting<T> {
  if (locValue !== null && locValue !== undefined && locValue !== "") {
    return { value: locValue as T, source: "location" };
  }
  if (orgValue !== null && orgValue !== undefined && orgValue !== "") {
    return { value: orgValue as T, source: "organization" };
  }
  return { value: fallback, source: "fallback" };
}

export function resolveLocationSettings(
  loc: LocationOverrides,
  org: OrgDefaults | null,
): {
  currency: ResolvedSetting<string>;
  units: ResolvedSetting<Units>;
  timezone: ResolvedSetting<string>;
  land_area_unit: ResolvedSetting<LandAreaUnit>;
} {
  const o = org ?? SETTINGS_FALLBACK;
  return {
    currency: resolve(
      loc.currency_override,
      o.default_currency,
      SETTINGS_FALLBACK.default_currency,
    ),
    units: resolve(
      loc.units_override,
      o.default_units,
      SETTINGS_FALLBACK.default_units,
    ),
    timezone: resolve(
      loc.timezone,
      o.default_timezone,
      SETTINGS_FALLBACK.default_timezone,
    ),
    land_area_unit: resolve(
      loc.land_area_unit_override,
      o.default_land_area_unit,
      SETTINGS_FALLBACK.default_land_area_unit,
    ),
  };
}

export function sourceLabel(source: SettingSource): string {
  switch (source) {
    case "location":
      return "Set on this location";
    case "organization":
      return "Inherited from organization";
    case "fallback":
      return "System fallback";
  }
}

/**
 * Currencies. PKR is listed first as the product's primary market is
 * Pakistan; the rest follow rough regional grouping.
 */
export const CommonCurrencies: { value: string; label: string }[] = [
  { value: "PKR", label: "PKR — Pakistani Rupee" },
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "BDT", label: "BDT — Bangladeshi Taka" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "SAR", label: "SAR — Saudi Riyal" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — Pound Sterling" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "NZD", label: "NZD — New Zealand Dollar" },
  { value: "MXN", label: "MXN — Mexican Peso" },
  { value: "BRL", label: "BRL — Brazilian Real" },
  { value: "ARS", label: "ARS — Argentine Peso" },
  { value: "CHF", label: "CHF — Swiss Franc" },
  { value: "PLN", label: "PLN — Polish Złoty" },
  { value: "RUB", label: "RUB — Russian Ruble" },
  { value: "CNY", label: "CNY — Chinese Yuan" },
  { value: "JPY", label: "JPY — Japanese Yen" },
  { value: "ZAR", label: "ZAR — South African Rand" },
  { value: "KES", label: "KES — Kenyan Shilling" },
  { value: "EGP", label: "EGP — Egyptian Pound" },
];
