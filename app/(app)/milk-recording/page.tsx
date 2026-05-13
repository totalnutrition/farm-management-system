import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Milk recording" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Milk recording"
      description="Per-cow daily milking entry: yield kg/lb, conductivity, inline fat/protein if available. Aggregates into daily yields and feeds the bulk-tank reconciliation."
      livestockOnly={true}
    />
  );
}
