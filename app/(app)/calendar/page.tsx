import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Calendar"
      description="Calendar view of upcoming events: due-to-calve, due-for-preg-check, due-for-breeding, hoof-trim due, vaccination due."
      livestockOnly={true}
    />
  );
}
