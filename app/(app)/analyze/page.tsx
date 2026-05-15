import { requireUser } from "@/lib/supabase-auth";
import { loadHerd } from "@/lib/herd-data";
import { herdKpis } from "@/lib/herd";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analyze" };

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1 p-4 ring-1 ring-foreground/10">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-2xl">{value}</span>
      {sub ? (
        <span className="text-xs text-muted-foreground">{sub}</span>
      ) : null}
    </div>
  );
}

// Doctrine #7: disciplined events exist so the herd can be analyzed.
export default async function AnalyzePage() {
  await requireUser();
  const { animals, settings } = await loadHerd();
  const k = herdKpis(animals, settings);

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Analyze</h1>
        <p className="text-xs text-muted-foreground">
          Computed from the event stream — the payoff of disciplined recording.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi label="Active herd" value={String(k.activeCount)} />
        <Kpi label="In milk" value={String(k.inMilkCount)} />
        <Kpi label="Pregnant" value={String(k.pregnantCount)} />
        <Kpi label="Open" value={String(k.openCount)} />
        <Kpi
          label="Avg DIM"
          value={k.avgDim === null ? "—" : String(k.avgDim)}
        />
        <Kpi
          label="% Pregnant"
          value={k.pctPregnant === null ? "—" : `${k.pctPregnant}%`}
          sub={`target ${settings.kpi_repro_pr_target}+`}
        />
        <Kpi
          label="Open over target"
          value={String(k.openOverTarget)}
          sub={`> ${settings.kpi_max_dim_open} DIM`}
        />
      </div>
    </div>
  );
}
