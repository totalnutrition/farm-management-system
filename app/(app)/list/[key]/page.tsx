import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase-auth";
import { loadHerd } from "@/lib/herd-data";
import { daysInMilk, matchesWorklist, worklist } from "@/lib/herd";
import { PopulationTable, type PopRow } from "./population-table";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return { title: worklist(key)?.name ?? "List" };
}

export default async function ListPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  await requireUser();
  const { key } = await params;
  const w = worklist(key);
  if (!w) notFound();

  const { animals, settings } = await loadHerd();
  const rows: PopRow[] = animals
    .filter((a) => matchesWorklist(a, w.key, settings))
    .map((a) => ({
      tag: a.tag,
      name: a.name,
      pen: a.current_pen,
      lact: a.lactation_number,
      repro: a.repro_status,
      dim: daysInMilk(a),
    }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">{w.name}</h1>
        <p className="text-xs text-muted-foreground">
          {w.hint} · {rows.length} cows · this is a query, not a folder
        </p>
      </header>
      <PopulationTable
        listKey={w.key}
        rows={rows}
        defaultAction={w.primaryAction}
      />
    </div>
  );
}
