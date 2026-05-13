import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Refusals" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Refusals"
      description="Per-pen refusal (orts) weight, paired with the matching feeding event. Drives intake calculations and recipe correction."
      livestockOnly={true}
    />
  );
}
