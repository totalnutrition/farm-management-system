import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import {
  type FeedingEvent,
  type GroupOption,
  type PenOption,
  type FeedOption,
  type RecipeOption,
} from "./feeding-client";
import { type RefusalRow, type FeedEventOption } from "@/app/(app)/refusals/refusals-client";
import { FeedingHub, type DailyAggregate } from "./feeding-hub";

export const metadata = { title: "Feeding" };
export const dynamic = "force-dynamic";

export default async function FeedingPage() {
  const active = await getActiveLocation();
  if (!active) {
    return (
      <NoLocationSelected
        title="No location selected"
        hint="Feeding events are scoped to the active location."
      />
    );
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
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  // Recipes table may not be migrated yet — wrap in try/catch.
  let recipes: RecipeOption[] = [];
  try {
    const { data, error } = await admin
      .from("tmr_recipes")
      .select("id, name")
      .eq("location_id", active.id)
      .eq("is_active", true)
      .order("name");
    if (!error && data) {
      recipes = data.map((r) => ({ id: r.id as string, name: r.name as string }));
    }
  } catch {
    recipes = [];
  }

  const [evRows, refRows, groupRows, penRows, feedRows] = await Promise.all([
    admin
      .from("feed_events")
      .select(
        "id, occurred_at, as_fed_kg, dm_kg, note, stock_item_id, group_id, pen_id",
      )
      .eq("location_id", active.id)
      .order("occurred_at", { ascending: false })
      .limit(200)
      .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
    admin
      .from("feed_refusals")
      .select("id, occurred_at, refusal_kg, group_id, pen_id, feed_event_id, note")
      .eq("location_id", active.id)
      .order("occurred_at", { ascending: false })
      .limit(200)
      .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
    admin
      .from("location_groups")
      .select("id, label")
      .eq("location_id", active.id)
      .order("display_order")
      .then(({ data }) => (data ?? []) as { id: string; label: string }[]),
    admin
      .from("pens")
      .select("id, name")
      .eq("location_id", active.id)
      .order("name")
      .then(({ data }) => (data ?? []) as { id: string; name: string }[]),
    admin
      .from("org_feed_materials")
      .select("id, name, dm_pct")
      .order("name")
      .then(({ data }) => (data ?? []) as { id: string; name: string; dm_pct: number | null }[]),
  ]);

  const stockItemIds = Array.from(
    new Set(evRows.map((e) => e.stock_item_id as string | null).filter(Boolean) as string[]),
  );
  const stockNameById = new Map<string, string>();
  if (stockItemIds.length > 0) {
    const { data } = await admin
      .from("stock_items")
      .select("id, display_name")
      .in("id", stockItemIds);
    for (const r of data ?? []) {
      stockNameById.set(r.id as string, r.display_name as string);
    }
  }

  const groupById = new Map(groupRows.map((g) => [g.id, g.label] as const));
  const penById = new Map(penRows.map((p) => [p.id, p.name] as const));

  const events: FeedingEvent[] = evRows.map((e) => ({
    id: e.id as string,
    occurred_at: e.occurred_at as string,
    as_fed_kg: Number(e.as_fed_kg ?? 0),
    dm_kg: e.dm_kg !== null && e.dm_kg !== undefined ? Number(e.dm_kg) : null,
    group_label: e.group_id ? groupById.get(e.group_id as string) ?? null : null,
    pen_name: e.pen_id ? penById.get(e.pen_id as string) ?? null : null,
    feed_name: e.stock_item_id ? stockNameById.get(e.stock_item_id as string) ?? null : null,
    note: (e.note as string | null) ?? null,
  }));

  const feedEventById = new Map(
    evRows.map((e) => [
      e.id as string,
      {
        occurred_at: e.occurred_at as string,
        feed_name: e.stock_item_id ? stockNameById.get(e.stock_item_id as string) ?? null : null,
      },
    ] as const),
  );

  const refusals: RefusalRow[] = refRows.map((r) => ({
    id: r.id as string,
    occurred_at: r.occurred_at as string,
    refusal_kg: Number(r.refusal_kg ?? 0),
    group_label: r.group_id ? groupById.get(r.group_id as string) ?? null : null,
    pen_name: r.pen_id ? penById.get(r.pen_id as string) ?? null : null,
    feed_event_at: r.feed_event_id
      ? feedEventById.get(r.feed_event_id as string)?.occurred_at ?? null
      : null,
    note: (r.note as string | null) ?? null,
  }));

  const feedEventOptions: FeedEventOption[] = evRows.slice(0, 50).map((e) => ({
    id: e.id as string,
    occurred_at: e.occurred_at as string,
    feed_name: e.stock_item_id ? stockNameById.get(e.stock_item_id as string) ?? null : null,
  }));

  // Today aggregates by group/pen
  const todayEvents = evRows.filter((e) => (e.occurred_at as string) >= todayStartIso);
  const todayRefusals = refRows.filter((r) => (r.occurred_at as string) >= todayStartIso);
  const aggMap = new Map<string, DailyAggregate>();
  const aggKey = (gId: string | null, pId: string | null) => `${gId ?? ""}|${pId ?? ""}`;
  for (const e of todayEvents) {
    const k = aggKey(e.group_id as string | null, e.pen_id as string | null);
    const cur =
      aggMap.get(k) ??
      ({
        group_label: e.group_id ? groupById.get(e.group_id as string) ?? null : null,
        pen_name: e.pen_id ? penById.get(e.pen_id as string) ?? null : null,
        total_as_fed_kg: 0,
        total_dm_kg: null,
        total_refusal_kg: 0,
        intake_kg: null,
      } as DailyAggregate);
    cur.total_as_fed_kg += Number(e.as_fed_kg ?? 0);
    if (e.dm_kg !== null && e.dm_kg !== undefined) {
      cur.total_dm_kg = (cur.total_dm_kg ?? 0) + Number(e.dm_kg);
    }
    aggMap.set(k, cur);
  }
  for (const r of todayRefusals) {
    const k = aggKey(r.group_id as string | null, r.pen_id as string | null);
    const cur =
      aggMap.get(k) ??
      ({
        group_label: r.group_id ? groupById.get(r.group_id as string) ?? null : null,
        pen_name: r.pen_id ? penById.get(r.pen_id as string) ?? null : null,
        total_as_fed_kg: 0,
        total_dm_kg: null,
        total_refusal_kg: 0,
        intake_kg: null,
      } as DailyAggregate);
    cur.total_refusal_kg += Number(r.refusal_kg ?? 0);
    aggMap.set(k, cur);
  }
  const todayAggregates = Array.from(aggMap.values()).map((a) => ({
    ...a,
    intake_kg: a.total_as_fed_kg > 0 ? a.total_as_fed_kg - a.total_refusal_kg : null,
  }));
  todayAggregates.sort((a, b) => b.total_as_fed_kg - a.total_as_fed_kg);

  const groups: GroupOption[] = groupRows.map((g) => ({ id: g.id, label: g.label }));
  const pens: PenOption[] = penRows.map((p) => ({ id: p.id, name: p.name }));
  const feeds: FeedOption[] = feedRows.map((f) => ({
    id: f.id,
    name: f.name,
    dm_pct: f.dm_pct,
  }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Feeding</h1>
        <p className="text-xs text-muted-foreground">
          {active.name} · today&apos;s deliveries + refusals + the feed
          catalog snapshot. Recording feedings deducts stock automatically.
        </p>
      </header>

      <FeedingHub
        locationId={active.id}
        events={events}
        refusals={refusals}
        groups={groups}
        pens={pens}
        feeds={feeds}
        recipes={recipes}
        feedEventOptions={feedEventOptions}
        todayAggregates={todayAggregates}
      />
    </div>
  );
}
