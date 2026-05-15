import { requireUser } from "@/lib/supabase-auth";
import { loadAnimalByTag } from "@/lib/herd-data";
import { daysInMilk, daysBetween } from "@/lib/herd";
import { EventStream } from "./event-stream";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  return { title: `Cow ${decodeURIComponent(tag)}` };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

export default async function CowPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  await requireUser();
  const { tag: raw } = await params;
  const tag = decodeURIComponent(raw);
  const { animal, events } = await loadAnimalByTag(tag);

  if (!animal) {
    return (
      <div className="py-4">
        <h1 className="font-heading text-lg font-medium">Cow {tag}</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          No animal with tag {tag} in this herd.
        </p>
      </div>
    );
  }

  const dim = daysInMilk(animal);
  const daysBred = daysBetween(animal.last_bred_at);

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="font-heading text-lg font-medium">
            {animal.tag}
            {animal.name ? (
              <span className="ml-2 text-muted-foreground">{animal.name}</span>
            ) : null}
          </h1>
          <span className="text-xs uppercase text-muted-foreground">
            {animal.status} · {animal.repro_status}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <Stat label="Pen" value={animal.current_pen ?? "—"} />
          <Stat label="Lact" value={String(animal.lactation_number)} />
          <Stat label="DIM" value={dim === null ? "—" : String(dim)} />
          <Stat
            label="Days bred"
            value={daysBred === null ? "—" : String(daysBred)}
          />
          <Stat
            label="Last calving"
            value={animal.last_calving_at ?? "—"}
          />
          <Stat label="Breed" value={animal.breed ?? "—"} />
        </div>
      </header>

      <EventStream tag={animal.tag} events={events} />
    </div>
  );
}
