import Link from "next/link";
import { PathBreeding } from "@/lib/misc";
import { ProtocolsSection } from "../protocols/protocols-section";
import { SiresSection } from "../sires/sires-section";

export const metadata = { title: "Breeding" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "protocols", label: "Protocols" },
  { key: "sires", label: "Sires & Semen" },
] as const;

export default async function BreedingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active = TABS.some((t) => t.key === tab) ? tab! : "protocols";

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex gap-1 border-b text-xs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`${PathBreeding}?tab=${t.key}`}
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
      {active === "protocols" && <ProtocolsSection />}
      {active === "sires" && <SiresSection />}
    </div>
  );
}
