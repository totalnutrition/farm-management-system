/**
 * Run the group-rules engine over an entire location's active roster
 * and return how many animals would land in each group. Used by the
 * Capacity plan, dashboard tiles, and anywhere we need
 * what-the-engine-actually-says counts (as opposed to manually
 * targeted counts from herd_profile).
 *
 * Server-only.
 */

import { createAdminClient } from "@/lib/supabase-admin";
import {
  suggestGroup,
  type AnimalFacts,
  type GroupDef,
} from "@/lib/group-rules";
import { recentAvgDailyMilk } from "@/lib/milk-stats";

export type Headcount = {
  /** group_id → cow count */
  byGroup: Map<string, number>;
  /** active animals that did not match any group's rules */
  unassigned: number;
  /** total active animals considered */
  total: number;
};

export async function computeGroupHeadcounts(
  locationId: string,
  groups: GroupDef[],
): Promise<Headcount> {
  const admin = createAdminClient();
  const nowMs = Date.now();

  type A = {
    id: string;
    animal_id: string;
    sex: string;
    status: string;
    life_stage: string | null;
    current_lactation: number | null;
    birth_date: string;
    last_calving_date: string | null;
  };

  const [{ data: animalsRaw }, { data: reproRaw }, milkMap] = await Promise.all([
    admin
      .from("animals")
      .select(
        "id, animal_id, sex, status, life_stage, current_lactation, birth_date, last_calving_date",
      )
      .eq("location_id", locationId)
      .eq("status", "active"),
    admin
      .from("repro_events")
      .select("animal_id, event_date, event_type, result, days_pregnant")
      .order("event_date", { ascending: false })
      .limit(2000),
    recentAvgDailyMilk(locationId),
  ]);

  const animals = (animalsRaw ?? []) as A[];
  const ownedIds = new Set(animals.map((a) => a.id));

  // Most recent preg_check per animal.
  type RE = {
    animal_id: string;
    event_date: string;
    event_type: string;
    result: string | null;
    days_pregnant: number | null;
  };
  const latestPC = new Map<string, RE>();
  for (const e of (reproRaw ?? []) as unknown as RE[]) {
    if (e.event_type !== "preg_check") continue;
    if (!ownedIds.has(e.animal_id)) continue;
    if (!latestPC.has(e.animal_id)) latestPC.set(e.animal_id, e);
  }

  const byGroup = new Map<string, number>();
  let unassigned = 0;

  for (const a of animals) {
    const pc = latestPC.get(a.id);
    const isPreg = pc?.result === "pregnant";
    const facts: AnimalFacts = {
      id: a.id,
      animal_id: a.animal_id,
      sex: a.sex,
      status: a.status,
      life_stage: a.life_stage,
      current_lactation: a.current_lactation,
      birth_date: a.birth_date,
      last_calving_date: a.last_calving_date,
      is_pregnant: isPreg,
      days_pregnant: isPreg ? pc?.days_pregnant ?? null : null,
      hospital_flag: false,
      avg_daily_milk: milkMap.get(a.id) ?? null,
    };
    const sug = suggestGroup(facts, groups, nowMs);
    if (sug.group_id) {
      byGroup.set(sug.group_id, (byGroup.get(sug.group_id) ?? 0) + 1);
    } else {
      unassigned += 1;
    }
  }

  return { byGroup, unassigned, total: animals.length };
}
