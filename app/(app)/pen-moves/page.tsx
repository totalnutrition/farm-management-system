import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import {
  getOrganizationIdFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import {
  CapacityDefaultsFallback,
  type CapacityDefaults,
} from "@/lib/capacity-defaults";
import { computeCapacityPlanFromCounts } from "@/lib/capacity-plan";
import { computeGroupHeadcounts } from "@/lib/group-headcount";
import type { GroupDef } from "@/lib/group-rules";
import {
  suggestPenSplit,
  type SplitAnimal,
  type SplitPen,
} from "@/lib/pen-rules";
import type { Barn } from "@/lib/barns";
import {
  PenMovesClient,
  type GroupBlock,
  type AnimalLite,
  type PenLite,
  type PenForVisualizer,
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
    location_id: string;
    barn_id: string | null;
    group_id: string | null;
    name: string;
    capacity_head: number | null;
    bunk_running_ft: number | null;
    length_ft: number | null;
    width_ft: number | null;
    position_index: number;
    side: "left" | "right" | null;
  };
  // Barn rows — selected via "*" so the inline barn-edit form on
  // /pen-moves can hydrate every structure / facility field.
  type G = {
    id: string;
    label: string;
    display_order: number;
    group_slug: string;
    group_class: string;
    rule_predicates: Record<string, unknown>;
  };

  const [animalRows, penRows, barnRows, groupRows, capDefaults, user] = await Promise.all([
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
      .select(
        "id, location_id, barn_id, group_id, name, capacity_head, bunk_running_ft, length_ft, width_ft, position_index, side",
      )
      .eq("location_id", active.id)
      .order("position_index")
      .then(({ data }) => (data ?? []) as P[]),
    admin
      .from("barns")
      .select("*")
      .eq("location_id", active.id)
      .order("name")
      .then(({ data }) => (data ?? []) as Barn[]),
    admin
      .from("location_groups")
      .select("id, label, display_order, group_slug, group_class, rule_predicates")
      .eq("location_id", active.id)
      .order("display_order")
      .then(({ data }) => (data ?? []) as G[]),
    admin
      .from("org_capacity_defaults")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => data),
    requireAnyRole(["super_admin", "admin"]),
  ]);

  const orgId = getOrganizationIdFromUser(user);
  void orgId;

  // Engine-driven target capacity per group → drives the empty-state hint.
  const groupDefs: GroupDef[] = groupRows.map((g) => ({
    id: g.id,
    label: g.label,
    group_slug: g.group_slug,
    group_class: g.group_class,
    display_order: g.display_order,
    rule_predicates: g.rule_predicates,
  }));
  const headCounts = await computeGroupHeadcounts(active.id, groupDefs);
  const defaults: CapacityDefaults = capDefaults
    ? {
        fresh_stocking_pct: Number(capDefaults.fresh_stocking_pct),
        high_stocking_pct: Number(capDefaults.high_stocking_pct),
        mid_stocking_pct: Number(capDefaults.mid_stocking_pct),
        low_stocking_pct: Number(capDefaults.low_stocking_pct),
        dry_close_stocking_pct: Number(capDefaults.dry_close_stocking_pct),
        dry_far_stocking_pct: Number(capDefaults.dry_far_stocking_pct),
        fresh_bunk_in: Number(capDefaults.fresh_bunk_in),
        high_bunk_in: Number(capDefaults.high_bunk_in),
        mid_bunk_in: Number(capDefaults.mid_bunk_in),
        low_bunk_in: Number(capDefaults.low_bunk_in),
        dry_close_bunk_in: Number(capDefaults.dry_close_bunk_in),
        dry_far_bunk_in: Number(capDefaults.dry_far_bunk_in),
      }
    : CapacityDefaultsFallback;
  const plan = computeCapacityPlanFromCounts(
    groupRows.map((g) => ({
      id: g.id,
      label: g.label,
      group_slug: g.group_slug,
      group_class: g.group_class,
      display_order: g.display_order,
      rule_predicates: g.rule_predicates,
      // satisfies LocationGroup shape — fields the capacity helper
      // doesn't read are fine to mock as nulls.
      location_id: active.id,
      preset_slug: null,
      is_custom: false,
    })),
    headCounts.byGroup,
    defaults,
  );
  const targetByGroup = new Map<string, { pen_cap: number; bunk_ft: number }>();
  for (const r of plan.rows) {
    targetByGroup.set(r.group_id, {
      pen_cap: r.pen_capacity,
      bunk_ft: r.bunk_total_ft,
    });
  }

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
      bunk_running_ft: p.bunk_running_ft,
      length_ft: p.length_ft,
      width_ft: p.width_ft,
      barn_id: p.barn_id,
      side: p.side,
      position_index: p.position_index,
      current_count: currentByPen.get(p.id) ?? 0,
      suggested_count: suggestedByPen.get(p.id) ?? 0,
    }));

    const target = targetByGroup.get(g.id);
    blocks.push({
      group_id: g.id,
      group_label: g.label,
      pens: pensOut,
      animals: animalsOut.sort((a, b) => {
        if (a.parity !== b.parity) return a.parity - b.parity;
        return (a.dim ?? 0) - (b.dim ?? 0);
      }),
      target_pen_cap: target?.pen_cap ?? 0,
      target_bunk_ft: target?.bunk_ft ?? 0,
    });
  }

  const groupsWithoutPens = blocks.filter((b) => b.pens.length === 0).length;
  const totalUnassignedPen = animalRows.filter((a) => !a.current_pen_id).length;

  // Headcount per pen (current, not suggested) for the barn visualizer.
  const headcountByPen: Record<string, number> = {};
  for (const a of animalRows) {
    if (a.current_pen_id) {
      headcountByPen[a.current_pen_id] = (headcountByPen[a.current_pen_id] ?? 0) + 1;
    }
  }

  const groupLabelById = new Map(groupRows.map((g) => [g.id, g.label] as const));

  const barns: Barn[] = barnRows;
  const pensForViz: PenForVisualizer[] = penRows.map((p) => ({
    id: p.id,
    barn_id: p.barn_id,
    group_id: p.group_id,
    group_label: p.group_id ? groupLabelById.get(p.group_id) ?? null : null,
    name: p.name,
    capacity_head: p.capacity_head,
    bunk_running_ft: p.bunk_running_ft,
    length_ft: p.length_ft,
    width_ft: p.width_ft,
    position_index: p.position_index,
    side: p.side,
  }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Pen moves</h1>
        <p className="text-xs text-muted-foreground">
          {active.name} · one section per group. Declare pens inline with{" "}
          <span className="font-medium">+ Add pen here</span>, then the
          engine stripes cows across them by parity + DIM. Caution badges
          flag over- / under-stocked pens but never block.
          {groupsWithoutPens > 0 ? (
            <span className="block text-amber-600 dark:text-amber-400 mt-1">
              {groupsWithoutPens} group{groupsWithoutPens === 1 ? "" : "s"}{" "}
              still need pens ({totalUnassignedPen} cow
              {totalUnassignedPen === 1 ? "" : "s"} ungated). Suggested
              capacity per group is in each section&apos;s header.
            </span>
          ) : null}
        </p>
      </header>

      <PenMovesClient
        blocks={blocks}
        locationId={active.id}
        barns={barns}
        pens={pensForViz}
        headcountByPen={headcountByPen}
      />
    </div>
  );
}
