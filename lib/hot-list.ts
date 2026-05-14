/**
 * Cross-cutting "things needing attention" aggregator for the active
 * location. Drives the /hot-list dashboard and the count badges on the
 * sidebar.
 *
 * Re-uses the rule engine (group-rules + pen-rules) so the alerts here
 * agree exactly with what /group-moves and /pen-moves show.
 *
 * Server-only. Wrapped in React.cache so a single request renders the
 * sidebar AND the page from one query batch.
 */

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  suggestGroup,
  type AnimalFacts,
  type GroupDef,
} from "@/lib/group-rules";
import { suggestPenSplit, type SplitAnimal, type SplitPen } from "@/lib/pen-rules";
import { recentAvgDailyMilk } from "@/lib/milk-stats";

const OVERSTOCK_THRESHOLD = 1.15; // > 115% of capacity → flag
const UNDERSTOCK_THRESHOLD = 0.7; // < 70% of capacity → flag

export type HotListCounts = {
  /** Cows whose engine-suggested group differs from their current group. */
  pendingGroupMoves: number;
  /** Cows whose engine-suggested pen differs from their current pen. */
  pendingPenMoves: number;
  /** Groups that have cows but zero pens declared. */
  groupsMissingPens: number;
  /** Cows sitting in those groups (so the user knows what's stuck). */
  ungatedCowsInGroupsMissingPens: number;
  /** Active cows with no current_pen_id set at all. */
  cowsWithoutPen: number;
  /** Pens whose current cow count exceeds capacity × 1.15. */
  overstockedPens: number;
  /** Pens with cows but below 70% of capacity. */
  understockedPens: number;
  /** Pens with capacity set but zero cows (candidates for delete / merge). */
  emptyPens: number;
};

export type HotListItem = {
  kind:
    | "pending_group"
    | "pending_pen"
    | "groups_missing_pens"
    | "cows_without_pen"
    | "overstocked"
    | "understocked"
    | "empty_pen";
  label: string;
  detail?: string;
  href: string;
};

export type HotListCategory = {
  kind: HotListItem["kind"];
  title: string;
  description: string;
  count: number;
  items: HotListItem[]; // capped at 5
  href: string;
  tone: "amber" | "destructive" | "muted";
};

export type HotList = {
  counts: HotListCounts;
  categories: HotListCategory[];
  totalAlerts: number;
};

function diffDays(from: string, nowMs: number): number {
  return Math.floor((nowMs - new Date(from).getTime()) / 86400000);
}

function emptyResult(): HotList {
  return {
    counts: {
      pendingGroupMoves: 0,
      pendingPenMoves: 0,
      groupsMissingPens: 0,
      ungatedCowsInGroupsMissingPens: 0,
      cowsWithoutPen: 0,
      overstockedPens: 0,
      understockedPens: 0,
      emptyPens: 0,
    },
    categories: [],
    totalAlerts: 0,
  };
}

