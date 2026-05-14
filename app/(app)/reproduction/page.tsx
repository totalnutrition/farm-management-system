import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import {
  ReproductionHub,
  type AnimalOpt,
  type EventRow,
  type CalvingRow,
  type SemenStrawRow,
  type ReproDayLists,
  type ActionListRow,
  type VendorOpt,
} from "./reproduction-client";

export const metadata = { title: "Reproduction" };
export const dynamic = "force-dynamic";

function diffDays(from: string, to: Date = new Date()): number {
  return Math.floor((to.getTime() - new Date(from).getTime()) / 86400000);
}

function label(a: { animal_id: string | null; name: string | null }): string {
  return `${a.animal_id ?? "?"}${a.name ? ` · ${a.name}` : ""}`;
}

export default async function ReproductionPage() {
  const active = await getActiveLocation();
  if (!active) {
    return <NoLocationSelected title="No location selected" hint="Reproduction is scoped to the active location." />;
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

  type AnimalRow = {
    id: string;
    animal_id: string;
    name: string | null;
    sex: string;
    status: string;
    life_stage: string | null;
    current_lactation: number | null;
    last_calving_date: string | null;
  };

  const [animalRows, allEvents, calvingRows, strawRows, dairyRow, vendorRows] = await Promise.all([
    admin
      .from("animals")
      .select("id, animal_id, name, sex, status, life_stage, current_lactation, last_calving_date")
      .eq("location_id", active.id)
      .eq("status", "active")
      .order("animal_id")
      .then(({ data }) => (data ?? []) as AnimalRow[]),
    admin
      .from("repro_events")
      .select(
        "id, animal_id, event_date, event_type, sire_naab, service_number, technician, sync_protocol, result, preg_check_method, days_pregnant, notes",
      )
      .order("event_date", { ascending: false })
      .limit(500)
      .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
    admin
      .from("calvings")
      .select(
        "id, dam_animal_id, calving_date, parity, calving_ease, twin_flag, stillborn, calf_sex, calf_birth_weight_kg, notes",
      )
      .order("calving_date", { ascending: false })
      .limit(200)
      .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
    admin
      .from("semen_straws")
      .select("id, naab, sire_name, breed_code, lot, tank_position, stock_item_id")
      .eq("location_id", active.id)
      .order("naab")
      .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
    admin
      .from("location_dairy_settings")
      .select("voluntary_waiting_period_days, preg_check_initial_days, expected_gestation_days")
      .eq("location_id", active.id)
      .maybeSingle()
      .then(({ data }) => data),
    admin
      .from("location_suppliers")
      .select("id, name")
      .eq("location_id", active.id)
      .order("name")
      .then(({ data }) => (data ?? []) as { id: string; name: string }[]),
  ]);

  // Stock balances for straws
  const strawStockIds = strawRows
    .map((s) => s.stock_item_id as string | null)
    .filter(Boolean) as string[];
  const stockById = new Map<string, { qty: number; cost: number | null }>();
  if (strawStockIds.length > 0) {
    const { data } = await admin
      .from("stock_items")
      .select("id, on_hand_qty, unit_cost_current")
      .in("id", strawStockIds);
    for (const r of data ?? []) {
      stockById.set(r.id as string, {
        qty: Number(r.on_hand_qty ?? 0),
        cost: r.unit_cost_current !== null && r.unit_cost_current !== undefined
          ? Number(r.unit_cost_current)
          : null,
      });
    }
  }

  // Animals → only "active, female" for repro context
  const animalById = new Map(animalRows.map((a) => [a.id, a] as const));
  const animals: AnimalOpt[] = animalRows
    .filter((a) => a.sex === "female")
    .map((a) => ({
      id: a.id,
      animal_id: a.animal_id,
      name: a.name,
      life_stage: a.life_stage,
      current_lactation: a.current_lactation,
      last_calving_date: a.last_calving_date,
    }));

  // Per-type event rows (cap at 100 each for the tables)
  const enrich = (e: Record<string, unknown>): EventRow => {
    const a = animalById.get(e.animal_id as string);
    return {
      id: e.id as string,
      event_date: e.event_date as string,
      animal_label: a ? label(a) : "—",
      sire_naab: (e.sire_naab as string | null) ?? null,
      service_number: (e.service_number as number | null) ?? null,
      technician: (e.technician as string | null) ?? null,
      result: (e.result as string | null) ?? null,
      preg_check_method: (e.preg_check_method as string | null) ?? null,
      days_pregnant: (e.days_pregnant as number | null) ?? null,
      notes: (e.notes as string | null) ?? null,
    };
  };

  const heats: EventRow[] = allEvents.filter((e) => e.event_type === "heat").slice(0, 100).map(enrich);
  const breedings: EventRow[] = allEvents.filter((e) => e.event_type === "breeding").slice(0, 100).map(enrich);
  const pregChecks: EventRow[] = allEvents.filter((e) => e.event_type === "preg_check").slice(0, 100).map(enrich);
  const calvings: CalvingRow[] = calvingRows.slice(0, 100).map((c) => {
    const a = animalById.get(c.dam_animal_id as string);
    return {
      id: c.id as string,
      calving_date: c.calving_date as string,
      dam_label: a ? label(a) : "—",
      parity: c.parity as number,
      calving_ease: (c.calving_ease as number | null) ?? null,
      twin_flag: !!c.twin_flag,
      stillborn: !!c.stillborn,
      calf_sex: (c.calf_sex as string | null) ?? null,
      calf_birth_weight_kg: c.calf_birth_weight_kg !== null && c.calf_birth_weight_kg !== undefined
        ? Number(c.calf_birth_weight_kg)
        : null,
      notes: (c.notes as string | null) ?? null,
    };
  });

  const straws: SemenStrawRow[] = strawRows.map((s) => {
    const stock = s.stock_item_id ? stockById.get(s.stock_item_id as string) : null;
    return {
      id: s.id as string,
      naab: s.naab as string,
      sire_name: (s.sire_name as string | null) ?? null,
      breed_code: (s.breed_code as string | null) ?? null,
      lot: (s.lot as string | null) ?? null,
      tank_position: (s.tank_position as string | null) ?? null,
      on_hand_doses: stock?.qty ?? 0,
      unit_cost_current: stock?.cost ?? null,
    };
  });

  const vwp = dairyRow?.voluntary_waiting_period_days ?? 50;
  const pcInitial = dairyRow?.preg_check_initial_days ?? 28;
  const gestation = dairyRow?.expected_gestation_days ?? 280;

  // ----- Today's action lists -------------------------------------------
  // For each animal, find latest breeding and latest preg-check by date.
  const latestByAnimal = new Map<
    string,
    {
      lastBreeding: Record<string, unknown> | null;
      lastPregCheck: Record<string, unknown> | null;
      lastEvent: Record<string, unknown> | null;
    }
  >();
  for (const e of allEvents) {
    const aid = e.animal_id as string;
    const slot = latestByAnimal.get(aid) ?? { lastBreeding: null, lastPregCheck: null, lastEvent: null };
    if (!slot.lastEvent) slot.lastEvent = e;
    if (e.event_type === "breeding" && !slot.lastBreeding) slot.lastBreeding = e;
    if (e.event_type === "preg_check" && !slot.lastPregCheck) slot.lastPregCheck = e;
    latestByAnimal.set(aid, slot);
  }

  const fresh: ActionListRow[] = [];
  const readyToBreed: ActionListRow[] = [];
  const duePregCheck: ActionListRow[] = [];
  const dueCalving: ActionListRow[] = [];
  const nowMs = new Date().getTime();

  for (const a of animalRows) {
    if (a.sex !== "female") continue;
    const lab = label(a);
    const dim = a.last_calving_date ? diffDays(a.last_calving_date) : null;
    const slot = latestByAnimal.get(a.id);

    // Fresh: lactating + DIM ≤ 30
    if (a.life_stage === "lactating" && dim !== null && dim <= 30) {
      fresh.push({
        animal_id: a.id,
        animal_label: lab,
        dim,
        last_event_date: a.last_calving_date,
        last_event_type: "calved",
        days_until_calving: null,
      });
    }

    // Ready to breed: lactating, DIM ≥ VWP, no breeding in last 21d, no positive PC after breeding
    if (a.life_stage === "lactating" && dim !== null && dim >= vwp) {
      const lastBreed = slot?.lastBreeding;
      const bredRecently =
        lastBreed && diffDays(lastBreed.event_date as string) < 21;
      const lastPC = slot?.lastPregCheck;
      const isPregConfirmed = lastPC && lastPC.result === "pregnant";
      if (!bredRecently && !isPregConfirmed) {
        readyToBreed.push({
          animal_id: a.id,
          animal_label: lab,
          dim,
          last_event_date: (lastBreed?.event_date as string | undefined) ?? null,
          last_event_type: lastBreed ? "bred" : null,
          days_until_calving: null,
        });
      }
    }

    // Due preg check
    if (a.life_stage === "lactating" || a.life_stage === "bred_heifer") {
      const lastBreed = slot?.lastBreeding;
      if (lastBreed) {
        const bredAgo = diffDays(lastBreed.event_date as string);
        const lastPC = slot?.lastPregCheck;
        const pcAfterBreed =
          lastPC && new Date(lastPC.event_date as string) >= new Date(lastBreed.event_date as string);
        if (bredAgo >= pcInitial && !pcAfterBreed) {
          duePregCheck.push({
            animal_id: a.id,
            animal_label: lab,
            dim,
            last_event_date: lastBreed.event_date as string,
            last_event_type: `bred ${bredAgo}d ago`,
            days_until_calving: null,
          });
        }
      }
    }

    // Due to calve: latest confirmed pregnancy → expected calving = breeding + gestation
    const lastPC = slot?.lastPregCheck;
    if (lastPC && lastPC.result === "pregnant" && slot?.lastBreeding) {
      const bredDate = new Date(slot.lastBreeding.event_date as string);
      const expected = new Date(bredDate.getTime() + gestation * 86400000);
      const daysUntil = Math.floor((expected.getTime() - nowMs) / 86400000);
      if (daysUntil >= -7 && daysUntil <= 14) {
        dueCalving.push({
          animal_id: a.id,
          animal_label: lab,
          dim,
          last_event_date: expected.toISOString().slice(0, 10),
          last_event_type: "expected calving",
          days_until_calving: daysUntil,
        });
      }
    }
  }

  const lists: ReproDayLists = {
    fresh: fresh.sort((a, b) => (a.dim ?? 0) - (b.dim ?? 0)),
    readyToBreed: readyToBreed.sort((a, b) => (b.dim ?? 0) - (a.dim ?? 0)),
    duePregCheck: duePregCheck.sort((a, b) =>
      (a.last_event_date ?? "").localeCompare(b.last_event_date ?? ""),
    ),
    dueCalving: dueCalving.sort(
      (a, b) => (a.days_until_calving ?? 0) - (b.days_until_calving ?? 0),
    ),
  };

  const vendors: VendorOpt[] = vendorRows.map((v) => ({ id: v.id, name: v.name }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Reproduction</h1>
        <p className="text-xs text-muted-foreground">
          {active.name} · today&apos;s repro workspace. Quick-log heats,
          breedings, preg checks and calvings; track semen straws and dose
          consumption from a single place.
        </p>
      </header>

      <ReproductionHub
        locationId={active.id}
        vwpDays={vwp}
        pregCheckInitialDays={pcInitial}
        gestationDays={gestation}
        animals={animals}
        heats={heats}
        breedings={breedings}
        pregChecks={pregChecks}
        calvings={calvings}
        straws={straws}
        lists={lists}
        vendors={vendors}
      />
    </div>
  );
}
