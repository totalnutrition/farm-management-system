import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { computePnl, type Entry } from "@/lib/derive/pnl";
import { CommercialClient, type PartyRow } from "./commercial-client";

export const metadata = { title: "Commercial" };
export const dynamic = "force-dynamic";

export default async function CommercialPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );

  const admin = createAdminClient();
  const { data: parties } = await admin
    .from("subjects")
    .select("id, natural_key, subject_type")
    .eq("organization_id", orgId)
    .in("subject_type", ["vendor", "customer"])
    .order("natural_key");
  const vendors: PartyRow[] = (parties ?? [])
    .filter((p) => p.subject_type === "vendor")
    .map((p) => ({ id: p.id, name: p.natural_key }));
  const customers: PartyRow[] = (parties ?? [])
    .filter((p) => p.subject_type === "customer")
    .map((p) => ({ id: p.id, name: p.natural_key }));

  const { data: books } = await admin
    .from("subjects")
    .select("id")
    .eq("organization_id", orgId)
    .eq("subject_type", "ledger")
    .eq("natural_key", "BOOKS")
    .maybeSingle();

  const entries: Entry[] = [];
  const recent: {
    kind: string;
    category: string;
    amount: number;
    party: string | null;
    date: string;
  }[] = [];
  if (books) {
    const { data: txns } = await admin
      .from("events")
      .select("event_code, event_date, payload")
      .eq("organization_id", orgId)
      .eq("subject_id", books.id)
      .in("event_code", [204, 205])
      .order("event_date", { ascending: false })
      .limit(500);
    for (const t of txns ?? []) {
      const p = (t.payload ?? {}) as Record<string, unknown>;
      const kind = t.event_code === 204 ? "sale" : "purchase";
      const amount = typeof p.amount === "number" ? p.amount : 0;
      const category = typeof p.category === "string" ? p.category : "other";
      entries.push({
        kind: kind as "sale" | "purchase",
        category,
        amount,
        date: t.event_date,
      });
      if (recent.length < 30)
        recent.push({
          kind,
          category,
          amount,
          party: typeof p.party === "string" ? p.party : null,
          date: t.event_date,
        });
    }
  }
  const pnl = computePnl(entries);

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Commercial</h1>
        <p className="text-xs text-muted-foreground">
          Vendors, customers, sales & purchases → gross profitability.
        </p>
      </header>
      <CommercialClient
        vendors={vendors}
        customers={customers}
        pnl={pnl}
        recent={recent}
      />
    </div>
  );
}
