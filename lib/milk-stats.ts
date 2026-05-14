/**
 * Recent average daily milk per cow at a location.
 * Server-only — pulls last-7-days milkings, buckets by (animal, day),
 * returns the per-cow mean of those daily totals. Returns null only
 * for cows with zero recent milkings.
 */

import { createAdminClient } from "@/lib/supabase-admin";

const WINDOW_DAYS = 7;

export async function recentAvgDailyMilk(
  locationId: string,
): Promise<Map<string, number>> {
  const admin = createAdminClient();
  const sinceMs = Date.now() - WINDOW_DAYS * 86400000;
  const sinceIso = new Date(sinceMs).toISOString();

  const { data } = await admin
    .from("milkings")
    .select("animal_id, milking_at, yield_kg")
    .eq("location_id", locationId)
    .gte("milking_at", sinceIso);

  // animal_id → date string → daily total
  const byAnimalDay = new Map<string, Map<string, number>>();
  for (const m of data ?? []) {
    const aid = m.animal_id as string;
    const date = (m.milking_at as string).slice(0, 10);
    const kg = Number(m.yield_kg ?? 0);
    let dayMap = byAnimalDay.get(aid);
    if (!dayMap) {
      dayMap = new Map();
      byAnimalDay.set(aid, dayMap);
    }
    dayMap.set(date, (dayMap.get(date) ?? 0) + kg);
  }

  const avgByAnimal = new Map<string, number>();
  for (const [aid, dayMap] of byAnimalDay) {
    const days = Array.from(dayMap.values());
    if (days.length === 0) continue;
    const sum = days.reduce((a, b) => a + b, 0);
    avgByAnimal.set(aid, sum / days.length);
  }
  return avgByAnimal;
}
