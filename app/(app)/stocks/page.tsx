import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Stocks" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Stocks"
      description="On-hand inventory: feed materials, vet medicines, semen straws, consumables. Each operational event (feeding, treatment, vaccination, breeding) deducts the right line and surfaces a low-stock alert."
      note="Stock ledger lands next: opening balances, receipts from procurement, consumption from operations, adjustments."
      livestockOnly={false}
    />
  );
}
