import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import { VendorsClient, type VendorRow } from "./vendors-client";

export const metadata = { title: "Vendors" };
export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const active = await getActiveLocation();
  if (!active) {
    return <NoLocationSelected title="No location selected" hint="Vendors are scoped to the active location." />;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("location_suppliers")
    .select("id, name, category, contact_email, contact_phone, address, payment_terms, notes")
    .eq("location_id", active.id)
    .order("name");

  const rows: VendorRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    category: (r.category as string | null) ?? null,
    contact_email: (r.contact_email as string | null) ?? null,
    contact_phone: (r.contact_phone as string | null) ?? null,
    address: (r.address as string | null) ?? null,
    payment_terms: (r.payment_terms as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
  }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Vendors</h1>
        <p className="text-xs text-muted-foreground">
          {active.name} · suppliers for feed, vet medicine, semen, equipment,
          or services. Procurement receipts reference these.
        </p>
      </header>

      <VendorsClient locationId={active.id} rows={rows} />
    </div>
  );
}
