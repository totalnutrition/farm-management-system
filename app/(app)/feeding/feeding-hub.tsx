"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { CookBookIcon, DeleteThrowIcon, NaturalFoodIcon } from "@hugeicons/core-free-icons";

import { FeedingClient, type FeedingEvent, type GroupOption, type PenOption, type FeedOption } from "./feeding-client";
import { RefusalsClient, type RefusalRow, type FeedEventOption } from "@/app/(app)/refusals/refusals-client";

const TABS = [
  { key: "today", label: "Today" },
  { key: "feedings", label: "Feedings" },
  { key: "refusals", label: "Refusals" },
  { key: "catalog", label: "Feed catalog" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export type DailyAggregate = {
  group_label: string | null;
  pen_name: string | null;
  total_as_fed_kg: number;
  total_dm_kg: number | null;
  total_refusal_kg: number;
  intake_kg: number | null;
};

export function FeedingHub({
  locationId,
  events,
  refusals,
  groups,
  pens,
  feeds,
  feedEventOptions,
  todayAggregates,
}: {
  locationId: string;
  events: FeedingEvent[];
  refusals: RefusalRow[];
  groups: GroupOption[];
  pens: PenOption[];
  feeds: FeedOption[];
  feedEventOptions: FeedEventOption[];
  todayAggregates: DailyAggregate[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const active = (params.get("tab") as TabKey) ?? "today";

  const setTab = (k: TabKey) => {
    const q = new URLSearchParams(params.toString());
    q.set("tab", k);
    router.push(`/feeding?${q.toString()}`);
  };

  return (
    <>
      <nav className="ring-1 ring-foreground/10 flex overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs whitespace-nowrap border-b-2 -mb-px ${
              active === t.key
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {active === "today" ? <TodayTab aggregates={todayAggregates} /> : null}
      {active === "feedings" ? (
        <FeedingClient
          locationId={locationId}
          events={events}
          groups={groups}
          pens={pens}
          feeds={feeds}
        />
      ) : null}
      {active === "refusals" ? (
        <RefusalsClient
          locationId={locationId}
          rows={refusals}
          groups={groups}
          pens={pens}
          feedEvents={feedEventOptions}
        />
      ) : null}
      {active === "catalog" ? <CatalogTab feeds={feeds} /> : null}
    </>
  );
}

function TodayTab({ aggregates }: { aggregates: DailyAggregate[] }) {
  const total = aggregates.reduce((s, a) => s + a.total_as_fed_kg, 0);
  return (
    <section className="ring-1 ring-foreground/10 flex flex-col">
      <header className="px-3 py-2 bg-foreground/5 flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-medium">
            Today by group / pen
            <span className="ml-2 text-[10px] font-normal text-muted-foreground">
              {aggregates.length} row{aggregates.length === 1 ? "" : "s"}
              {total > 0 ? ` · ${total.toFixed(0)} kg total as-fed` : ""}
            </span>
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Today&apos;s feeding deliveries aggregated. Intake = as-fed − refusal.
          </p>
        </div>
      </header>
      {aggregates.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-muted-foreground">
          No feedings logged today yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-foreground/[0.025]">
              <tr className="text-left">
                <th className="px-3 py-1.5 font-medium">Group / Pen</th>
                <th className="px-3 py-1.5 font-medium text-right">As-fed kg</th>
                <th className="px-3 py-1.5 font-medium text-right">DM kg</th>
                <th className="px-3 py-1.5 font-medium text-right">Refusal kg</th>
                <th className="px-3 py-1.5 font-medium text-right">Intake kg</th>
              </tr>
            </thead>
            <tbody>
              {aggregates.map((a, i) => (
                <tr key={i} className="border-t border-foreground/10">
                  <td className="px-3 py-1.5 font-medium">
                    {a.group_label ?? a.pen_name ?? "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {a.total_as_fed_kg.toFixed(1)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {a.total_dm_kg === null ? "—" : a.total_dm_kg.toFixed(1)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {a.total_refusal_kg.toFixed(1)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                    {a.intake_kg === null ? "—" : a.intake_kg.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CatalogTab({ feeds }: { feeds: FeedOption[] }) {
  return (
    <section className="ring-1 ring-foreground/10 flex flex-col">
      <header className="px-3 py-2 bg-foreground/5 flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-medium">
            Feed materials in catalog
            <span className="ml-2 text-[10px] font-normal text-muted-foreground">
              {feeds.length} item{feeds.length === 1 ? "" : "s"}
            </span>
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Read-only snapshot. Add or edit feed materials in Settings →
            Organization → Catalogs.
          </p>
        </div>
        <HugeiconsIcon icon={NaturalFoodIcon} className="size-4 text-muted-foreground" />
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-foreground/[0.025]">
            <tr className="text-left">
              <th className="px-3 py-1.5 font-medium">Name</th>
              <th className="px-3 py-1.5 font-medium text-right">DM %</th>
            </tr>
          </thead>
          <tbody>
            {feeds.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-3 py-4 text-center text-muted-foreground">
                  No feed materials in the catalog.
                </td>
              </tr>
            ) : (
              feeds.map((f) => (
                <tr key={f.id} className="border-t border-foreground/10">
                  <td className="px-3 py-1.5 font-medium inline-flex items-center gap-1.5">
                    <HugeiconsIcon icon={CookBookIcon} className="size-3" />
                    {f.name}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {f.dm_pct ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// keep import used (only referenced in JSX above as an icon component)
void DeleteThrowIcon;
