import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Location · Health protocols" };

export default function HealthPage() {
  return (
    <ComingSoon
      title="Health protocols"
      description="Vaccination schedule, hoof-trim cadence, and per-diagnosis treatment protocols (drugs + dose + route + withdrawal)."
      note="Next dairy-settings PR. Mirrors DC305 SETUP\\VET and Bovisync's Health tab."
    />
  );
}
