import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Breedings" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Breedings"
      description="AI / natural breeding events per cow, with sire NAAB code, technician, semen type, sync protocol."
      livestockOnly={true}
    />
  );
}
