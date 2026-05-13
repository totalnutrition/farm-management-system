import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import {
  listAnimals,
} from "@/app/(app)/settings/locations/[id]/animals-actions";
import { listPens } from "@/app/(app)/settings/locations/[id]/pens-actions";
import { getGroups } from "@/app/(app)/settings/locations/[id]/groups-actions";
import { AnimalsTable } from "@/app/(app)/settings/locations/[id]/animals-table";
import { NoLocationSelected } from "@/components/no-location-selected";
import { AnimalsToolbar } from "./animals-toolbar";

export const metadata = { title: "Animals" };
export const dynamic = "force-dynamic";

const STATUS_VALUES = ["active", "sold", "dead", "culled", "reference"] as const;

export default async function AnimalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const active = await getActiveLocation();
  if (!active) {
    return (
      <NoLocationSelected
        title="No location selected"
        hint="Animals are scoped to the active location. Pick one in the top-right switcher."
      />
    );
  }
  if (!active.manages_livestock) {
    return (
      <NoLocationSelected
        title="Livestock module disabled"
        hint={`${active.name} doesn't have the Livestock module enabled. Turn it on in Settings → Locations.`}
      />
    );
  }

  const { status } = await searchParams;
  const validStatus =
    status && STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number])
      ? (status as string)
      : null;

  const admin = createAdminClient();
  const [rows, pens, groups, breeds, statusCountsRaw] = await Promise.all([
    listAnimals(active.id, validStatus),
    listPens(active.id),
    getGroups(active.id),
    admin
      .from("breeds_catalog")
      .select("code, name")
      .order("display_order")
      .then(({ data }) => (data ?? []) as { code: string; name: string }[]),
    admin
      .from("animals")
      .select("status")
      .eq("location_id", active.id)
      .then(({ data }) => (data ?? []) as { status: string }[]),
  ]);

  const totalsByStatus: Record<string, number> = {};
  for (const r of statusCountsRaw) {
    totalsByStatus[r.status] = (totalsByStatus[r.status] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-lg font-medium">Animals</h1>
            <p className="text-xs text-muted-foreground">
              Roster at {active.name}. Use the top-right switcher to change
              location.
            </p>
          </div>
          <AnimalsToolbar
            locationId={active.id}
            hasNoAnimals={rows.length === 0}
          />
        </div>
      </header>
      <AnimalsTable
        locationId={active.id}
        rows={rows}
        pens={pens.map((p) => ({ id: p.id, name: p.name }))}
        groups={groups.map((g) => ({ id: g.id, label: g.label }))}
        breeds={breeds}
        statusFilter={validStatus}
        totalsByStatus={totalsByStatus}
      />
    </div>
  );
}
