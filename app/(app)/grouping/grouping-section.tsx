import "@/lib/derive/items";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { type Predicate } from "@/lib/derive/query";
import type { Event } from "@/lib/derive/engine";
import {
  buildWorklist,
  groupSizes,
  unmappedGroups,
  describePredicate,
  describePlacement,
  legacyPlacement,
  type Ruleset,
  type GroupingMember,
  type Pen,
  type Placement,
} from "@/lib/derive/grouping";
import {
  GroupingClient,
  type RuleRow,
  type Move,
  type PenOption,
} from "./grouping-client";

export async function GroupingSection() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );

  const admin = createAdminClient();

  const { data: penRows } = await admin
    .from("subjects")
    .select("natural_key, attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "pen");
  const pens: Pen[] = (penRows ?? []).map((p) => {
    const a = (p.attrs ?? {}) as Record<string, unknown>;
    return {
      name: p.natural_key,
      capacity: typeof a.capacity === "number" ? a.capacity : null,
    };
  });
  const penOptions: PenOption[] = pens
    .map((p) => ({ value: p.name, capacity: p.capacity }))
    .sort((x, y) =>
      x.value.localeCompare(y.value, undefined, { numeric: true }),
    );

  const { data: rules } = await admin
    .from("grouping_rules")
    .select(
      "id, ordinal, name, predicate, target_pen, split, placement, is_active",
    )
    .eq("organization_id", orgId)
    .order("ordinal");

  const placementOf = (r: {
    placement: unknown;
    target_pen: string | null;
    split: unknown;
  }): Placement =>
    r.placement
      ? (r.placement as Placement)
      : legacyPlacement(
          r.target_pen,
          r.split as { firstLactation: string; mature: string } | null,
        );

  const ruleset: Ruleset = (rules ?? [])
    .filter((r) => r.is_active)
    .map((r) => ({
      name: r.name,
      when: r.predicate as Predicate,
      placement: placementOf(r),
    }));

  const { data: subjects } = await admin
    .from("subjects")
    .select("id, natural_key, attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "animal");

  const ids = (subjects ?? []).map((s) => s.id);
  const byId = new Map<string, Event[]>();
  if (ids.length) {
    const { data: events } = await admin
      .from("events")
      .select("subject_id, event_code, event_date, payload")
      .eq("organization_id", orgId)
      .in("subject_id", ids);
    for (const e of events ?? []) {
      const l = byId.get(e.subject_id) ?? [];
      l.push({
        code: e.event_code,
        date: e.event_date,
        payload: (e.payload ?? {}) as Record<string, unknown>,
      });
      byId.set(e.subject_id, l);
    }
  }

  const idToSubjectId = new Map<string, string>();
  const population: GroupingMember[] = (subjects ?? []).map((s) => {
    const a = (s.attrs ?? {}) as Record<string, unknown>;
    idToSubjectId.set(s.natural_key, s.id);
    return {
      id: s.natural_key,
      pen: typeof a.pen === "string" ? a.pen : null,
      subject: {
        events: byId.get(s.id) ?? [],
        facts: {
          birthDate:
            typeof a.birth_date === "string" ? a.birth_date : undefined,
          baseLactation:
            typeof a.base_lactation === "number"
              ? a.base_lactation
              : undefined,
        },
      },
    };
  });

  const today = new Date().toISOString().slice(0, 10);
  const worklist: Move[] = buildWorklist(
    population,
    ruleset,
    { today },
    pens,
  ).map((w) => ({ ...w, subjectId: idToSubjectId.get(w.id)! }));

  const sizes = groupSizes(population, ruleset, { today });

  const ruleRows: RuleRow[] = (rules ?? []).map((r) => {
    const pl = placementOf(r);
    return {
      id: r.id,
      ordinal: r.ordinal,
      name: r.name,
      predicate: r.predicate as Predicate,
      cond: describePredicate(r.predicate as Predicate),
      placement: pl,
      placementText: describePlacement(pl),
      mapped: pl.kind !== "none",
      size: sizes[r.name] ?? 0,
    };
  });

  const unmapped = unmappedGroups(ruleset);

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Grouping</h1>
        <p className="text-xs text-muted-foreground">
          Set your group strategy, then map each group to your real
          pens. Nothing moves until a group has pens.
        </p>
      </header>
      <GroupingClient
        rules={ruleRows}
        worklist={worklist}
        pens={penOptions}
        unmapped={unmapped}
      />
    </div>
  );
}
