import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import {
  VaccinationsClient,
  type VaccinationRow,
  type AnimalOption,
  type GroupOption,
  type VetOption,
} from "./vaccinations-client";

export const metadata = { title: "Vaccinations" };
export const dynamic = "force-dynamic";

export default async function VaccinationsPage() {
  const active = await getActiveLocation();
  if (!active) {
    return <NoLocationSelected title="No location selected" hint="Vaccinations are scoped to the active location." />;
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
  const [evRows, animalRows, groupRows, vetRows] = await Promise.all([
    admin
      .from("vaccination_events")
      .select(
        "id, occurred_at, animal_id, group_id, vet_medicine_id, dose_ml, route, withdrawal_milk_until, withdrawal_meat_until, note",
      )
      .eq("location_id", active.id)
      .order("occurred_at", { ascending: false })
      .limit(100)
      .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
    admin
      .from("animals")
      .select("id, animal_id, name")
      .eq("location_id", active.id)
      .eq("status", "active")
      .order("animal_id")
      .then(({ data }) => (data ?? []) as { id: string; animal_id: string | null; name: string | null }[]),
    admin
      .from("location_groups")
      .select("id, label")
      .eq("location_id", active.id)
      .order("display_order")
      .then(({ data }) => (data ?? []) as { id: string; label: string }[]),
    admin
      .from("org_vet_medicines")
      .select("id, name, default_dose, route, withdrawal_milk_hours, withdrawal_meat_days")
      .order("name")
      .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
  ]);

  const medNameById = new Map(vetRows.map((m) => [m.id as string, m.name as string]));
  const animalLabelById = new Map(
    animalRows.map((a) => [
      a.id,
      `${a.animal_id ?? "?"}${a.name ? ` · ${a.name}` : ""}`,
    ] as const),
  );
  const groupById = new Map(groupRows.map((g) => [g.id, g.label] as const));

  const rows: VaccinationRow[] = evRows.map((e) => ({
    id: e.id as string,
    occurred_at: e.occurred_at as string,
    animal_label: e.animal_id ? animalLabelById.get(e.animal_id as string) ?? null : null,
    group_label: e.group_id ? groupById.get(e.group_id as string) ?? null : null,
    medicine_name: e.vet_medicine_id
      ? medNameById.get(e.vet_medicine_id as string) ?? null
      : null,
    dose_ml: e.dose_ml !== null && e.dose_ml !== undefined ? Number(e.dose_ml) : null,
    route: (e.route as string | null) ?? null,
    withdrawal_milk_until: (e.withdrawal_milk_until as string | null) ?? null,
    withdrawal_meat_until: (e.withdrawal_meat_until as string | null) ?? null,
    note: (e.note as string | null) ?? null,
  }));

  const animals: AnimalOption[] = animalRows.map((a) => ({
    id: a.id,
    label: `${a.animal_id ?? "?"}${a.name ? ` · ${a.name}` : ""}`,
  }));
  const groups: GroupOption[] = groupRows.map((g) => ({ id: g.id, label: g.label }));
  const vetMeds: VetOption[] = vetRows.map((m) => ({
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
        <h1 className="font-heading text-lg font-medium">Vaccinations</h1>
        <p className="text-xs text-muted-foreground">
          {active.name} · per-animal or per-group vaccination events. Doses
          deduct from stock; withdrawal end-dates roll up to Withdrawals.
        </p>
      </header>

      <VaccinationsClient
        locationId={active.id}
        rows={rows}
        animals={animals}
        groups={groups}
        vetMeds={vetMeds}
      />
    </div>
  );
}
