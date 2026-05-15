/**
 * Single chronological feed for one cow — calvings, repro events,
 * health events, group / pen moves, scores, test days. The view DC305
 * users open most. We collect each source separately then merge by
 * date.
 *
 * Server-only. Wrapped in React.cache so calling it twice in the same
 * render (e.g. event count + feed) hits the DB once.
 */

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase-admin";

export type TimelineKind =
  | "calving"
  | "heat"
  | "breeding"
  | "preg_check"
  | "abortion"
  | "do_not_breed"
  | "fresh"
  | "dry_off"
  | "diagnosis"
  | "treatment"
  | "vaccination"
  | "hoof_trim"
  | "group_move"
  | "pen_move"
  | "score"
  | "test_day";

export type TimelineItem = {
  id: string;
  occurred_at: string; // ISO date (YYYY-MM-DD) — full event-day granularity
  kind: TimelineKind;
  title: string;
  detail: string | null;
  /** Round id when the event was logged during a farm round. */
  round_id?: string | null;
};

const REPRO_TITLES: Record<string, string> = {
  heat: "Heat observed",
  breeding: "Breeding (AI)",
  preg_check: "Pregnancy check",
  abortion: "Abortion",
  do_not_breed: "Do not breed",
  fresh: "Fresh",
  dry_off: "Dry off",
};

const HEALTH_TITLES: Record<string, string> = {
  diagnosis: "Diagnosis",
  treatment: "Treatment",
  vaccination: "Vaccination",
  hoof_trim: "Hoof trim",
};

