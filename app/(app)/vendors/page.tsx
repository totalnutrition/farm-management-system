import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Vendors" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Vendors"
      description="Suppliers for feed, vet medicine, semen, equipment, and services. Each procurement entry references one vendor; balances and payment terms roll up here."
      livestockOnly={false}
    />
  );
}
