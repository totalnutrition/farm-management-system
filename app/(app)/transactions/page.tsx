import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Transactions" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Transactions"
      description="Entries and exits: purchase, sale, death, euthanasia, cull-dairy, cull-beef, transfer in/out. Captures price, counterparty, cull reason, carcass weight."
      livestockOnly={false}
    />
  );
}
