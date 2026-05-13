import { getActiveLocation } from "@/lib/locations";
import {
  listDiversions,
  listTankReadings,
} from "@/app/(app)/settings/locations/[id]/bulk-tank-actions";
import { BulkTankClient } from "@/app/(app)/settings/locations/[id]/bulk-tank-client";
import { NoLocationSelected } from "@/components/no-location-selected";

export const metadata = { title: "Bulk tank" };
export const dynamic = "force-dynamic";

export default async function BulkTankPage() {
  const active = await getActiveLocation();
  if (!active) {
    return <NoLocationSelected title="No location selected" />;
  }
  if (!active.manages_livestock) {
    return (
      <NoLocationSelected
        title="Livestock module disabled"
        hint={`Bulk tank tracking applies to dairy locations. Enable Livestock in Settings → Locations for ${active.name}.`}
      />
    );
  }

  const [readings, diversions] = await Promise.all([
    listTankReadings(active.id),
    listDiversions(active.id),
  ]);

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Bulk tank</h1>
        <p className="text-xs text-muted-foreground">
          Daily readings and milk diversions for {active.name}. Full
          reconciliation against per-cow milkings ships when daily entry
          forms land.
        </p>
      </header>
      <BulkTankClient
        locationId={active.id}
        readings={readings}
        diversions={diversions}
      />
    </div>
  );
}
