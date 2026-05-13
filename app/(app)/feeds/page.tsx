import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Feeds" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Feeds"
      description="Feed materials catalog — silage, hay, concentrates, additives — with DM%, NEL, CP, NDF, starch. Used in recipes and feeding events."
      note="Catalog seeds from Settings → Organization → Catalogs. Stock levels and consumption land in the next migration."
      livestockOnly={true}
    />
  );
}
