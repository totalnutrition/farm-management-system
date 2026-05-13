import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Location · Alerts" };

export default function Page() {
  return (
    <ComingSoon
      title="Alerts"
      description="Standing alerts the dashboard surfaces: cows due to calve, cows under withdrawal, SCC outliers, dry-off candidates, repro-due cows, low-yield outliers."
    />
  );
}
