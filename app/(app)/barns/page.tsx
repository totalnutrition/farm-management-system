import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { CatalogClient, type CatalogRow } from "./barns-client";

export const metadata = { title: "Barns" };
export const dynamic = "force-dynamic";

export default async function BarnsPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );
  const admin = createAdminClient();
  const { data: barns } = await admin
    .from("subjects")
    .select("id, natural_key, attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "barn")
    .order("natural_key");
  const { data: pens } = await admin
    .from("subjects")
    .select("attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "pen");
  const penCount = new Map<string, number>();
  for (const p of pens ?? []) {
    const b = (p.attrs as Record<string, unknown> | null)?.barn;
    if (typeof b === "string") penCount.set(b, (penCount.get(b) ?? 0) + 1);
  }
  const rows: CatalogRow[] = (barns ?? []).map((b) => ({
    id: b.id,
    name: b.natural_key,
    location:
      typeof (b.attrs as Record<string, unknown>)?.location === "string"
        ? ((b.attrs as Record<string, unknown>).location as string)
        : null,
    pens: penCount.get(b.natural_key) ?? 0,
  }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Barns</h1>
        <p className="text-xs text-muted-foreground">
          Barns group pens. Assign a pen to a barn on the Pens screen.
        </p>
      </header>
      <CatalogClient rows={rows} />
    </div>
  );
}
