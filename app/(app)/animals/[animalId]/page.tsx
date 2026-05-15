import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveLocation } from "@/lib/locations";
import {
  getAnimal,
  getAnimalEventCounts,
} from "@/app/(app)/settings/locations/[id]/animals-actions";
import { NoLocationSelected } from "@/components/no-location-selected";
import { computeCowTimeline, type TimelineItem } from "@/lib/cow-timeline";

export const metadata = { title: "Animal" };
export const dynamic = "force-dynamic";

export default async function AnimalDetailPage({
  params,
}: {
  params: Promise<{ animalId: string }>;
}) {
  const { animalId } = await params;
  const active = await getActiveLocation();
  if (!active) {
    return <NoLocationSelected title="No location selected" />;
  }

  const animal = await getAnimal(active.id, animalId);
  if (!animal) notFound();
  const [counts, timeline] = await Promise.all([
    getAnimalEventCounts(active.id, animalId),
    computeCowTimeline(animalId),
  ]);

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <Link
          href="/animals"
          className="text-[10px] uppercase tracking-wide text-muted-foreground hover:underline"
        >
          ← Animals
        </Link>
        <h1 className="font-heading text-lg font-medium">
          {animal.animal_id}
          {animal.name ? ` — ${animal.name}` : ""}
        </h1>
        <p className="text-xs text-muted-foreground capitalize">
          {animal.sex} · {animal.status} · born {animal.birth_date}
        </p>
      </header>

      <section className="ring-1 ring-foreground/10 p-4 grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1 text-xs">
        <div className="text-muted-foreground">Animal ID</div>
        <div className="font-mono">{animal.animal_id}</div>
        <div className="text-muted-foreground">Name</div>
        <div>{animal.name ?? "—"}</div>
        <div className="text-muted-foreground">Official ID</div>
        <div className="font-mono">{animal.official_id ?? "—"}</div>
        <div className="text-muted-foreground">Registration #</div>
        <div className="font-mono">{animal.registration_number ?? "—"}</div>
        <div className="text-muted-foreground">Breed</div>
        <div className="font-mono">{animal.breed_code ?? "—"}</div>
        <div className="text-muted-foreground">Origin</div>
        <div className="capitalize">{animal.origin.replace(/_/g, " ")}</div>
        <div className="text-muted-foreground">Source farm</div>
        <div>{animal.source_farm ?? "—"}</div>
        <div className="text-muted-foreground">Entry date</div>
        <div>{animal.entry_date}</div>
        <div className="text-muted-foreground">Sire NAAB</div>
        <div className="font-mono">{animal.sire_naab ?? "—"}</div>
        <div className="text-muted-foreground">Sire name</div>
        <div>{animal.sire_name ?? "—"}</div>
        <div className="text-muted-foreground">Dam (external tag)</div>
        <div className="font-mono">{animal.dam_tag_external ?? "—"}</div>
        <div className="text-muted-foreground">Current lactation</div>
        <div>{animal.current_lactation ?? "—"}</div>
        <div className="text-muted-foreground">Last calving</div>
        <div>{animal.last_calving_date ?? "—"}</div>
        {animal.notes ? (
          <>
            <div className="text-muted-foreground">Notes</div>
            <div className="whitespace-pre-wrap">{animal.notes}</div>
          </>
        ) : null}
      </section>

      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Timeline</h2>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {timeline.length} event{timeline.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
          <Stat label="Lactations" value={counts.lactations} />
          <Stat label="Test days" value={counts.test_days} />
          <Stat label="Milkings" value={counts.milkings} />
          <Stat label="Repro events" value={counts.repro_events} />
          <Stat label="Calvings" value={counts.calvings} />
          <Stat label="Health events" value={counts.health_events} />
          <Stat label="Scores" value={counts.scores} />
          <Stat label="Pen moves" value={counts.pen_moves} />
        </div>
        <Timeline items={timeline} />
      </section>
    </div>
  );
}

const KIND_TONE: Record<string, string> = {
  calving: "text-emerald-700 dark:text-emerald-400",
  heat: "text-pink-700 dark:text-pink-400",
  breeding: "text-pink-700 dark:text-pink-400",
  preg_check: "text-violet-700 dark:text-violet-400",
  abortion: "text-destructive",
  do_not_breed: "text-destructive",
  fresh: "text-emerald-700 dark:text-emerald-400",
  dry_off: "text-orange-700 dark:text-orange-400",
  diagnosis: "text-amber-700 dark:text-amber-400",
  treatment: "text-sky-700 dark:text-sky-400",
  vaccination: "text-sky-700 dark:text-sky-400",
  hoof_trim: "text-orange-700 dark:text-orange-400",
  group_move: "text-muted-foreground",
  pen_move: "text-muted-foreground",
  score: "text-muted-foreground",
  test_day: "text-primary",
};

const KIND_LABEL: Record<string, string> = {
  calving: "Calving",
  heat: "Heat",
  breeding: "Breeding",
  preg_check: "Preg check",
  abortion: "Abortion",
  do_not_breed: "DNB",
  fresh: "Fresh",
  dry_off: "Dry-off",
  diagnosis: "Diagnosis",
  treatment: "Treatment",
  vaccination: "Vax",
  hoof_trim: "Hoof",
  group_move: "Group",
  pen_move: "Pen",
  score: "Score",
  test_day: "Test day",
};

function Timeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic p-2">
        No events recorded yet.
      </div>
    );
  }
  const groups = new Map<string, TimelineItem[]>();
  for (const it of items) {
    const arr = groups.get(it.occurred_at) ?? [];
    arr.push(it);
    groups.set(it.occurred_at, arr);
  }
  const dates = Array.from(groups.keys()).sort((a, b) =>
    a < b ? 1 : a > b ? -1 : 0,
  );

  return (
    <div className="flex flex-col gap-3">
      {dates.map((d) => (
        <div key={d} className="flex flex-col gap-1">
          <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground tabular-nums">
            {new Date(d).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "2-digit",
              weekday: "short",
            })}
          </h3>
          <ul className="ring-1 ring-foreground/10 divide-y divide-foreground/10">
            {groups.get(d)!.map((it) => (
              <li
                key={it.id}
                className="px-3 py-1.5 flex items-baseline gap-3 text-xs"
              >
                <span
                  className={`text-[10px] uppercase tracking-wide w-16 shrink-0 ${KIND_TONE[it.kind] ?? "text-muted-foreground"}`}
                >
                  {KIND_LABEL[it.kind] ?? it.kind}
                </span>
                <span className="font-medium">{it.title}</span>
                {it.detail ? (
                  <span className="text-muted-foreground flex-1">
                    · {it.detail}
                  </span>
                ) : (
                  <span className="flex-1" />
                )}
                {it.round_id ? (
                  <Link
                    href={`/rounds/${it.round_id}`}
                    className="text-[10px] text-muted-foreground underline underline-offset-2"
                  >
                    round →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="ring-1 ring-foreground/10 p-3 flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-lg font-medium tabular-nums">{value}</span>
    </div>
  );
}
