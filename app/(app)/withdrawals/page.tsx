import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Withdrawals" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Withdrawals"
      description="Animals currently on milk or meat withdrawal. Their milk diverts away from the bulk tank; they can't be shipped to slaughter inside the hold window."
      livestockOnly={true}
    />
  );
}
