// Intake planner — isomorphic, zero-dependency. Turns a cohort
// snapshot (what a DC dairy enters to register an animal) into SEED
// EVENTS + facts so the derivation engine yields correct current
// state from day one. Pure: no DB/DOM. Conformance-tested.
//
// NOTE: only source-confirmed event codes are emitted (FRESH=1,
// BRED=5, DRY=11). Finer repro states that need an unconfirmed code
// (OPEN/PREG) are captured as facts/attrs and surfaced, never faked —
// the same documented numeric-map gap as the rest of the engine.

import type { Event, IntakeFacts } from "./engine.ts";

export type Cohort =
  | "lactating"
  | "dry"
  | "bred_heifer"
  | "open_heifer"
  | "calf";

export type IntakeSnapshot = {
  cohort: Cohort;
  animalId: string;
  breed?: string;
  birthDate?: string;
  lactation: number; // current lactation number (0 for heifer/calf)
  freshDate?: string; // last calving / fresh
  lastBredDate?: string;
  serviceSire?: string;
  dueDate?: string; // if pregnant
  dryOffDate?: string;
  pen?: string;
  eid?: string;
  damId?: string;
  sireId?: string;
  registration?: string;
  entryReason?: string;
  entryDate: string;
};

export type SeedResult = {
  events: Event[];
  facts: IntakeFacts;
  attrs: Record<string, unknown>;
  problems: string[];
};

const EC_FRESH = 1;
const EC_BRED = 5;
const EC_DRY = 11;

const CALVED: Cohort[] = ["lactating", "dry"];
const isCalved = (c: Cohort) => CALVED.includes(c);

// Required-by-cohort validation (also reused by the server action).
export function validateSnapshot(s: IntakeSnapshot): string[] {
  const p: string[] = [];
  if (!s.animalId?.trim()) p.push("Animal ID is required.");
  if (!s.entryDate) p.push("Entry date is required.");
  if (!Number.isInteger(s.lactation) || s.lactation < 0)
    p.push("Lactation number must be 0 or more.");
  if (isCalved(s.cohort) && !s.freshDate)
    p.push("Fresh (last calving) date is required for this cohort.");
  if (isCalved(s.cohort) && s.lactation < 1)
    p.push("A calved cow must be in lactation 1 or more.");
  if (s.cohort === "dry" && !s.dryOffDate)
    p.push("Dry-off date is required for a dry cow.");
  if (s.cohort === "bred_heifer" && !s.lastBredDate)
    p.push("Last bred date is required for a bred heifer.");
  if (s.lastBredDate && !s.serviceSire)
    p.push("Service sire is required when a bred date is given.");
  return p;
}

export function planSeed(s: IntakeSnapshot): SeedResult {
  const problems = validateSnapshot(s);

  const events: Event[] = [];
  // calved cohorts: the current lactation began with a FRESH event;
  // baseLactation carries the prior count so LACT = base + this FRESH.
  let baseLactation = s.lactation;
  if (isCalved(s.cohort) && s.freshDate) {
    baseLactation = Math.max(s.lactation - 1, 0);
    events.push({ code: EC_FRESH, date: s.freshDate });
  }
  if (s.lastBredDate) {
    events.push({
      code: EC_BRED,
      date: s.lastBredDate,
      payload: s.serviceSire ? { sire: s.serviceSire } : {},
    });
  }
  if (s.cohort === "dry" && s.dryOffDate) {
    events.push({ code: EC_DRY, date: s.dryOffDate });
  }

  const facts: IntakeFacts = { baseLactation };
  if (s.birthDate) facts.birthDate = s.birthDate;
  if (s.dueDate) facts.dueDate = s.dueDate;
  // breeding ≈ conception / last heat for derived DCC & DSLH
  if (s.lastBredDate) {
    facts.conceptionDate = s.lastBredDate;
    facts.lastHeatDate = s.lastBredDate;
  }

  const attrs: Record<string, unknown> = {
    base_lactation: baseLactation,
    cohort: s.cohort,
    entry_date: s.entryDate,
  };
  if (s.breed) attrs.breed = s.breed;
  if (s.pen) attrs.pen = s.pen;
  if (s.birthDate) attrs.birth_date = s.birthDate;
  if (s.dueDate) attrs.due_date = s.dueDate;
  if (s.lastBredDate) attrs.conception_date = s.lastBredDate;
  if (s.serviceSire) attrs.service_sire = s.serviceSire;
  if (s.eid) attrs.eid = s.eid;
  if (s.damId) attrs.dam_id = s.damId;
  if (s.sireId) attrs.sire_id = s.sireId;
  if (s.registration) attrs.registration = s.registration;
  if (s.entryReason) attrs.entry_reason = s.entryReason;

  return { events, facts, attrs, problems };
}
