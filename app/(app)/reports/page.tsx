import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Reports"
      description="Saved-report library: cow lists, repro KPIs, milk quality, health, IOFC. Each report is a parameterized query."
      livestockOnly={false}
    />
  );
}
