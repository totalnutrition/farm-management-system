import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import {
  suggestPenSplit,
  type SplitAnimal,
  type SplitPen,
} from "@/lib/pen-rules";
import {
  PenMovesClient,
  type GroupBlock,
  type AnimalLite,
  type PenLite,
} from "./pen-moves-client";

export const metadata = { title: "Pen moves" };
export const dynamic = "force-dynamic";

function diffDays(from: string, nowMs: number): number {
  return Math.floor((nowMs - new Date(from).getTime()) / 86400000);
}

export default async function PenMovesPage() {
  const active = await getActiveLocation();
  if (!active) {
    return <NoLocationSelected title="No location selected" hint="Pen moves are scoped to the active location." />;
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
  const nowMs = new Date().getTime();

  type A = {
    id: string;
    animal_id: string;
    name: string | null;
    sex: string;
    status: string;
    current_lactation: number | null;
    last_calving_date: string | null;
    current_group_id: string | null;
    current_pen_id: string | null;
  };
  type P = {
    id: string;
    name: string;
    group_id: string | null;
    capacity_head: number | null;
  };
  type G = { id: string; label: string; display_order: number };

  const [animalRows, penRows, groupRows] = await Promise.all([
    admin
      .from("animals")
      .select(
        "id, animal_id, name, sex, status, current_lactation, last_calving_date, current_group_id, current_pen_id",
      )
      .eq("location_id", active.id)
      .eq("status", "active")
      .order("animal_id")
      .then(({ data }) => (data ?? []) as A[]),
    admin
      .from("pens")
      .select("id, name, group_id, capacity_head")
      .eq("location_id", active.id)
      .order("name")
      .then(({ data }) => (data ?? []) as P[]),
    admin
      .from("location_groups")
      .select("id, label, display_order")
      .eq("location_id", active.id)
      .order("display_order")
      .then(({ data }) => (data ?? []) as G[]),
  ]);

  const penName = new Map(penRows.map((p) => [p.id, p.name] as const));
  const pensByGroup = new Map<string, P[]>();
  for (const p of penRows) {
    if (!p.group_id) continue;
    const arr = pensByGroup.get(p.group_id) ?? [];
    arr.push(p);
    pensByGroup.set(p.group_id, arr);
  }

  const animalsByGroup = new Map<string, A[]>();
  for (const a of animalRows) {
    if (!a.current_group_id) continue;
    const arr = animalsByGroup.get(a.current_group_id) ?? [];
    arr.push(a);
    animalsByGroup.set(a.current_group_id, arr);
  }

  const blocks: GroupBlock[] = [];
  for (const g of groupRows) {
    const animals = animalsByGroup.get(g.id) ?? [];
    const pens = pensByGroup.get(g.id) ?? [];
    if (animals.length === 0 && pens.length === 0) continue;

    const splitInput: SplitAnimal[] = animals.map((a) => ({
      id: a.id,
      animal_id: a.animal_id,
      name: a.name,
      parity: a.current_lactation ?? 0,
      dim: a.last_calving_date ? diffDays(a.last_calving_date, nowMs) : null,
      current_pen_id: a.current_pen_id,
    }));
    const splitPens: SplitPen[] = pens.map((p) => ({
      id: p.id,
      name: p.name,
      capacity_head: p.capacity_head,
    }));
    const assignments = suggestPenSplit(splitInput, splitPens);

    const animalsOut: AnimalLite[] = splitInput.map((a) => {
      const sug = assignments.get(a.id) ?? null;
      return {
        id: a.id,
        animal_id: a.animal_id,
        name: a.name,
        parity: a.parity,
        dim: a.dim,
        current_pen_id: a.current_pen_id,
        current_pen_name: a.current_pen_id ? penName.get(a.current_pen_id) ?? null : null,
        suggested_pen_id: sug,
        suggested_pen_name: sug ? penName.get(sug) ?? null : null,
      };
    });

    const currentByPen = new Map<string, number>();
    const suggestedByPen = new Map<string, number>();
    for (const a of animalsOut) {
      if (a.current_pen_id) currentByPen.set(a.current_pen_id, (currentByPen.get(a.current_pen_id) ?? 0) + 1);
      if (a.suggested_pen_id) suggestedByPen.set(a.suggested_pen_id, (suggestedByPen.get(a.suggested_pen_id) ?? 0) + 1);
    }
    const pensOut: PenLite[] = pens.map((p) => ({
      id: p.id,
      name: p.name,
      capacity_head: p.capacity_head,
      current_count: currentByPen.get(p.id) ?? 0,
      suggested_count: suggestedByPen.get(p.id) ?? 0,
    }));

    blocks.push({
      group_id: g.id,
      group_label: g.label,
      pens: pensOut,
      animals: animalsOut.sort((a, b) => {
        if (a.parity !== b.parity) return a.parity - b.parity;
        return (a.dim ?? 0) - (b.dim ?? 0);
      }),
    });
  }

  const groupsWithoutPens = blocks.filter((b) => b.pens.length === 0).length;
  const totalUnassignedPen = animalRows.filter((a) => !a.current_pen_id).length;

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Pen moves</h1>
        <p className="text-xs text-muted-foreground">
          {active.name} · suggested pen assignments per group, computed from
          parity + DIM and pen capacity. Caution badges flag over- /
          under-stocked pens but don&apos;t block the assignment.
          {groupsWithoutPens > 0 ? (
            <span className="block text-amber-600 dark:text-amber-400 mt-1">
              {groupsWithoutPens} group{groupsWithoutPens === 1 ? "" : "s"}{" "}
              with cows but no pens declared yet ({totalUnassignedPen} cow
              {totalUnassignedPen === 1 ? "" : "s"} ungated). Use the
              &quot;Add pen&quot; link in each section below.
            </span>
          ) : null}
        </p>
      </header>

      <PenMovesClient blocks={blocks} locationId={active.id} />
    </div>
  );
}
