/**
 * Three-level settings resolver (docs/plan.md §2).
 *
 * Inheritable settings: currency, units, timezone.
 * Resolution order: USER override (display-only) → LOC override → ORG default → fallback.
 *
 * USER overrides are handled at render time elsewhere; this module
 * resolves the persisted LOC ← ORG inheritance pair into a single
 * (value, source) record.
 */

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
};

export type LocationOverrides = {
  currency_override: string | null;
  units_override: Units | null;
  timezone: string | null;
};

const SETTINGS_FALLBACK: OrgDefaults = {
  default_currency: "USD",
  default_units: "metric",
  default_timezone: "UTC",
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
 * Common currency choices for the Currency Select. Locations in
 * countries we don't list can paste an ISO 4217 code as a custom
 * value (the schema is plain text).
 */
export const CommonCurrencies: { value: string; label: string }[] = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "MXN", label: "MXN — Mexican Peso" },
  { value: "BRL", label: "BRL — Brazilian Real" },
  { value: "ARS", label: "ARS — Argentine Peso" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — Pound Sterling" },
  { value: "CHF", label: "CHF — Swiss Franc" },
  { value: "PLN", label: "PLN — Polish Złoty" },
  { value: "RUB", label: "RUB — Russian Ruble" },
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "PKR", label: "PKR — Pakistani Rupee" },
  { value: "BDT", label: "BDT — Bangladeshi Taka" },
  { value: "CNY", label: "CNY — Chinese Yuan" },
  { value: "JPY", label: "JPY — Japanese Yen" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "NZD", label: "NZD — New Zealand Dollar" },
  { value: "ZAR", label: "ZAR — South African Rand" },
  { value: "KES", label: "KES — Kenyan Shilling" },
  { value: "EGP", label: "EGP — Egyptian Pound" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "SAR", label: "SAR — Saudi Riyal" },
];
