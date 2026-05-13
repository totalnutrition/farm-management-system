import { getActiveLocation } from "@/lib/locations";
import { listArableParcels } from "@/app/(app)/settings/locations/[id]/arable-parcels-actions";
import { listCropPlansForLocation } from "@/app/(app)/settings/locations/[id]/crops-actions";
import { CropsClient } from "@/app/(app)/settings/locations/[id]/crops-client";
import { NoLocationSelected } from "@/components/no-location-selected";

export const metadata = { title: "Forage & crops" };
export const dynamic = "force-dynamic";

export default async function CropsPage() {
  const active = await getActiveLocation();
  if (!active) {
    return (
      <NoLocationSelected
        title="No location selected"
        hint="Pick a location from the top-right switcher."
      />
    );
  }
  if (!active.manages_crops) {
    return (
      <NoLocationSelected
        title="Crops module disabled"
        hint={`${active.name} doesn't have the Crops module enabled. Turn it on in Settings → Locations.`}
      />
    );
  }

  const [parcels, plans] = await Promise.all([
    listArableParcels(active.id),
    listCropPlansForLocation(active.id),
  ]);

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Forage &amp; crops</h1>
        <p className="text-xs text-muted-foreground">
          Crop plans tied to arable parcels at {active.name}. Log events as
          the season progresses — planting, irrigation, fertilization, spray,
          scouting, harvest.
        </p>
      </header>
      <CropsClient
        parcels={parcels.map((p) => ({
          id: p.id,
          name: p.name,
          area_hectares: p.area_hectares,
        }))}
        plans={plans}
      />
    </div>
  );
}
