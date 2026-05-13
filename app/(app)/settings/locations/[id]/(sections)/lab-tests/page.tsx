import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Location · Lab tests" };

export default function Page() {
  return (
    <ComingSoon
      title="Lab tests"
      description="Milk lab, feed lab, soil lab, water lab test result archive. Each result links to the event or sample it was drawn from."
    />
  );
}
