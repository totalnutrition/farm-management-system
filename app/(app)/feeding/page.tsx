import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import {
  FeedingClient,
  type FeedingEvent,
  type GroupOption,
  type PenOption,
  type FeedOption,
} from "./feeding-client";

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
  const [evRows, groupRows, penRows, feedRows] = await Promise.all([
    admin
      .from("feed_events")
      .select(
        "id, occurred_at, as_fed_kg, dm_kg, note, stock_item_id, group_id, pen_id",
      )
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
          {active.name} · per-group / per-pen feeding deliveries. Each entry
          deducts the consumed kg from the matching feed stock line.
        </p>
      </header>

      <FeedingClient
        locationId={active.id}
        events={events}
        groups={groups}
        pens={pens}
        feeds={feeds}
      />
    </div>
  );
}
