import Link from "next/link";
import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import { requireAnyRole } from "@/lib/supabase-auth";
import { StartRoundButton } from "./start-round-button";

export const metadata = { title: "Farm rounds" };
export const dynamic = "force-dynamic";

type RoundRow = {
  id: string;
  supervisor_name: string | null;
  started_at: string;
  completed_at: string | null;
  status: "active" | "completed" | "abandoned";
  notes: string | null;
};

type ObsCount = { round_id: string; count: number };

export default async function RoundsPage() {
  await requireAnyRole(["super_admin", "admin"]);
  const active = await getActiveLocation();
  if (!active) {
    return (
      <NoLocationSelected
        title="No location selected"
        hint="Rounds are scoped to the active location."
      />
    );
  }
  if (!active.manages_livestock) {
    return (
      <NoLocationSelected
        title="Livestock module disabled"
        hint={`${active.name} doesn't have the Livestock module enabled.`}
      />
    );
  }

  const admin = createAdminClient();

  const [{ data: roundsRaw }, { data: reproCounts }, { data: healthCounts }] =
    await Promise.all([
      admin
        .from("farm_rounds")
        .select(
          "id, supervisor_name, started_at, completed_at, status, notes",
        )
        .eq("location_id", active.id)
        .order("started_at", { ascending: false })
        .limit(50),
      admin
        .from("repro_events")
        .select("round_id")
        .not("round_id", "is", null),
      admin
        .from("health_events")
        .select("round_id")
        .not("round_id", "is", null),
    ]);

  const counts = new Map<string, number>();
  for (const r of (reproCounts ?? []) as Array<{ round_id: string | null }>) {
    if (r.round_id) counts.set(r.round_id, (counts.get(r.round_id) ?? 0) + 1);
  }
  for (const r of (healthCounts ?? []) as Array<{ round_id: string | null }>) {
    if (r.round_id) counts.set(r.round_id, (counts.get(r.round_id) ?? 0) + 1);
  }
  void { reproCounts, healthCounts } as unknown as ObsCount[];

  const rounds = (roundsRaw ?? []) as RoundRow[];
  const active_rounds = rounds.filter((r) => r.status === "active");
  const completed = rounds.filter((r) => r.status !== "active");

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-lg font-medium">Farm rounds</h1>
          <p className="text-xs text-muted-foreground">
            {active.name} · supervisors walk the barn and log heats,
            sickness, injuries, and lameness on the spot. Scan the cow&apos;s
            ear tag (or type her ID), tap the right button, move on.
            Observations land directly in the cow&apos;s timeline and on
            the Hot list.
          </p>
        </div>
        <StartRoundButton />
      </header>

      {active_rounds.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">
            Active rounds ({active_rounds.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {active_rounds.map((r) => (
              <RoundCard
                key={r.id}
                round={r}
                observations={counts.get(r.id) ?? 0}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Recent rounds</h2>
        {completed.length === 0 ? (
          <div className="ring-1 ring-foreground/10 p-4 text-xs text-muted-foreground">
            No completed rounds yet. Click <span className="font-medium">Start round</span> above
            to begin one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {completed.map((r) => (
              <RoundCard
                key={r.id}
                round={r}
                observations={counts.get(r.id) ?? 0}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RoundCard({
  round,
  observations,
}: {
  round: RoundRow;
  observations: number;
}) {
  const started = new Date(round.started_at);
  const ended = round.completed_at ? new Date(round.completed_at) : null;
  const dur = ended
    ? Math.max(1, Math.round((ended.getTime() - started.getTime()) / 60000))
    : null;
  const ringTone =
    round.status === "active"
      ? "ring-amber-500/40 bg-amber-500/5"
      : round.status === "abandoned"
        ? "ring-destructive/40 bg-destructive/5"
        : "ring-foreground/10";

  return (
    <Link
      href={`/rounds/${round.id}`}
      className={`ring-1 ${ringTone} p-3 flex flex-col gap-1 hover:bg-foreground/[0.02]`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium tabular-nums">
          {started.toLocaleString(undefined, {
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span
          className={`text-[10px] uppercase tracking-wide ${
            round.status === "active"
              ? "text-amber-600 dark:text-amber-400"
              : round.status === "abandoned"
                ? "text-destructive"
                : "text-primary"
          }`}
        >
          {round.status}
        </span>
      </div>
      <span className="text-[11px] text-muted-foreground">
        {round.supervisor_name ?? "—"}
        {dur !== null ? ` · ${dur} min` : ""}
      </span>
      <span className="text-[10px] tabular-nums text-muted-foreground">
        {observations} observation{observations === 1 ? "" : "s"}
      </span>
      {round.notes ? (
        <span className="text-[10px] text-muted-foreground line-clamp-1">
          {round.notes}
        </span>
      ) : null}
    </Link>
  );
}
