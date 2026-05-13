import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  ChartLineData02Icon,
  ClipboardClockIcon,
  MedicalFileIcon,
} from "@hugeicons/core-free-icons";
import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

type AnimalRow = {
  id: string;
  status: string;
  life_stage: string | null;
  sex: string;
  birth_date: string;
  current_lactation: number | null;
  last_calving_date: string | null;
};

function diffDays(from: string, to = new Date()): number {
  const d = new Date(from).getTime();
  return Math.floor((to.getTime() - d) / (1000 * 60 * 60 * 24));
}

export default async function Dashboard() {
  const active = await getActiveLocation();
  if (!active) {
    return <NoLocationSelected title="Dashboard — no location selected" />;
  }

  const admin = createAdminClient();
  // Pull just what the dashboard needs. Use SELECT * defensively in case
  // life_stage column isn't migrated yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = [];
  try {
    const { data } = await admin
      .from("animals")
      .select("*")
      .eq("location_id", active.id)
      .limit(5000);
    rows = data ?? [];
  } catch {
    rows = [];
  }
  const animals: AnimalRow[] = rows as AnimalRow[];
  const activeAnimals = animals.filter((a) => a.status === "active");

  const byStage = countByStage(activeAnimals);
  const totalAdult = byStage.lactating + byStage.dry;
  const milkingPct =
    totalAdult > 0 ? Math.round((byStage.lactating / totalAdult) * 100) : 0;

  // Fresh cows: lactating with last_calving_date within 30 days
  const freshCount = activeAnimals.filter((a) => {
    if (a.life_stage !== "lactating") return false;
    if (!a.last_calving_date) return false;
    return diffDays(a.last_calving_date) <= 30;
  }).length;

  // Avg DIM for milking herd
  const dims = activeAnimals
    .filter((a) => a.life_stage === "lactating" && a.last_calving_date)
    .map((a) => diffDays(a.last_calving_date!));
  const avgDim =
    dims.length > 0
      ? Math.round(dims.reduce((s, n) => s + n, 0) / dims.length)
      : 0;

  // Parity mix
  const parities = activeAnimals
    .filter((a) => a.life_stage === "lactating" || a.life_stage === "dry")
    .map((a) => a.current_lactation ?? 0);
  const primip = parities.filter((p) => p === 1).length;
  const primipPct =
    parities.length > 0 ? Math.round((primip / parities.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Dashboard</h1>
        <p className="text-xs text-muted-foreground">
          {active.name} · live snapshot from the animals roster.{" "}
          {animals.length === 0
            ? "No animals yet — add some on the Animals page or generate sample data."
            : `${animals.length} animals on file, ${activeAnimals.length} active.`}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Active animals" value={activeAnimals.length} />
        <Stat label="Lactating" value={byStage.lactating} />
        <Stat label="Dry" value={byStage.dry} />
        <Stat label="Fresh (≤30d)" value={freshCount} accent />
        <Stat label="Avg DIM" value={avgDim} suffix="d" />
        <Stat label="Primiparous" value={primipPct} suffix="%" />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Bred heifers" value={byStage.bred_heifer} />
        <Stat label="Breeding heifers" value={byStage.breeding_heifer} />
        <Stat label="Weaned heifers" value={byStage.weaned_heifer} />
        <Stat label="Calves" value={byStage.calf} />
        <Stat label="Bulls" value={byStage.bull} />
        <Stat label="Milking %" value={milkingPct} suffix="%" />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ShortcutCard
          href="/animals"
          icon={ChartLineData02Icon}
          title="Animals roster"
          body="Add, edit, search animals. Per-animal events live on the detail page."
        />
        <ShortcutCard
          href="/hot-list"
          icon={AlertCircleIcon}
          title="Hot list"
          body="Today's action list — preg-check-due, breeding-due, dry-off-due."
        />
        <ShortcutCard
          href="/milk-recording"
          icon={ClipboardClockIcon}
          title="Milk recording"
          body="Per-cow daily milking and test-day entry."
        />
        <ShortcutCard
          href="/health"
          icon={MedicalFileIcon}
          title="Health events"
          body="Diagnoses, treatments, vaccinations. Drives withdrawals."
        />
        <ShortcutCard
          href="/breedings"
          icon={ChartLineData02Icon}
          title="Breedings"
          body="AI / natural breeding entry with sire NAAB and sync protocol."
        />
        <ShortcutCard
          href="/calvings"
          icon={ChartLineData02Icon}
          title="Calvings"
          body="Calving records: dam, calf, ease, twin, stillborn."
        />
      </section>

      {animals.length === 0 ? (
        <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-2">
          <h2 className="text-sm font-medium">Get started</h2>
          <p className="text-xs text-muted-foreground">
            This location has no animals yet. Head to the Animals page to
            add one manually, import a CSV, or generate sample data for
            testing.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function countByStage(animals: AnimalRow[]) {
  const empty = {
    lactating: 0,
    dry: 0,
    bred_heifer: 0,
    breeding_heifer: 0,
    weaned_heifer: 0,
    calf: 0,
    bull: 0,
    other: 0,
  } as const;
  const out: Record<string, number> = { ...empty };
  for (const a of animals) {
    const stage = (a.life_stage ?? "other") as string;
    out[stage] = (out[stage] ?? 0) + 1;
  }
  return out as unknown as Record<keyof typeof empty, number>;
}

function Stat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className="ring-1 ring-foreground/10 p-3 flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={`text-lg font-medium tabular-nums ${
          accent ? "text-primary" : ""
        }`}
      >
        {value}
        {suffix ? <span className="text-xs ml-0.5">{suffix}</span> : null}
      </span>
    </div>
  );
}

function ShortcutCard({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="ring-1 ring-foreground/10 p-4 flex flex-col gap-1 hover:bg-foreground/5"
    >
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={icon} className="size-4 text-primary" />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground">{body}</p>
    </Link>
  );
}
