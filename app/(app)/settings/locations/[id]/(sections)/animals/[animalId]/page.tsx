import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import {
  getAnimal,
  getAnimalEventCounts,
} from "../../../animals-actions";

export const metadata = { title: "Animal" };
export const dynamic = "force-dynamic";

export default async function AnimalDetailPage({
  params,
}: {
  params: Promise<{ id: string; animalId: string }>;
}) {
  const { id, animalId } = await params;
  const user = await requireAnyRole(["super_admin", "admin"]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  const admin = createAdminClient();
  const { data: loc } = await admin
    .from("locations")
    .select("id, organization_id")
    .eq("id", id)
    .single();
  if (!loc) notFound();
  if (role !== RoleSuperAdmin && loc.organization_id !== orgId) notFound();

  const animal = await getAnimal(id, animalId);
  if (!animal) notFound();
  const counts = await getAnimalEventCounts(id, animalId);

  return (
    <div className="flex flex-col gap-4 py-2">
      <header className="flex flex-col gap-1">
        <Link
          href={`/settings/locations/${id}/animals`}
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

      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-2">
        <h2 className="text-sm font-medium">Event history</h2>
        <p className="text-xs text-muted-foreground">
          Counts only. Per-event tables (lactations, milkings, repro, health,
          calvings, scores, pen moves) get their own UIs in subsequent PRs.
        </p>
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
      </section>
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
