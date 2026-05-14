import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import {
  suggestGroup,
  factsHash,
  type AnimalFacts,
  type GroupDef,
} from "@/lib/group-rules";
import {
  GroupMovesClient,
  type PendingRow,
  type HistoryRow,
} from "./group-moves-client";

export const metadata = { title: "Group moves" };
export const dynamic = "force-dynamic";

function label(a: { animal_id: string | null; name: string | null }): string {
  return `${a.animal_id ?? "?"}${a.name ? ` · ${a.name}` : ""}`;
}

export default async function GroupMovesPage() {
  const active = await getActiveLocation();
  if (!active) {
    return <NoLocationSelected title="No location selected" hint="Group moves are scoped to the active location." />;
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
    life_stage: string | null;
    current_lactation: number | null;
    birth_date: string;
    last_calving_date: string | null;
    current_group_id: string | null;
    last_group_decision_at: string | null;
    last_group_override_reason: string | null;
  };

  const [animalRows, groupRows, reproEvents, movesRows] = await Promise.all([
    admin
      .from("animals")
      .select(
        "id, animal_id, name, sex, status, life_stage, current_lactation, birth_date, last_calving_date, current_group_id, last_group_decision_at, last_group_override_reason",
      )
      .eq("location_id", active.id)
      .eq("status", "active")
      .order("animal_id")
      .then(({ data }) => (data ?? []) as A[]),
    admin
      .from("location_groups")
      .select("id, group_slug, label, group_class, display_order, rule_predicates")
      .eq("location_id", active.id)
      .order("display_order")
      .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
    admin
      .from("repro_events")
      .select("animal_id, event_date, event_type, result, days_pregnant")
      .order("event_date", { ascending: false })
      .limit(2000)
      .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
    admin
      .from("group_moves")
      .select(
        "id, animal_id, occurred_at, from_group_id, to_group_id, suggested_group_id, decision, reason, rule_explanation",
      )
      .order("occurred_at", { ascending: false })
      .limit(500)
      .then(
        ({ data }) => (data ?? []) as Record<string, unknown>[],
        () => [] as Record<string, unknown>[],
      ),
  ]);

  const ownedIds = new Set(animalRows.map((a: A) => a.id));
  const groups: GroupDef[] = groupRows.map((g: Record<string, unknown>) => ({
    id: g.id as string,
    label: g.label as string,
    group_slug: g.group_slug as string,
    group_class: g.group_class as string,
    display_order: g.display_order as number,
    rule_predicates: (g.rule_predicates as Record<string, unknown>) ?? {},
  }));
  const groupById = new Map(groups.map((g) => [g.id, g.label] as const));

  // Resolve latest pregnancy state per animal from repro_events.
  type RE = {
    animal_id: string;
    event_date: string;
    event_type: string;
    result: string | null;
    days_pregnant: number | null;
  };
  const latestPregByAnimal = new Map<string, RE>();
  for (const e of reproEvents as unknown as RE[]) {
    if (e.event_type !== "preg_check") continue;
    if (!latestPregByAnimal.has(e.animal_id)) latestPregByAnimal.set(e.animal_id, e);
  }

  // Compute pending suggestions
  const pending: PendingRow[] = [];
  for (const a of animalRows) {
    const lastPC = latestPregByAnimal.get(a.id);
    const isPreg = lastPC?.result === "pregnant";
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
      days_pregnant: isPreg
        ? lastPC?.days_pregnant !== null && lastPC?.days_pregnant !== undefined
          ? Number(lastPC.days_pregnant)
          : null
        : null,
      hospital_flag: false,
    };
    const sug = suggestGroup(facts, groups, nowMs);
    if (!sug.group_id) continue;
    if (sug.group_id === a.current_group_id) continue;

    const overrideActive = !!a.last_group_override_reason && !!a.last_group_decision_at;
    const daysInCurrent = a.last_group_decision_at
      ? Math.floor((nowMs - new Date(a.last_group_decision_at).getTime()) / 86400000)
      : null;

    pending.push({
      animal_id: a.id,
      animal_label: label(a),
      current_group_id: a.current_group_id,
      current_group_label: a.current_group_id ? groupById.get(a.current_group_id) ?? null : null,
      suggested_group_id: sug.group_id,
      suggested_group_label: sug.group_label!,
      rule_explanation: sug.explanation,
      days_in_current: daysInCurrent,
      override_active: overrideActive,
      override_reason: a.last_group_override_reason,
    });
  }
  // Sort: non-overridden first, then by current_group_label
  pending.sort((a, b) => {
    if (a.override_active !== b.override_active) return a.override_active ? 1 : -1;
    return (a.current_group_label ?? "").localeCompare(b.current_group_label ?? "");
  });

  // History — scope to this location's animals.
  const labelById = new Map(animalRows.map((a: A) => [a.id, label(a)] as const));
  const history: HistoryRow[] = movesRows
    .filter((r: Record<string, unknown>) => ownedIds.has(r.animal_id as string))
    .map((r: Record<string, unknown>) => ({
      id: r.id as string,
      occurred_at: r.occurred_at as string,
      animal_label: labelById.get(r.animal_id as string) ?? "—",
      from_label: r.from_group_id ? groupById.get(r.from_group_id as string) ?? null : null,
      to_label: r.to_group_id ? groupById.get(r.to_group_id as string) ?? null : null,
      suggested_label: r.suggested_group_id ? groupById.get(r.suggested_group_id as string) ?? null : null,
      decision: r.decision as string,
      reason: (r.reason as string | null) ?? null,
      rule_explanation: (r.rule_explanation as string | null) ?? null,
    }));

  void factsHash;

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Group moves</h1>
        <p className="text-xs text-muted-foreground">
          {active.name} · the rule engine watches DIM / parity / age / dry /
          pregnancy and suggests the right group per cow. Accept moves the
          cow; override keeps her with a reason and suppresses the same
          suggestion until her facts change.
        </p>
      </header>

      <GroupMovesClient pending={pending} history={history} />
    </div>
  );
}
