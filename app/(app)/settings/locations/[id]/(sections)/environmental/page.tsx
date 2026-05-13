import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Location · Environmental" };

export default function Page() {
  return (
    <ComingSoon
      title="Environmental"
      description="Per-barn temperature and humidity time-series. Drives Temperature-Humidity Index (THI) calculations for heat-stress alerts and cooling-system control."
    />
  );
}
