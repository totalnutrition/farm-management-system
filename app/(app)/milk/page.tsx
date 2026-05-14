import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import {
  MilkHub,
  type AnimalOpt,
  type MilkingRow,
  type TestDayRow,
  type TodayMilkRow,
} from "./milk-client";

export const metadata = { title: "Milk" };
export const dynamic = "force-dynamic";

function diffDays(from: string, to: number): number {
  return Math.floor((to - new Date(from).getTime()) / 86400000);
}

function label(a: { animal_id: string | null; name: string | null }): string {
  return `${a.animal_id ?? "?"}${a.name ? ` · ${a.name}` : ""}`;
}

export default async function MilkPage() {
  const active = await getActiveLocation();
  if (!active) {
    return <NoLocationSelected title="No location selected" hint="Milk recording is scoped to the active location." />;
  }
  if (!active.manages_livestock) {
    return (
      <NoLocationSelected
        title="Livestock module disabled"
        hint={`${active.name} doesn't have the Livestock module enabled.`}
      />
    );
  }

  const admin = createAdminClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  type A = {
    id: string;
    animal_id: string;
    name: string | null;
    current_lactation: number | null;
    last_calving_date: string | null;
    life_stage: string | null;
  };

  const [animalRows, milkingRows, testDayRows] = await Promise.all([
    admin
      .from("animals")
      .select("id, animal_id, name, current_lactation, last_calving_date, life_stage")
      .eq("location_id", active.id)
      .eq("status", "active")
      .order("animal_id")
      .then(({ data }) => (data ?? []) as A[]),
    admin
      .from("milkings")
      .select("id, animal_id, milking_at, milking_session, yield_kg, conductivity, fat_pct, protein_pct")
      .eq("location_id", active.id)
      .order("milking_at", { ascending: false })
      .limit(500)
      .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
    admin
      .from("test_days")
      .select("id, animal_id, test_date, dim, milk_kg, fat_pct, protein_pct, scc, mun, test_plan")
      .order("test_date", { ascending: false })
      .limit(300)
      .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
  ]);

  const animalById = new Map(animalRows.map((a) => [a.id, a] as const));

  // Filter test_days to this location's animals.
  const ownedIds = new Set(animalRows.map((a) => a.id));
  const testDayLocal = testDayRows.filter((t) => ownedIds.has(t.animal_id as string));

  const milkings: MilkingRow[] = milkingRows.map((e) => {
    const a = animalById.get(e.animal_id as string);
    return {
      id: e.id as string,
      milking_at: e.milking_at as string,
      animal_label: a ? label(a) : "—",
      session: (e.milking_session as number | null) ?? null,
      yield_kg: Number(e.yield_kg ?? 0),
      conductivity: e.conductivity !== null && e.conductivity !== undefined ? Number(e.conductivity) : null,
      fat_pct: e.fat_pct !== null && e.fat_pct !== undefined ? Number(e.fat_pct) : null,
      protein_pct: e.protein_pct !== null && e.protein_pct !== undefined ? Number(e.protein_pct) : null,
    };
  });

  const testDays: TestDayRow[] = testDayLocal.map((t) => {
    const a = animalById.get(t.animal_id as string);
    return {
      id: t.id as string,
      test_date: t.test_date as string,
      animal_label: a ? label(a) : "—",
      dim: (t.dim as number | null) ?? null,
      milk_kg: Number(t.milk_kg ?? 0),
      fat_pct: t.fat_pct !== null && t.fat_pct !== undefined ? Number(t.fat_pct) : null,
      protein_pct: t.protein_pct !== null && t.protein_pct !== undefined ? Number(t.protein_pct) : null,
      scc: t.scc !== null && t.scc !== undefined ? Number(t.scc) : null,
      mun: t.mun !== null && t.mun !== undefined ? Number(t.mun) : null,
      test_plan: (t.test_plan as string | null) ?? null,
    };
  });

  // Today aggregation per cow
  const nowMs = new Date().getTime();
  const todayMap = new Map<string, TodayMilkRow>();
  for (const e of milkingRows) {
    if ((e.milking_at as string) < todayStartIso) continue;
    const aid = e.animal_id as string;
    const a = animalById.get(aid);
    const cur =
      todayMap.get(aid) ??
      ({
        animal_id: aid,
        animal_label: a ? label(a) : "—",
        dim: a?.last_calving_date ? diffDays(a.last_calving_date, nowMs) : null,
        am_kg: null,
        pm_kg: null,
        total_kg: 0,
        sessions: 0,
      } as TodayMilkRow);
    const yield_kg = Number(e.yield_kg ?? 0);
    cur.total_kg += yield_kg;
    cur.sessions += 1;
    const session = e.milking_session as number | null;
    if (session === 1) cur.am_kg = (cur.am_kg ?? 0) + yield_kg;
    else if (session === 2) cur.pm_kg = (cur.pm_kg ?? 0) + yield_kg;
    todayMap.set(aid, cur);
  }
  const todayRows = Array.from(todayMap.values()).sort(
    (a, b) => b.total_kg - a.total_kg,
  );
  const totalKg = todayRows.reduce((s, r) => s + r.total_kg, 0);
  const cows = todayRows.length;
  const avgKg = cows > 0 ? totalKg / cows : 0;

  const animals: AnimalOpt[] = animalRows
    .filter((a) => a.life_stage === "lactating" || a.life_stage === null)
    .map((a) => ({
      id: a.id,
      animal_id: a.animal_id,
      name: a.name,
      current_lactation: a.current_lactation,
      last_calving_date: a.last_calving_date,
    }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Milk</h1>
        <p className="text-xs text-muted-foreground">
          {active.name} · per-cow milkings + DHIA-style test-day results.
          Today panel rolls up to total kg, cows milked, and average.
        </p>
      </header>

      <MilkHub
        locationId={active.id}
        animals={animals}
        milkings={milkings}
        testDays={testDays}
        todayRows={todayRows}
        todayTotals={{ totalKg, cows, avgKg }}
      />
    </div>
  );
}
