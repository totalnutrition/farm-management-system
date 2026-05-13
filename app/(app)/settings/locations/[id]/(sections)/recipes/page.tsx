import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Location · TMR recipes" };

export default function Page() {
  return (
    <ComingSoon
      title="TMR recipes"
      description="Ration formulations: ingredients (from the feed catalog) + quantities. Feeding events consume ingredients from inventory."
      note="Feed materials are already seeded under Organization → Catalogs."
    />
  );
}
