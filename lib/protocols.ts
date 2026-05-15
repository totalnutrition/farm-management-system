/**
 * Protocol-step helpers.
 *
 * Loads typed steps from protocol_steps + formats them into human
 * one-liners for tables, and exposes the trigger / recurrence enums
 * used by the editor forms.
 *
 * Server-only.
 */

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase-admin";

export type ProtocolKind =
  | "repro"
  | "vaccination"
  | "treatment"
  | "hoof_trim"
  | "deworming"
  | "dry_off";

export type ProtocolStepTrigger =
  | "enrollment_day"
  | "days_in_milk"
  | "days_relative_to_calving"
  | "days_relative_to_dry_off"
  | "days_relative_to_breeding"
  | "days_before_breeding"
  | "age_days"
  | "recurrence_only"
  | "seasonal";

export type ProtocolStepRecurrence =
  | "once"
  | "annual"
  | "semi_annual"
  | "quarterly"
  | "monthly"
  | "weekly"
  | "every_n_days"
  | "seasonal_spring"
  | "seasonal_autumn"
  | "seasonal_spring_autumn"
  | "every_lactation";

export type ProtocolStep = {
  id: string;
  protocol_kind: ProtocolKind;
  protocol_id: string;
  step_no: number;
  label: string;
  drug_id: string | null;
  drug_name: string | null;
  drug_brand: string | null;
  dose_amount: string | null;
  dose_unit: string | null;
  route: string | null;
  trigger: ProtocolStepTrigger;
  at_offset_days: number | null;
  recurrence: ProtocolStepRecurrence;
  every_n_days: number | null;
  withdrawal_milk_hours: number | null;
  withdrawal_meat_days: number | null;
  notes: string | null;
  is_seed: boolean;
};

/**
 * Load every protocol step for the visible protocols and return them
 * grouped by `${kind}:${protocol_id}` so a caller can look up steps
 * for any one protocol in O(1).
 */
export const loadAllProtocolSteps = cache(
  async (): Promise<Map<string, ProtocolStep[]>> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("protocol_steps")
      .select(
        "id, protocol_kind, protocol_id, step_no, label, drug_id, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence, every_n_days, withdrawal_milk_hours, withdrawal_meat_days, notes, is_seed, drug:org_vet_medicines!drug_id(name, brand)",
      )
      .order("protocol_id")
      .order("step_no");

    const rows = ((data ?? []) as unknown) as Array<
      Omit<ProtocolStep, "drug_name" | "drug_brand"> & {
        // Supabase returns the FK-joined row as a single object OR
        // an array depending on cardinality typing; normalise here.
        drug: { name: string | null; brand: string | null } | { name: string | null; brand: string | null }[] | null;
      }
    >;

    const map = new Map<string, ProtocolStep[]>();
    for (const r of rows) {
      const key = `${r.protocol_kind}:${r.protocol_id}`;
      const arr = map.get(key) ?? [];
      const drugObj = Array.isArray(r.drug) ? r.drug[0] ?? null : r.drug;
      arr.push({
        id: r.id,
        protocol_kind: r.protocol_kind,
        protocol_id: r.protocol_id,
        step_no: r.step_no,
        label: r.label,
        drug_id: r.drug_id,
        drug_name: drugObj?.name ?? null,
        drug_brand: drugObj?.brand ?? null,
        dose_amount: r.dose_amount,
        dose_unit: r.dose_unit,
        route: r.route,
        trigger: r.trigger,
        at_offset_days: r.at_offset_days,
        recurrence: r.recurrence,
        every_n_days: r.every_n_days,
        withdrawal_milk_hours: r.withdrawal_milk_hours,
        withdrawal_meat_days: r.withdrawal_meat_days,
        notes: r.notes,
        is_seed: r.is_seed,
      });
      map.set(key, arr);
    }
    return map;
  },
);

const TRIGGER_PREFIX: Record<ProtocolStepTrigger, (offset: number | null) => string> = {
  enrollment_day: (o) => `Day ${o ?? 0}`,
  days_in_milk: (o) => `DIM ${o ?? 0}`,
  days_relative_to_calving: (o) =>
    o === null ? "Around calving" : o < 0 ? `${Math.abs(o)} d pre-calving` : `${o} d post-calving`,
  days_relative_to_dry_off: (o) =>
    o === null ? "At dry-off" : o < 0 ? `${Math.abs(o)} d pre-dry-off` : `${o} d post-dry-off`,
  days_relative_to_breeding: (o) =>
    o === null ? "At breeding" : `${o} d post-AI`,
  days_before_breeding: (o) => `${o ?? 0} d before breeding`,
  age_days: (o) => `Age ${o ?? 0} d`,
  recurrence_only: () => "Recurring",
  seasonal: () => "Seasonal",
};

const RECURRENCE_LABEL: Record<ProtocolStepRecurrence, string> = {
  once: "once",
  annual: "yearly",
  semi_annual: "twice yearly",
  quarterly: "quarterly",
  monthly: "monthly",
  weekly: "weekly",
  every_n_days: "every N days",
  seasonal_spring: "every spring",
  seasonal_autumn: "every autumn",
  seasonal_spring_autumn: "spring + autumn",
  every_lactation: "each lactation",
};

/** Format a step as a one-liner for tables / summaries. */
export function formatStep(s: ProtocolStep): string {
  const when = TRIGGER_PREFIX[s.trigger](s.at_offset_days);
  const drug = s.drug_name
    ? `${s.drug_name}${s.drug_brand ? ` (${s.drug_brand})` : ""}`
    : null;
  const dose =
    s.dose_amount && s.dose_unit ? `${s.dose_amount} ${s.dose_unit}` : null;
  const route = s.route;
  const rec = s.recurrence === "once" ? null : RECURRENCE_LABEL[s.recurrence];

  const parts = [when, s.label];
  if (drug) parts.push(`— ${drug}`);
  if (dose) parts.push(dose);
  if (route) parts.push(route);
  if (rec) parts.push(`· ${rec}`);
  return parts.filter(Boolean).join(" ");
}

export function recurrenceLabel(r: ProtocolStepRecurrence): string {
  return RECURRENCE_LABEL[r];
}
