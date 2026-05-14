import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import { StocksClient, type StockItem } from "./stocks-client";

export const metadata = { title: "Stocks" };
export const dynamic = "force-dynamic";

export default async function StocksPage() {
  const active = await getActiveLocation();
  if (!active) {
    return <NoLocationSelected title="No location selected" hint="Stock is scoped to the active location." />;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("stock_items")
    .select("id, kind, display_name, unit, on_hand_qty, reorder_level, unit_cost_current")
    .eq("location_id", active.id)
    .order("display_name");

  const items: StockItem[] = (data ?? []).map((r) => ({
    id: r.id as string,
    kind: r.kind as string,
    display_name: r.display_name as string,
    unit: r.unit as string,
    on_hand_qty: Number(r.on_hand_qty ?? 0),
    reorder_level: r.reorder_level !== null && r.reorder_level !== undefined ? Number(r.reorder_level) : null,
    unit_cost_current: r.unit_cost_current !== null && r.unit_cost_current !== undefined ? Number(r.unit_cost_current) : null,
  }));

  const lowCount = items.filter(
    (i) => i.reorder_level !== null && i.on_hand_qty <= i.reorder_level,
  ).length;

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Stocks</h1>
        <p className="text-xs text-muted-foreground">
          {active.name} · on-hand inventory.{" "}
          {items.length === 0
            ? "No lines yet."
            : `${items.length} line${items.length === 1 ? "" : "s"} · ${lowCount} at or below reorder.`}
        </p>
      </header>

      <StocksClient items={items} />
    </div>
  );
}
