import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import {
  RefusalsClient,
  type RefusalRow,
  type GroupOption,
  type PenOption,
  type FeedEventOption,
} from "./refusals-client";

export const metadata = { title: "Refusals" };
export const dynamic = "force-dynamic";

export default async function RefusalsPage() {
  const active = await getActiveLocation();
  if (!active) {
    return <NoLocationSelected title="No location selected" hint="Refusals are scoped to the active location." />;
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
  const [refRows, groupRows, penRows, feedEvRows] = await Promise.all([
    admin
      .from("feed_refusals")
      .select("id, occurred_at, refusal_kg, group_id, pen_id, feed_event_id, note")
      .eq("location_id", active.id)
      .order("occurred_at", { ascending: false })
      .limit(100)
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
      .from("feed_events")
      .select("id, occurred_at, stock_item_id")
      .eq("location_id", active.id)
      .order("occurred_at", { ascending: false })
      .limit(50)
      .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
  ]);

  const stockIds = Array.from(
    new Set(
      feedEvRows.map((e) => e.stock_item_id as string | null).filter(Boolean) as string[],
    ),
  );
  const feedNameById = new Map<string, string>();
  if (stockIds.length > 0) {
    const { data } = await admin
      .from("stock_items")
      .select("id, display_name")
      .in("id", stockIds);
    for (const r of data ?? []) {
      feedNameById.set(r.id as string, r.display_name as string);
    }
  }

  const groupById = new Map(groupRows.map((g) => [g.id, g.label] as const));
  const penById = new Map(penRows.map((p) => [p.id, p.name] as const));
  const feedEventById = new Map(
    feedEvRows.map((e) => [
      e.id as string,
      {
        occurred_at: e.occurred_at as string,
        feed_name: e.stock_item_id ? feedNameById.get(e.stock_item_id as string) ?? null : null,
      },
    ] as const),
  );

  const rows: RefusalRow[] = refRows.map((r) => ({
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

  const groups: GroupOption[] = groupRows.map((g) => ({ id: g.id, label: g.label }));
  const pens: PenOption[] = penRows.map((p) => ({ id: p.id, name: p.name }));
  const feedEvents: FeedEventOption[] = feedEvRows.map((e) => ({
    id: e.id as string,
    occurred_at: e.occurred_at as string,
    feed_name: e.stock_item_id ? feedNameById.get(e.stock_item_id as string) ?? null : null,
  }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Refusals</h1>
        <p className="text-xs text-muted-foreground">
          {active.name} · per-group refusal (orts) weight tied to a feeding
          event. Drives intake calculations and recipe correction.
        </p>
      </header>

      <RefusalsClient
        locationId={active.id}
        rows={rows}
        groups={groups}
        pens={pens}
        feedEvents={feedEvents}
      />
    </div>
  );
}
