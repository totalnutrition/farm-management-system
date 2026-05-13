import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Hot list" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Hot list"
      description="Cows that need action today: due for preg check, due for breeding, due to dry off, due to calve, on withdrawal hold, lame, SCC outliers, low-yield outliers."
      note="Aggregates events + thresholds from Settings → Reproduction and Quality & withdrawal. Lands as a real list in a follow-up PR."
      livestockOnly={true}
    />
  );
}
