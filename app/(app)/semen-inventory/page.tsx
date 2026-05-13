import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Semen inventory" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Semen inventory"
      description="Sire straws on hand by NAAB code, tank position, and dose count. Each breeding event deducts one dose and links the sire."
      note="Bull NAAB list feeds Breedings autocomplete. Natural-service bulls live in Animals with sex=male."
      livestockOnly={true}
    />
  );
}
