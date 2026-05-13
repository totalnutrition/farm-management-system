import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import {
  ProcurementClient,
  type ReceiptRow,
  type VendorOption,
  type ExistingStockOption,
  type FeedOption,
  type VetOption,
} from "./procurement-client";

export const metadata = { title: "Procurement" };
export const dynamic = "force-dynamic";

export default async function ProcurementPage() {
  const active = await getActiveLocation();
  if (!active) {
    return <NoLocationSelected title="No location selected" hint="Procurement is scoped to the active location." />;
  }

  const admin = createAdminClient();

  // Fetch movements (receipts) for stock_items at this location.
  const [stockRows, vendorRows, feedRows, vetRows] = await Promise.all([
    admin
      .from("stock_items")
      .select("id, kind, display_name, unit")
      .eq("location_id", active.id)
      .order("display_name")
      .then(({ data }) => (data ?? []) as { id: string; kind: string; display_name: string; unit: string }[]),
    admin
      .from("location_suppliers")
      .select("id, name, category")
      .eq("location_id", active.id)
      .order("name")
      .then(({ data }) => (data ?? []) as { id: string; name: string; category: string | null }[]),
    admin
      .from("org_feed_materials")
      .select("id, name")
      .order("name")
      .then(({ data }) => (data ?? []) as { id: string; name: string }[]),
    admin
      .from("org_vet_medicines")
      .select("id, name")
      .order("name")
      .then(({ data }) => (data ?? []) as { id: string; name: string }[]),
  ]);

  const stockIds = stockRows.map((s) => s.id);
  let receiptRows: Record<string, unknown>[] = [];
  if (stockIds.length > 0) {
    const { data } = await admin
      .from("stock_movements")
      .select("id, occurred_at, stock_item_id, qty_delta, unit_cost, vendor_id, note")
      .eq("kind", "receipt")
      .in("stock_item_id", stockIds)
      .order("occurred_at", { ascending: false })
      .limit(100);
    receiptRows = (data ?? []) as Record<string, unknown>[];
  }

  const stockById = new Map(stockRows.map((s) => [s.id, s] as const));
  const vendorById = new Map(vendorRows.map((v) => [v.id, v.name] as const));

  const rows: ReceiptRow[] = receiptRows.map((r) => {
    const item = stockById.get(r.stock_item_id as string);
    return {
      id: r.id as string,
      occurred_at: r.occurred_at as string,
      vendor_name: r.vendor_id ? vendorById.get(r.vendor_id as string) ?? null : null,
      item_name: item?.display_name ?? null,
      unit: item?.unit ?? null,
      qty: Number(r.qty_delta ?? 0),
      unit_cost: r.unit_cost !== null && r.unit_cost !== undefined ? Number(r.unit_cost) : null,
      note: (r.note as string | null) ?? null,
    };
  });

  const vendors: VendorOption[] = vendorRows.map((v) => ({
    id: v.id,
    name: v.name,
    category: v.category,
  }));
  const existingStock: ExistingStockOption[] = stockRows.map((s) => ({
    id: s.id,
    display_name: s.display_name,
    unit: s.unit,
    kind: s.kind,
  }));
  const feeds: FeedOption[] = feedRows.map((f) => ({ id: f.id, name: f.name }));
  const vetMeds: VetOption[] = vetRows.map((m) => ({ id: m.id, name: m.name }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Procurement</h1>
        <p className="text-xs text-muted-foreground">
          {active.name} · purchase receipts. Each entry lands as a stock
          increase on the matching item line and links the vendor + unit cost.
        </p>
      </header>

      <ProcurementClient
        locationId={active.id}
        rows={rows}
        vendors={vendors}
        existingStock={existingStock}
        feeds={feeds}
        vetMeds={vetMeds}
      />
    </div>
  );
}