export const computeCowTimeline = cache(
  async (animalId: string): Promise<TimelineItem[]> => {
    if (!animalId) return [];
    const admin = createAdminClient();

    const [
      { data: calvings },
      { data: repro },
      { data: health },
      { data: gmoves },
      { data: pmoves },
      { data: scores },
      { data: tests },
    ] = await Promise.all([
      admin
        .from("calvings")
        .select(
          "id, calving_date, parity, calving_ease, twin_flag, stillborn, calf_sex, calf_birth_weight_kg, notes",
        )
        .eq("dam_animal_id", animalId),
      admin
        .from("repro_events")
        .select(
          "id, event_date, event_type, sire_naab, technician, result, days_pregnant, notes, round_id",
        )
        .eq("animal_id", animalId),
      admin
        .from("health_events")
        .select(
          "id, event_date, event_type, diagnosis_text, diagnosis_code, drug_name, drug_dose_amount, drug_dose_unit, locomotion_score, severity, notes, round_id",
        )
        .eq("animal_id", animalId),
      admin
        .from("group_moves")
        .select(
          "id, occurred_at, from_group_id, to_group_id, decision, reason",
        )
        .eq("animal_id", animalId),
      admin
        .from("pen_moves")
        .select("id, move_date, from_pen_id, to_pen_id, reason")
        .eq("animal_id", animalId),
      admin
        .from("scores")
        .select("id, scored_at, score_type, score_value, notes")
        .eq("animal_id", animalId),
      admin
        .from("test_days")
        .select("id, test_date, dim, milk_kg, fat_pct, protein_pct, scc, mun")
        .eq("animal_id", animalId),
    ]);

    const items: TimelineItem[] = [];

    for (const r of (calvings ?? []) as Array<{
      id: string;
      calving_date: string;
      parity: number;
      calving_ease: number | null;
      twin_flag: boolean;
      stillborn: boolean;
      calf_sex: string | null;
      calf_birth_weight_kg: number | null;
      notes: string | null;
    }>) {
      const bits: string[] = [`P${r.parity}`];
      if (r.twin_flag) bits.push("twins");
      if (r.stillborn) bits.push("stillborn");
      if (r.calf_sex) bits.push(r.calf_sex);
      if (r.calf_birth_weight_kg) bits.push(`${r.calf_birth_weight_kg} kg`);
      if (r.calving_ease) bits.push(`ease ${r.calving_ease}`);
      items.push({
        id: `calving:${r.id}`,
        occurred_at: r.calving_date,
        kind: "calving",
        title: "Calving",
        detail: bits.length > 0 ? bits.join(" · ") : null,
      });
    }

    for (const r of (repro ?? []) as Array<{
      id: string;
      event_date: string;
      event_type: string;
      sire_naab: string | null;
      technician: string | null;
      result: string | null;
      days_pregnant: number | null;
      notes: string | null;
      round_id: string | null;
    }>) {
      const detail: string[] = [];
      if (r.sire_naab) detail.push(r.sire_naab);
      if (r.technician) detail.push(`by ${r.technician}`);
      if (r.result) detail.push(r.result);
      if (r.days_pregnant !== null) detail.push(`${r.days_pregnant} d preg`);
      if (r.notes) detail.push(r.notes);
      items.push({
        id: `repro:${r.id}`,
        occurred_at: r.event_date,
        kind: r.event_type as TimelineKind,
        title: REPRO_TITLES[r.event_type] ?? r.event_type,
        detail: detail.length > 0 ? detail.join(" · ") : null,
        round_id: r.round_id,
      });
    }

    for (const r of (health ?? []) as Array<{
      id: string;
      event_date: string;
      event_type: string;
      diagnosis_text: string | null;
      diagnosis_code: string | null;
      drug_name: string | null;
      drug_dose_amount: number | null;
      drug_dose_unit: string | null;
      locomotion_score: number | null;
      severity: number | null;
      notes: string | null;
      round_id: string | null;
    }>) {
      const detail: string[] = [];
      if (r.diagnosis_text) detail.push(r.diagnosis_text);
      else if (r.diagnosis_code) detail.push(r.diagnosis_code);
      if (r.drug_name) {
        let drug = r.drug_name;
        if (r.drug_dose_amount && r.drug_dose_unit)
          drug += ` ${r.drug_dose_amount}${r.drug_dose_unit}`;
        detail.push(drug);
      }
      if (r.locomotion_score !== null) detail.push(`LS ${r.locomotion_score}`);
      if (r.severity !== null && r.locomotion_score === null)
        detail.push(`sev ${r.severity}`);
      if (r.notes) detail.push(r.notes);
      items.push({
        id: `health:${r.id}`,
        occurred_at: r.event_date,
        kind: r.event_type as TimelineKind,
        title: HEALTH_TITLES[r.event_type] ?? r.event_type,
        detail: detail.length > 0 ? detail.join(" · ") : null,
        round_id: r.round_id,
      });
    }

    for (const r of (gmoves ?? []) as Array<{
      id: string;
      occurred_at: string;
      decision: string;
      reason: string | null;
    }>) {
      items.push({
        id: `gmove:${r.id}`,
        occurred_at: r.occurred_at.slice(0, 10),
        kind: "group_move",
        title: `Group move (${r.decision})`,
        detail: r.reason,
      });
    }

    for (const r of (pmoves ?? []) as Array<{
      id: string;
      move_date: string;
      reason: string | null;
    }>) {
      items.push({
        id: `pmove:${r.id}`,
        occurred_at: r.move_date,
        kind: "pen_move",
        title: "Pen move",
        detail: r.reason,
      });
    }

    for (const r of (scores ?? []) as Array<{
      id: string;
      scored_at: string;
      score_type: string;
      score_value: number;
      notes: string | null;
    }>) {
      items.push({
        id: `score:${r.id}`,
        occurred_at: r.scored_at.slice(0, 10),
        kind: "score",
        title: `${r.score_type} score`,
        detail: `${r.score_value}${r.notes ? ` · ${r.notes}` : ""}`,
      });
    }

    for (const r of (tests ?? []) as Array<{
      id: string;
      test_date: string;
      dim: number | null;
      milk_kg: number | null;
      fat_pct: number | null;
      protein_pct: number | null;
      scc: number | null;
      mun: number | null;
    }>) {
      const bits: string[] = [];
      if (r.milk_kg !== null) bits.push(`${r.milk_kg} kg`);
      if (r.fat_pct !== null) bits.push(`F ${r.fat_pct}%`);
      if (r.protein_pct !== null) bits.push(`P ${r.protein_pct}%`);
      if (r.scc !== null) bits.push(`SCC ${r.scc}`);
      if (r.mun !== null) bits.push(`MUN ${r.mun}`);
      if (r.dim !== null) bits.push(`${r.dim} DIM`);
      items.push({
        id: `test:${r.id}`,
        occurred_at: r.test_date,
        kind: "test_day",
        title: "Test day",
        detail: bits.length > 0 ? bits.join(" · ") : null,
      });
    }

    return items.sort((a, b) =>
      a.occurred_at < b.occurred_at ? 1 : a.occurred_at > b.occurred_at ? -1 : 0,
    );
  },
);
