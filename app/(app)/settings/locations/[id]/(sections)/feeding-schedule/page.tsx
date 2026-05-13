import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Location · Feeding schedule" };

export default function Page() {
  return (
    <ComingSoon
      title="Feeding schedule"
      description="Per-group TMR delivery times, bunk push-up frequency, and feed cost inputs for IOFC reporting."
    />
  );
}
