import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Health events" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Health events"
      description="Diagnoses, treatments, vaccinations, hoof trims per cow. Drives the Withdrawals list and hospital pen flags."
      livestockOnly={true}
    />
  );
}
