import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Test days" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Test days"
      description="DHI test-day entry: milk yield, fat %, protein %, lactose %, SCC, MUN, BHB, test plan. Replaces monthly paper sheets."
      livestockOnly={true}
    />
  );
}
