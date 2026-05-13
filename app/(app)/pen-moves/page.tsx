import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Pen moves" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Pen moves"
      description="Pen-move events with from-pen, to-pen, reason. History supports DIM-by-pen reports and fresh-cow performance tracking."
      livestockOnly={true}
    />
  );
}
