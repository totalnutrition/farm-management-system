import { getActiveLocation } from "@/lib/locations";
import { ComingSoon } from "@/components/coming-soon";
import { NoLocationSelected } from "@/components/no-location-selected";

export const metadata = { title: "Milk recording" };
export const dynamic = "force-dynamic";

export default async function MilkRecordingPage() {
  const active = await getActiveLocation();
  if (!active) {
    return <NoLocationSelected title="No location selected" />;
  }
  if (!active.manages_livestock) {
    return (
      <NoLocationSelected
        title="Livestock module disabled"
        hint={`Milk recording applies to dairy locations. Enable Livestock for ${active.name} in Settings → Locations.`}
      />
    );
  }

  return (
    <ComingSoon
      title="Milk recording"
      description="Per-cow milkings entry, test-day records, and daily yield rollups for the parlor."
      note="Schedule + method are configured under Settings → Locations → Milk recording setup. The day-to-day entry UI lands in PR-N."
    />
  );
}
