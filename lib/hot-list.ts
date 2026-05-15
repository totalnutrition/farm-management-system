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
import { loadPlaybook, resolveKpi, KPI_KEYS } from "@/lib/playbook";

const DEFAULT_GESTATION_DAYS = 280;

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
  // ----- Reproduction -----
  /** Pregnant cows expected to calve within DUE_TO_CALVE_WINDOW_DAYS. */
  dueToCalve: number;
  /** Active lactating cows past 150 DIM with no positive preg check. */
  openOver150: number;
  // ----- Health -----
  /** Cows with an active milk-withdrawal hold (do NOT send to tank). */
  withdrawalHold: number;
  /** Cows whose milk withdrawal expires within 24 h. */
  withdrawalExpiring: number;
  /** Cows scored locomotion ≥ 3 within the last 14 d. */
  lame: number;
  // ----- Milk recording (data hygiene) -----
  /** Bulk-tank reading missing for today. */
  bulkTankMissingToday: number;
  /** Last DHI test day across the herd is older than 30 d. */
  testDayOverdue: number;
  // ----- Inventory -----
  /** Stock lines below their reorder level. */
  stockBelowReorder: number;
};

export type HotListItem = {
  kind:
    | "pending_group"
    | "pending_pen"
    | "groups_missing_pens"
    | "cows_without_pen"
    | "overstocked"
    | "understocked"
    | "empty_pen"
    | "due_to_calve"
    | "open_over_150"
    | "withdrawal_hold"
    | "withdrawal_expiring"
    | "lame"
    | "bulk_tank_missing"
    | "test_day_overdue"
    | "stock_low";
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
      dueToCalve: 0,
      openOver150: 0,
      withdrawalHold: 0,
      withdrawalExpiring: 0,
      lame: 0,
      bulkTankMissingToday: 0,
      testDayOverdue: 0,
      stockBelowReorder: 0,
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

    // Resolve all KPI thresholds from this location's playbook (with
    // hardcoded fallback). loadPlaybook is React.cache'd so this is
    // free if the playbook page already triggered a load this render.
    const playbook = await loadPlaybook(locationId);
    const OVERSTOCK_THRESHOLD = resolveKpi(playbook, KPI_KEYS.stocking_overstock_pct);
    const UNDERSTOCK_THRESHOLD = resolveKpi(playbook, KPI_KEYS.stocking_understock_pct);
    const OPEN_THRESHOLD_DIM = resolveKpi(playbook, KPI_KEYS.open_threshold_dim);
    const LAMENESS_LOCOMOTION_THRESHOLD = resolveKpi(
      playbook,
      KPI_KEYS.lameness_locomotion_threshold,
    );
    const LAMENESS_WINDOW_DAYS = resolveKpi(playbook, KPI_KEYS.lameness_window_days);
    const TEST_DAY_STALE_DAYS = resolveKpi(playbook, KPI_KEYS.test_day_stale_days);
    const WITHDRAWAL_EXPIRING_WINDOW_HOURS = resolveKpi(
      playbook,
      KPI_KEYS.withdrawal_expiring_window_hours,
    );
    const DUE_TO_CALVE_WINDOW_DAYS = resolveKpi(
      playbook,
      KPI_KEYS.due_to_calve_window_days,
    );

    const todayISO = new Date().toISOString().slice(0, 10);
    const lameSince = new Date(nowMs - LAMENESS_WINDOW_DAYS * 86400000)
      .toISOString()
      .slice(0, 10);

    const [
      animalRows,
      penRows,
      groupRows,
      reproRaw,
      milkMap,
      healthRaw,
      bulkTodayCount,
      lastTestDate,
      stockRaw,
      dairyRow,
    ] = await Promise.all([
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
      admin
        .from("health_events")
        .select(
          "id, animal_id, event_date, event_type, diagnosis_text, locomotion_score, withdrawal_milk_end, withdrawal_meat_end",
        )
        .gte("event_date", lameSince)
        .order("event_date", { ascending: false })
        .limit(2000)
        .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
      admin
        .from("bulk_tank_readings")
        .select("id", { count: "exact", head: true })
        .eq("location_id", locationId)
        .gte("reading_at", todayISO + "T00:00:00Z")
        .then(
          ({ count }) => count ?? 0,
          () => 0,
        ),
      admin
        .from("test_days")
        .select("test_date")
        .order("test_date", { ascending: false })
        .limit(1)
        .then(({ data }) =>
          ((data ?? []) as Array<{ test_date: string }>)[0]?.test_date ?? null,
        ),
      admin
        .from("stock_items")
        .select("id, display_name, kind, unit, on_hand_qty, reorder_level, is_active")
        .eq("location_id", locationId)
        .eq("is_active", true)
        .not("reorder_level", "is", null)
        .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
      admin
        .from("location_dairy_settings")
        .select("expected_gestation_days, voluntary_waiting_period_days")
        .eq("location_id", locationId)
        .maybeSingle()
        .then(({ data }) => data as Record<string, unknown> | null),
    ]);

    const gestationDays =
      (dairyRow?.expected_gestation_days as number | undefined) ??
      DEFAULT_GESTATION_DAYS;

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

    // ---- 6. Reproduction-driven alerts ----------------------------
    const animalLabelById = new Map(
      animalRows.map((a) => [a.id, `${a.animal_id}${a.name ? ` · ${a.name}` : ""}`]),
    );
    const dueToCalveItems: HotListItem[] = [];
    const openOver150Items: HotListItem[] = [];

    for (const a of animalRows) {
      const pc = latestPC.get(a.id);
      const isPreg = pc?.result === "pregnant";
      if (isPreg && pc?.days_pregnant !== null && pc?.days_pregnant !== undefined) {
        const daysToCalving = gestationDays - Number(pc.days_pregnant);
        if (daysToCalving >= 0 && daysToCalving <= DUE_TO_CALVE_WINDOW_DAYS) {
          dueToCalveItems.push({
            kind: "due_to_calve",
            label: animalLabelById.get(a.id) ?? "—",
            detail: `~${daysToCalving} d to calve`,
            href: `/animals/${a.id}`,
          });
        }
      }
      if (
        (a.current_lactation ?? 0) > 0 &&
        a.last_calving_date &&
        !isPreg
      ) {
        const dim = Math.floor(
          (nowMs - new Date(a.last_calving_date).getTime()) / 86400000,
        );
        if (dim > OPEN_THRESHOLD_DIM) {
          openOver150Items.push({
            kind: "open_over_150",
            label: animalLabelById.get(a.id) ?? "—",
            detail: `${dim} DIM`,
            href: `/animals/${a.id}`,
          });
        }
      }
    }

    // ---- 7. Health alerts (withdrawal, lameness) ------------------
    type HE = {
      id: string;
      animal_id: string;
      event_date: string;
      event_type: string;
      diagnosis_text: string | null;
      locomotion_score: number | null;
      withdrawal_milk_end: string | null;
      withdrawal_meat_end: string | null;
    };
    const healthEvents = healthRaw as unknown as HE[];

    const wdByAnimal = new Map<string, HE>();
    for (const e of healthEvents) {
      if (!e.withdrawal_milk_end) continue;
      const prev = wdByAnimal.get(e.animal_id);
      if (!prev || new Date(e.withdrawal_milk_end) > new Date(prev.withdrawal_milk_end!))
        wdByAnimal.set(e.animal_id, e);
    }
    const withdrawalHoldItems: HotListItem[] = [];
    const withdrawalExpiringItems: HotListItem[] = [];
    const expiringCutoff = nowMs + WITHDRAWAL_EXPIRING_WINDOW_HOURS * 3600_000;
    for (const e of wdByAnimal.values()) {
      const endMs = new Date(e.withdrawal_milk_end!).getTime();
      if (endMs <= nowMs) continue;
      const cow = animalLabelById.get(e.animal_id);
      if (!cow) continue;
      const hrs = Math.round((endMs - nowMs) / 3600_000);
      const detail = `milk WD: ${hrs < 24 ? `${hrs} h` : `${Math.round(hrs / 24)} d`} left`;
      if (endMs <= expiringCutoff) {
        withdrawalExpiringItems.push({
          kind: "withdrawal_expiring",
          label: cow,
          detail,
          href: `/animals/${e.animal_id}`,
        });
      } else {
        withdrawalHoldItems.push({
          kind: "withdrawal_hold",
          label: cow,
          detail,
          href: `/animals/${e.animal_id}`,
        });
      }
    }

    const lameByAnimal = new Map<string, HE>();
    for (const e of healthEvents) {
      if (e.locomotion_score === null || e.locomotion_score === undefined) continue;
      if (e.locomotion_score < LAMENESS_LOCOMOTION_THRESHOLD) continue;
      const prev = lameByAnimal.get(e.animal_id);
      if (!prev || new Date(e.event_date) > new Date(prev.event_date))
        lameByAnimal.set(e.animal_id, e);
    }
    const lameItems: HotListItem[] = Array.from(lameByAnimal.values()).map((e) => ({
      kind: "lame",
      label: animalLabelById.get(e.animal_id) ?? "—",
      detail: `LS ${e.locomotion_score} on ${e.event_date}`,
      href: `/animals/${e.animal_id}`,
    }));

    // ---- 8. Milk-recording hygiene --------------------------------
    const bulkTankMissingItems: HotListItem[] =
      bulkTodayCount === 0
        ? [
            {
              kind: "bulk_tank_missing",
              label: "Bulk-tank reading missing today",
              detail: "Log the morning reading on /milk.",
              href: "/milk",
            },
          ]
        : [];
    const testDayOverdueItems: HotListItem[] = [];
    if (!lastTestDate) {
      testDayOverdueItems.push({
        kind: "test_day_overdue",
        label: "No DHI test day on record",
        detail: "Log the first test day on /test-days.",
        href: "/test-days",
      });
    } else {
      const ageDays = Math.floor(
        (nowMs - new Date(lastTestDate as string).getTime()) / 86400000,
      );
      if (ageDays > TEST_DAY_STALE_DAYS) {
        testDayOverdueItems.push({
          kind: "test_day_overdue",
          label: `Last test day ${ageDays} d ago`,
          detail: `Industry cadence is ~${TEST_DAY_STALE_DAYS} d.`,
          href: "/test-days",
        });
      }
    }

    // ---- 9. Inventory ---------------------------------------------
    type SI = {
      id: string;
      display_name: string;
      kind: string;
      unit: string;
      on_hand_qty: number | string;
      reorder_level: number | string | null;
    };
    const stockLowItems: HotListItem[] = (stockRaw as unknown as SI[])
      .filter((s) => {
        const reorder = s.reorder_level === null ? null : Number(s.reorder_level);
        if (reorder === null) return false;
        return Number(s.on_hand_qty) <= reorder;
      })
      .map((s) => ({
        kind: "stock_low",
        label: s.display_name,
        detail: `${Number(s.on_hand_qty)} ${s.unit} (reorder ≤ ${Number(s.reorder_level)})`,
        href: "/stocks",
      }));

    const counts: HotListCounts = {
      pendingGroupMoves: pendingGroupItems.length,
      pendingPenMoves: pendingPenItems.length,
      groupsMissingPens: groupsMissingPensItems.length,
      ungatedCowsInGroupsMissingPens,
      cowsWithoutPen,
      overstockedPens: overstockedItems.length,
      understockedPens: understockedItems.length,
      emptyPens: emptyItems.length,
      dueToCalve: dueToCalveItems.length,
      openOver150: openOver150Items.length,
      withdrawalHold: withdrawalHoldItems.length,
      withdrawalExpiring: withdrawalExpiringItems.length,
      lame: lameItems.length,
      bulkTankMissingToday: bulkTankMissingItems.length,
      testDayOverdue: testDayOverdueItems.length,
      stockBelowReorder: stockLowItems.length,
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
    if (counts.withdrawalHold > 0) {
      categories.push({
        kind: "withdrawal_hold",
        title: "On withdrawal hold",
        description: "Milk from these cows is on a drug-withdrawal hold. Do NOT send to the tank.",
        count: counts.withdrawalHold,
        items: withdrawalHoldItems.slice(0, 5),
        href: "/health",
        tone: "destructive",
      });
    }
    if (counts.withdrawalExpiring > 0) {
      categories.push({
        kind: "withdrawal_expiring",
        title: "Withdrawal expiring today",
        description: "Withdrawals end within 24 h — milk can return to the tank tomorrow.",
        count: counts.withdrawalExpiring,
        items: withdrawalExpiringItems.slice(0, 5),
        href: "/health",
        tone: "amber",
      });
    }
    if (counts.dueToCalve > 0) {
      categories.push({
        kind: "due_to_calve",
        title: "Due to calve",
        description: `Pregnant cows expected to calve in the next ${DUE_TO_CALVE_WINDOW_DAYS} days.`,
        count: counts.dueToCalve,
        items: dueToCalveItems.slice(0, 5),
        href: "/reproduction",
        tone: "amber",
      });
    }
    if (counts.openOver150 > 0) {
      categories.push({
        kind: "open_over_150",
        title: "Open > 150 DIM",
        description: "Lactating cows past 150 days in milk without a positive preg check.",
        count: counts.openOver150,
        items: openOver150Items.slice(0, 5),
        href: "/reproduction",
        tone: "amber",
      });
    }
    if (counts.lame > 0) {
      categories.push({
        kind: "lame",
        title: "Lame cows",
        description: `Locomotion score ≥ ${LAMENESS_LOCOMOTION_THRESHOLD} in the last ${LAMENESS_WINDOW_DAYS} days.`,
        count: counts.lame,
        items: lameItems.slice(0, 5),
        href: "/health",
        tone: "amber",
      });
    }
    if (counts.bulkTankMissingToday > 0) {
      categories.push({
        kind: "bulk_tank_missing",
        title: "Bulk-tank reading missing",
        description: "No tank reading logged for today yet.",
        count: counts.bulkTankMissingToday,
        items: bulkTankMissingItems,
        href: "/milk",
        tone: "amber",
      });
    }
    if (counts.testDayOverdue > 0) {
      categories.push({
        kind: "test_day_overdue",
        title: "Test day overdue",
        description: `DHI cadence target is ${TEST_DAY_STALE_DAYS} days between tests.`,
        count: counts.testDayOverdue,
        items: testDayOverdueItems,
        href: "/test-days",
        tone: "muted",
      });
    }
    if (counts.stockBelowReorder > 0) {
      categories.push({
        kind: "stock_low",
        title: "Stock below reorder",
        description: "Inventory items at or below their reorder threshold.",
        count: counts.stockBelowReorder,
        items: stockLowItems.slice(0, 5),
        href: "/stocks",
        tone: "amber",
      });
    }

    const totalAlerts = categories.reduce((s, c) => s + c.count, 0);

    return { counts, categories, totalAlerts };
  },
);
