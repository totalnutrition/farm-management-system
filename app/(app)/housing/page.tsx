import Link from "next/link";
import { PathHousing } from "@/lib/misc";
import BarnsPage from "../barns/page";
import PensPage from "../pens/page";
import GroupingPage from "../grouping/page";

export const metadata = { title: "Housing" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "barns", label: "Barns" },
  { key: "pens", label: "Pens" },
  { key: "groups", label: "Groups" },
] as const;

export default async function HousingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active = TABS.some((t) => t.key === tab) ? tab! : "barns";

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex gap-1 border-b text-xs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`${PathHousing}?tab=${t.key}`}
            className={
              "-mb-px border-b-2 px-3 py-1.5 " +
              (active === t.key
                ? "border-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {t.label}
          </Link>
        ))}
      </div>
      {active === "barns" && <BarnsPage />}
      {active === "pens" && <PensPage />}
      {active === "groups" && <GroupingPage />}
    </div>
  );
}
