import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Heats" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Heats"
      description="Heat detection events per cow. Drives breeding decisions."
      livestockOnly={true}
    />
  );
}
