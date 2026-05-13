import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Vaccinations" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Vaccinations"
      description="Per-animal or per-group vaccination events tied to vaccination protocols. Consumes vet medicine stock and triggers withdrawal periods."
      note="Vaccination protocols seed from Settings → Organization → Catalogs."
      livestockOnly={true}
    />
  );
}
