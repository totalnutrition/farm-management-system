import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Location · Operations" };

export default function OperationsPage() {
  return (
    <ComingSoon
      title="Operations"
      description="Milking shifts (AM / PM / 3rd) with start times, holiday calendar, and feed-cost inputs for IOFC reporting."
      note="Next dairy-settings PR."
    />
  );
}
