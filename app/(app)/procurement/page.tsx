import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Procurement" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Procurement"
      description="Purchase orders and goods-received notes. Each receipt lands as a stock increase and links the vendor, item, unit cost, and invoice."
      livestockOnly={false}
    />
  );
}
