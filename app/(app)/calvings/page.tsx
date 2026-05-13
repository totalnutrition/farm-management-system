import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Calvings" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Calvings"
      description="Calving records: dam, date, calf identity, calving ease, twin flag, stillborn flag, retained placenta."
      livestockOnly={true}
    />
  );
}
