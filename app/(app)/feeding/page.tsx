import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Feeding" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Feeding"
      description="Per-group feeding events: which recipe, how much delivered, when. Each event deducts from feed stock and links the group, recipe, and operator."
      note="Recipe ↔ ingredient ↔ stock wiring lands with the inventory consumption migration."
      livestockOnly={true}
    />
  );
}
