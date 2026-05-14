import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import {
  HealthHub,
  type AnimalOpt,
  type GroupOpt,
  type DiagnosisOpt,
  type RouteOpt,
  type VetOpt,
  type HealthRow,
  type VaxRow,
  type WithdrawalRow,
} from "./health-client";

export const metadata = { title: "Health" };
export const dynamic = "force-dynamic";

function label(a: { animal_id: string | null; name: string | null }): string {
  return `${a.animal_id ?? "?"}${a.name ? ` · ${a.name}` : ""}`;
}

export default async function HealthPage() {
  const active = await getActiveLocation();
  if (!active) {
    return <NoLocationSelected title="No location selected" hint="Health is scoped to the active location." />;
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
  type A = { id: string; animal_id: string; name: string | null; life_stage: string | null };

  const [animalRows, diagRows, routeRows, vetRows, healthEvRows, vaxEvRows, groupRows] =
    await Promise.all([
      admin
        .from("animals")
        .select("id, animal_id, name, life_stage")
        .eq("location_id", active.id)
        .eq("status", "active")
        .order("animal_id")
        .then(({ data }) => (data ?? []) as A[]),
      admin
        .from("diagnoses_catalog")
        .select("code, name")
        .order("display_order")
        .then(({ data }) => (data ?? []) as { code: string; name: string }[]),
      admin
        .from("routes_catalog")
        .select("code, name")
        .order("display_order")
        .then(({ data }) => (data ?? []) as { code: string; name: string }[]),
      admin
        .from("org_vet_medicines")
        .select("id, name, default_dose, route, withdrawal_milk_hours, withdrawal_meat_days")
        .order("name")
        .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
      admin
        .from("health_events")
        .select(
          "id, animal_id, event_date, event_type, diagnosis_code, diagnosis_text, severity, quarter, drug_name, drug_dose_amount, drug_dose_unit, route_code, withdrawal_milk_end, withdrawal_meat_end, notes",
        )
        .order("event_date", { ascending: false })
        .limit(300)
        .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
      admin
        .from("vaccination_events")
        .select(
          "id, occurred_at, animal_id, group_id, vet_medicine_id, dose_ml, route, withdrawal_milk_until, withdrawal_meat_until",
        )
        .eq("location_id", active.id)
        .order("occurred_at", { ascending: false })
        .limit(200)
        .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
      admin
        .from("location_groups")
        .select("id, label")
        .eq("location_id", active.id)
        .order("display_order")
        .then(({ data }) => (data ?? []) as { id: string; label: string }[]),
    ]);

  const animalById = new Map(animalRows.map((a) => [a.id, a] as const));
  const diagByCode = new Map(diagRows.map((d) => [d.code, d.name] as const));
  const medById = new Map(vetRows.map((m) => [m.id as string, m.name as string] as const));
  const groupById = new Map(groupRows.map((g) => [g.id, g.label] as const));

  // Filter health_events to this location by joining via animal_id.
  const ownedAnimalIds = new Set(animalRows.map((a) => a.id));
  const healthLocal = healthEvRows.filter((e) => ownedAnimalIds.has(e.animal_id as string));

  const healthRows: HealthRow[] = healthLocal.map((e) => {
    const a = animalById.get(e.animal_id as string);
    const dose =
      e.drug_dose_amount !== null && e.drug_dose_amount !== undefined
        ? `${Number(e.drug_dose_amount)} ${e.drug_dose_unit ?? ""}`.trim()
        : null;
    const diagName = (e.diagnosis_code as string | null) ? diagByCode.get(e.diagnosis_code as string) ?? null : null;
    const diagText = (e.diagnosis_text as string | null) ?? null;
    return {
      id: e.id as string,
      event_date: e.event_date as string,
      animal_label: a ? label(a) : "—",
      event_type: e.event_type as string,
      diagnosis: diagName ?? diagText ?? null,
      severity: (e.severity as number | null) ?? null,
      drug_name: (e.drug_name as string | null) ?? null,
      dose,
      route: (e.route_code as string | null) ?? null,
      milk_wd_end: (e.withdrawal_milk_end as string | null) ?? null,
      meat_wd_end: (e.withdrawal_meat_end as string | null) ?? null,
      notes: (e.notes as string | null) ?? null,
    };
  });

  const vaxRows: VaxRow[] = vaxEvRows.map((e) => {
    const a = e.animal_id ? animalById.get(e.animal_id as string) : null;
    return {
      id: e.id as string,
      occurred_at: e.occurred_at as string,
      animal_label: a ? label(a) : null,
      group_label: e.group_id ? groupById.get(e.group_id as string) ?? null : null,
      medicine_name: e.vet_medicine_id ? medById.get(e.vet_medicine_id as string) ?? null : null,
      dose_ml: e.dose_ml !== null && e.dose_ml !== undefined ? Number(e.dose_ml) : null,
      route: (e.route as string | null) ?? null,
      milk_wd: (e.withdrawal_milk_until as string | null) ?? null,
      meat_wd: (e.withdrawal_meat_until as string | null) ?? null,
    };
  });

  // Compute withdrawals (active + cleared) by merging both event sources.
  const nowMs = new Date().getTime();
  const withdrawals: WithdrawalRow[] = [];
  for (const h of healthLocal) {
    const milkEnd = h.withdrawal_milk_end as string | null;
    const meatEnd = h.withdrawal_meat_end as string | null;
    if (!milkEnd && !meatEnd) continue;
    const a = animalById.get(h.animal_id as string);
    withdrawals.push({
      animal_id: h.animal_id as string,
      animal_label: a ? label(a) : "—",
      drug: (h.drug_name as string | null) ?? "—",
      source: "health",
      event_date: h.event_date as string,
      milk_wd_end: milkEnd,
      meat_wd_end: meatEnd,
      hours_until_milk: milkEnd
        ? Math.max(0, Math.floor((new Date(milkEnd).getTime() - nowMs) / 3600000))
        : null,
      days_until_meat: meatEnd
        ? Math.max(0, Math.floor((new Date(meatEnd).getTime() - nowMs) / 86400000))
        : null,
    });
  }
  for (const v of vaxEvRows) {
    const milkEnd = v.withdrawal_milk_until as string | null;
    const meatEnd = v.withdrawal_meat_until as string | null;
    if (!milkEnd && !meatEnd) continue;
    const a = v.animal_id ? animalById.get(v.animal_id as string) : null;
    withdrawals.push({
      animal_id: (v.animal_id as string) ?? "",
      animal_label: a ? label(a) : (v.group_id ? groupById.get(v.group_id as string) ?? "—" : "—"),
      drug: v.vet_medicine_id ? medById.get(v.vet_medicine_id as string) ?? "—" : "—",
      source: "vaccination",
      event_date: (v.occurred_at as string).slice(0, 10),
      milk_wd_end: milkEnd,
      meat_wd_end: meatEnd,
      hours_until_milk: milkEnd
        ? Math.max(0, Math.floor((new Date(milkEnd).getTime() - nowMs) / 3600000))
        : null,
      days_until_meat: meatEnd
        ? Math.max(0, Math.floor((new Date(meatEnd).getTime() - nowMs) / 86400000))
        : null,
    });
  }
  // Sort active first by hours/days remaining desc.
  withdrawals.sort((a, b) => {
    const aActive = (a.hours_until_milk ?? 0) > 0 || (a.days_until_meat ?? 0) > 0 ? 1 : 0;
    const bActive = (b.hours_until_milk ?? 0) > 0 || (b.days_until_meat ?? 0) > 0 ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    return (b.hours_until_milk ?? 0) - (a.hours_until_milk ?? 0);
  });

  const animals: AnimalOpt[] = animalRows.map((a) => ({
    id: a.id,
    animal_id: a.animal_id,
    name: a.name,
    life_stage: a.life_stage,
  }));
  const groups: GroupOpt[] = groupRows.map((g) => ({ id: g.id, label: g.label }));
  const diagnoses: DiagnosisOpt[] = diagRows.map((d) => ({ code: d.code, name: d.name }));
  const routes: RouteOpt[] = routeRows.map((r) => ({ code: r.code, name: r.name }));
  const vetMeds: VetOpt[] = vetRows.map((m) => ({
    id: m.id as string,
    name: m.name as string,
    default_dose: (m.default_dose as string | null) ?? null,
    route: (m.route as string | null) ?? null,
    withdrawal_milk_hours: (m.withdrawal_milk_hours as number | null) ?? null,
    withdrawal_meat_days: (m.withdrawal_meat_days as number | null) ?? null,
  }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Health</h1>
        <p className="text-xs text-muted-foreground">
          {active.name} · diagnoses, treatments, vaccinations, and withdrawals
          in one workspace. Doses deduct from vet stock; milk/meat hold dates
          compute from the catalog.
        </p>
      </header>

      <HealthHub
        locationId={active.id}
        animals={animals}
        groups={groups}
        diagnoses={diagnoses}
        routes={routes}
        vetMeds={vetMeds}
        healthRows={healthRows}
        vaxRows={vaxRows}
        withdrawals={withdrawals}
      />
    </div>
  );
}
