import Link from "next/link";
import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import {
  listAnimals,
} from "@/app/(app)/settings/locations/[id]/animals-actions";
import { listPens } from "@/app/(app)/settings/locations/[id]/pens-actions";
import { getGroups } from "@/app/(app)/settings/locations/[id]/groups-actions";
import { AnimalsTable } from "@/app/(app)/settings/locations/[id]/animals-table";
import { NoLocationSelected } from "@/components/no-location-selected";
import { AnimalsToolbar } from "./animals-toolbar";
import {
  suggestGroup,
  type AnimalFacts,
  type GroupDef,
} from "@/lib/group-rules";

export const metadata = { title: "Animals" };
export const dynamic = "force-dynamic";

const STATUS_VALUES = ["active", "sold", "dead", "culled", "reference"] as const;

export default async function AnimalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const active = await getActiveLocation();
  if (!active) {
    return (
      <NoLocationSelected
        title="No location selected"
        hint="Animals are scoped to the active location. Pick one in the top-right switcher."
      />
    );
  }
  if (!active.manages_livestock) {
    return (
      <NoLocationSelected
        title="Livestock module disabled"
        hint={`${active.name} doesn't have the Livestock module enabled. Turn it on in Settings → Locations.`}
      />
    );
  }

  const { status } = await searchParams;
  const validStatus =
    status && STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number])
      ? (status as string)
      : null;

  const admin = createAdminClient();
  const [rows, pens, groups, breeds, statusCountsRaw, reproEvents] = await Promise.all([
    listAnimals(active.id, validStatus),
    listPens(active.id),
    getGroups(active.id),
    admin
      .from("breeds_catalog")
      .select("code, name")
      .order("display_order")
      .then(({ data }) => (data ?? []) as { code: string; name: string }[]),
    admin
      .from("animals")
      .select("status")
      .eq("location_id", active.id)
      .then(({ data }) => (data ?? []) as { status: string }[]),
    admin
      .from("repro_events")
      .select("animal_id, event_type, result, days_pregnant, event_date")
      .order("event_date", { ascending: false })
      .limit(2000)
      .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
  ]);

  const totalsByStatus: Record<string, number> = {};
  for (const r of statusCountsRaw) {
    totalsByStatus[r.status] = (totalsByStatus[r.status] ?? 0) + 1;
  }

  // Count pending group moves: active animals whose suggested group ≠ current.
  let pendingMoves = 0;
  let unassignedGroup = 0;
  let unassignedPen = 0;
  let multiPenGroupSplits = 0;
  if (rows.length > 0) {
    const groupDefs: GroupDef[] = groups.map((g) => ({
      id: g.id,
      label: g.label,
      group_slug: g.group_slug,
      group_class: g.group_class,
      display_order: g.display_order,
      rule_predicates: g.rule_predicates as Record<string, unknown>,
    }));
    const ownedIds = new Set(rows.map((r) => r.id));
    const latestPC = new Map<string, { result: string | null; days_pregnant: number | null }>();
    for (const e of reproEvents) {
      if (e.event_type !== "preg_check") continue;
      if (!ownedIds.has(e.animal_id as string)) continue;
      if (!latestPC.has(e.animal_id as string)) {
        latestPC.set(e.animal_id as string, {
          result: (e.result as string | null) ?? null,
          days_pregnant: (e.days_pregnant as number | null) ?? null,
        });
      }
    }
    const nowMs = new Date().getTime();
    const activeRows = rows.filter((r) => r.status === "active");
    for (const a of activeRows) {
      if (!a.current_group_id) unassignedGroup += 1;
      if (!a.current_pen_id) unassignedPen += 1;
      const pc = latestPC.get(a.id);
      const isPreg = pc?.result === "pregnant";
      const facts: AnimalFacts = {
        id: a.id,
        animal_id: a.animal_id,
        sex: a.sex,
        status: a.status,
        life_stage: a.life_stage,
        current_lactation: a.current_lactation,
        birth_date: a.birth_date,
        last_calving_date: a.last_calving_date,
        is_pregnant: isPreg,
        days_pregnant: isPreg ? pc?.days_pregnant ?? null : null,
        hospital_flag: false,
      };
      const sug = suggestGroup(facts, groupDefs, nowMs);
      if (sug.group_id && sug.group_id !== a.current_group_id) pendingMoves += 1;
    }
    // Groups with ≥2 pens have a non-trivial pen split decision.
    const pensByGroup = new Map<string, number>();
    for (const p of pens) {
      if (!p.group_id) continue;
      pensByGroup.set(p.group_id, (pensByGroup.get(p.group_id) ?? 0) + 1);
    }
    for (const [, n] of pensByGroup) if (n >= 2) multiPenGroupSplits += 1;
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-lg font-medium">Animals</h1>
            <p className="text-xs text-muted-foreground">
              Roster at {active.name}. Use the top-right switcher to change
              location.
            </p>
          </div>
          <AnimalsToolbar
            locationId={active.id}
            hasNoAnimals={rows.length === 0}
          />
        </div>
      </header>

      {pendingMoves > 0 || unassignedGroup > 0 || multiPenGroupSplits > 0 ? (
        <ActionBanner
          pendingMoves={pendingMoves}
          unassignedGroup={unassignedGroup}
          unassignedPen={unassignedPen}
          multiPenGroupSplits={multiPenGroupSplits}
        />
      ) : null}

      <AnimalsTable
        locationId={active.id}
        rows={rows}
        pens={pens.map((p) => ({ id: p.id, name: p.name }))}
        groups={groups.map((g) => ({ id: g.id, label: g.label }))}
        breeds={breeds}
        statusFilter={validStatus}
        totalsByStatus={totalsByStatus}
      />
    </div>
  );
}

function ActionBanner({
  pendingMoves,
  unassignedGroup,
  unassignedPen,
  multiPenGroupSplits,
}: {
  pendingMoves: number;
  unassignedGroup: number;
  unassignedPen: number;
  multiPenGroupSplits: number;
}) {
  const parts: string[] = [];
  if (pendingMoves > 0)
    parts.push(`${pendingMoves} animal${pendingMoves === 1 ? "" : "s"} need${pendingMoves === 1 ? "s" : ""} group review`);
  if (unassignedGroup > 0)
    parts.push(`${unassignedGroup} ungrouped`);
  if (unassignedPen > 0)
    parts.push(`${unassignedPen} without a pen`);
  if (multiPenGroupSplits > 0)
    parts.push(`${multiPenGroupSplits} group${multiPenGroupSplits === 1 ? "" : "s"} with multi-pen splits to plan`);

  return (
    <section className="ring-1 ring-primary/40 bg-primary/5 px-3 py-2 flex flex-wrap items-center justify-between gap-3">
      <div className="text-xs">
        <span className="font-medium">Action needed</span>{" "}
        <span className="text-muted-foreground">· {parts.join(" · ")}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {pendingMoves > 0 || unassignedGroup > 0 ? (
          <Link
            href="/group-moves"
            className="h-7 px-3 inline-flex items-center text-xs ring-1 ring-foreground/10 hover:bg-foreground/5"
          >
            Assign groups →
          </Link>
        ) : null}
        {multiPenGroupSplits > 0 || unassignedPen > 0 ? (
          <Link
            href="/pen-moves"
            className="h-7 px-3 inline-flex items-center text-xs ring-1 ring-foreground/10 hover:bg-foreground/5"
          >
            Assign pens →
          </Link>
        ) : null}
      </div>
    </section>
  );
}
