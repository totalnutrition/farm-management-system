import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Preg checks" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Preg checks"
      description="Pregnancy check events: pregnant / open / recheck. Method: palpation, ultrasound, blood (PAG)."
      livestockOnly={true}
    />
  );
}