export const computeHotList = cache(
  async (locationId: string): Promise<HotList> => {
    if (!locationId) return emptyResult();
    const admin = createAdminClient();
    const nowMs = Date.now();

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
      current_pen_id: string | null;
    };
    type P = {
      id: string;
      group_id: string | null;
      name: string;
      capacity_head: number | null;
    };
    type G = {
      id: string;
      label: string;
      group_slug: string;
      group_class: string;
      display_order: number;
      rule_predicates: Record<string, unknown>;
    };

    const [animalRows, penRows, groupRows, reproRaw, milkMap] = await Promise.all([
      admin
        .from("animals")
        .select(
          "id, animal_id, name, sex, status, life_stage, current_lactation, birth_date, last_calving_date, current_group_id, current_pen_id",
        )
        .eq("location_id", locationId)
        .eq("status", "active")
        .then(({ data }) => (data ?? []) as A[]),
      admin
        .from("pens")
        .select("id, group_id, name, capacity_head")
        .eq("location_id", locationId)
        .then(({ data }) => (data ?? []) as P[]),
      admin
        .from("location_groups")
        .select("id, label, group_slug, group_class, display_order, rule_predicates")
        .eq("location_id", locationId)
        .order("display_order")
        .then(({ data }) => (data ?? []) as G[]),
      admin
        .from("repro_events")
        .select("animal_id, event_date, event_type, result, days_pregnant")
        .order("event_date", { ascending: false })
        .limit(2000)
        .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
      recentAvgDailyMilk(locationId),
    ]);

    const groups: GroupDef[] = groupRows.map((g) => ({
      id: g.id,
      label: g.label,
      group_slug: g.group_slug,
      group_class: g.group_class,
      display_order: g.display_order,
      rule_predicates: g.rule_predicates,
    }));
    const groupLabelById = new Map(groups.map((g) => [g.id, g.label] as const));
    const penNameById = new Map(penRows.map((p) => [p.id, p.name] as const));

    // Latest preg-check per animal.
    type RE = {
      animal_id: string;
      event_date: string;
      event_type: string;
      result: string | null;
      days_pregnant: number | null;
    };
    const latestPC = new Map<string, RE>();
    const ownedIds = new Set(animalRows.map((a) => a.id));
    for (const e of reproRaw as unknown as RE[]) {
      if (e.event_type !== "preg_check") continue;
      if (!ownedIds.has(e.animal_id)) continue;
      if (!latestPC.has(e.animal_id)) latestPC.set(e.animal_id, e);
    }

    // Current pen counts.
    const currentByPen = new Map<string, number>();
    for (const a of animalRows) {
      if (a.current_pen_id)
        currentByPen.set(
          a.current_pen_id,
          (currentByPen.get(a.current_pen_id) ?? 0) + 1,
        );
    }

    // 1. Pending group moves.
    const pendingGroupItems: HotListItem[] = [];
    for (const a of animalRows) {
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
        avg_daily_milk: milkMap.get(a.id) ?? null,
      };
      const sug = suggestGroup(facts, groups, nowMs);
      if (!sug.group_id) continue;
      if (sug.group_id === a.current_group_id) continue;
      pendingGroupItems.push({
        kind: "pending_group",
        label: a.animal_id + (a.name ? ` · ${a.name}` : ""),
        detail: `${a.current_group_id ? groupLabelById.get(a.current_group_id) ?? "—" : "—"} → ${sug.group_label}`,
        href: "/group-moves",
      });
    }

    // 2. Pending pen moves — re-run pen-split engine per group.
    const animalsByGroup = new Map<string, A[]>();
    for (const a of animalRows) {
      if (!a.current_group_id) continue;
      const arr = animalsByGroup.get(a.current_group_id) ?? [];
      arr.push(a);
      animalsByGroup.set(a.current_group_id, arr);
    }
    const pensByGroup = new Map<string, P[]>();
    for (const p of penRows) {
      if (!p.group_id) continue;
      const arr = pensByGroup.get(p.group_id) ?? [];
      arr.push(p);
      pensByGroup.set(p.group_id, arr);
    }

    const pendingPenItems: HotListItem[] = [];
    for (const g of groupRows) {
      const animalsInGroup = animalsByGroup.get(g.id) ?? [];
      const pensInGroup = pensByGroup.get(g.id) ?? [];
      if (animalsInGroup.length === 0 || pensInGroup.length === 0) continue;
      const splitInput: SplitAnimal[] = animalsInGroup.map((a) => ({
        id: a.id,
        animal_id: a.animal_id,
        name: a.name,
        parity: a.current_lactation ?? 0,
        dim: a.last_calving_date ? diffDays(a.last_calving_date, nowMs) : null,
        current_pen_id: a.current_pen_id,
      }));
      const splitPens: SplitPen[] = pensInGroup.map((p) => ({
        id: p.id,
        name: p.name,
        capacity_head: p.capacity_head,
      }));
      const assignments = suggestPenSplit(splitInput, splitPens);
      for (const a of animalsInGroup) {
        const suggested = assignments.get(a.id) ?? null;
        if (!suggested) continue;
        if (suggested === a.current_pen_id) continue;
        pendingPenItems.push({
          kind: "pending_pen",
          label: a.animal_id + (a.name ? ` · ${a.name}` : ""),
          detail: `${a.current_pen_id ? penNameById.get(a.current_pen_id) ?? "—" : "—"} → ${penNameById.get(suggested) ?? "?"}`,
          href: "/pen-moves",
        });
      }
    }

    // 3. Groups with cows but no pens.
    const groupsMissingPensItems: HotListItem[] = [];
    let ungatedCowsInGroupsMissingPens = 0;
    for (const g of groupRows) {
      const cows = animalsByGroup.get(g.id) ?? [];
      const pens = pensByGroup.get(g.id) ?? [];
      if (cows.length > 0 && pens.length === 0) {
        ungatedCowsInGroupsMissingPens += cows.length;
        groupsMissingPensItems.push({
          kind: "groups_missing_pens",
          label: g.label,
          detail: `${cows.length} cow${cows.length === 1 ? "" : "s"} ungated`,
          href: "/pen-moves",
        });
      }
    }

    // 4. Cows with no pen at all.
    const cowsWithoutPenItems: HotListItem[] = animalRows
      .filter((a) => !a.current_pen_id)
      .slice(0, 5)
      .map((a) => ({
        kind: "cows_without_pen",
        label: a.animal_id + (a.name ? ` · ${a.name}` : ""),
        detail: a.current_group_id
          ? `Group: ${groupLabelById.get(a.current_group_id) ?? "—"}`
          : "no group assigned",
        href: "/pen-moves",
      }));
    const cowsWithoutPen = animalRows.filter((a) => !a.current_pen_id).length;

    // 5. Overstocked / understocked / empty pens.
    const overstockedItems: HotListItem[] = [];
    const understockedItems: HotListItem[] = [];
    const emptyItems: HotListItem[] = [];
    for (const p of penRows) {
      const cur = currentByPen.get(p.id) ?? 0;
      const cap = p.capacity_head;
      if (cap === null) {
        if (cur === 0) {
          emptyItems.push({
            kind: "empty_pen",
            label: p.name,
            detail: "no capacity set",
            href: "/pen-moves",
          });
        }
        continue;
      }
      if (cur === 0) {
        emptyItems.push({
          kind: "empty_pen",
          label: p.name,
          detail: `cap ${cap}`,
          href: "/pen-moves",
        });
        continue;
      }
      const pct = cur / cap;
      if (pct > OVERSTOCK_THRESHOLD) {
        overstockedItems.push({
          kind: "overstocked",
          label: p.name,
          detail: `${cur}/${cap} (${Math.round(pct * 100)}%)`,
          href: "/pen-moves",
        });
      } else if (pct < UNDERSTOCK_THRESHOLD) {
        understockedItems.push({
          kind: "understocked",
          label: p.name,
          detail: `${cur}/${cap} (${Math.round(pct * 100)}%)`,
          href: "/pen-moves",
        });
      }
    }

    const counts: HotListCounts = {
      pendingGroupMoves: pendingGroupItems.length,
      pendingPenMoves: pendingPenItems.length,
      groupsMissingPens: groupsMissingPensItems.length,
      ungatedCowsInGroupsMissingPens,
      cowsWithoutPen,
      overstockedPens: overstockedItems.length,
      understockedPens: understockedItems.length,
      emptyPens: emptyItems.length,
    };

    const categories: HotListCategory[] = [];
    if (counts.pendingGroupMoves > 0) {
      categories.push({
        kind: "pending_group",
        title: "Pending group moves",
        description: "Cows whose facts changed — the engine wants to move them to a different group.",
        count: counts.pendingGroupMoves,
        items: pendingGroupItems.slice(0, 5),
        href: "/group-moves",
        tone: "amber",
      });
    }
    if (counts.pendingPenMoves > 0) {
      categories.push({
        kind: "pending_pen",
        title: "Pending pen moves",
        description: "Cows that should restripe across the pens in their current group.",
        count: counts.pendingPenMoves,
        items: pendingPenItems.slice(0, 5),
        href: "/pen-moves",
        tone: "amber",
      });
    }
    if (counts.groupsMissingPens > 0) {
      categories.push({
        kind: "groups_missing_pens",
        title: "Groups missing pens",
        description: "Groups that have cows but zero pens declared — those cows can't be housed.",
        count: counts.groupsMissingPens,
        items: groupsMissingPensItems.slice(0, 5),
        href: "/pen-moves",
        tone: "destructive",
      });
    }
    if (counts.cowsWithoutPen > 0) {
      categories.push({
        kind: "cows_without_pen",
        title: "Cows without a pen",
        description: "Active cows that aren't gated into any pen.",
        count: counts.cowsWithoutPen,
        items: cowsWithoutPenItems,
        href: "/pen-moves",
        tone: "destructive",
      });
    }
    if (counts.overstockedPens > 0) {
      categories.push({
        kind: "overstocked",
        title: "Overstocked pens",
        description: `Pens above ${Math.round(OVERSTOCK_THRESHOLD * 100)}% of capacity. Split or add a pen.`,
        count: counts.overstockedPens,
        items: overstockedItems.slice(0, 5),
        href: "/pen-moves",
        tone: "destructive",
      });
    }
    if (counts.understockedPens > 0) {
      categories.push({
        kind: "understocked",
        title: "Understocked pens",
        description: `Pens below ${Math.round(UNDERSTOCK_THRESHOLD * 100)}% of capacity. Consider merging or shrinking.`,
        count: counts.understockedPens,
        items: understockedItems.slice(0, 5),
        href: "/pen-moves",
        tone: "amber",
      });
    }
    if (counts.emptyPens > 0) {
      categories.push({
        kind: "empty_pen",
        title: "Empty pens",
        description: "Pens with zero cows — candidates for delete or merge.",
        count: counts.emptyPens,
        items: emptyItems.slice(0, 5),
        href: "/pen-moves",
        tone: "muted",
      });
    }

    const totalAlerts = categories.reduce((s, c) => s + c.count, 0);

    return { counts, categories, totalAlerts };
  },
);
