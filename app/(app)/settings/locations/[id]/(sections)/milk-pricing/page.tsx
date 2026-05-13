import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import { ComingSoon } from "@/components/coming-soon";
import { listPricingSchemes } from "../../milk-pricing-actions";
import { MilkPricingTable } from "../../milk-pricing-table";

export const metadata = { title: "Location · Milk pricing" };
export const dynamic = "force-dynamic";

export default async function MilkPricingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAnyRole(["super_admin", "admin"]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  const admin = createAdminClient();
  const { data } = await admin
    .from("locations")
    .select("id, organization_id, manages_livestock")
    .eq("id", id)
    .single();
  if (!data) notFound();
  if (role !== RoleSuperAdmin && data.organization_id !== orgId) notFound();

  if (!data.manages_livestock) {
    return (
      <ComingSoon
        title="Milk pricing"
        description="Pricing applies to locations that manage livestock."
        note="Enable the Livestock module from Locations → Edit."
      />
    );
  }

  const [schemes, templates] = await Promise.all([
    listPricingSchemes(id),
    admin
      .from("org_pricing_scheme_templates")
      .select("id, slug, name, currency, base_unit, correction_method")
      .or(
        `organization_id.is.null,organization_id.eq.${orgId ?? "00000000-0000-0000-0000-000000000000"}`,
      )
      .order("slug")
      .then(({ data }) => data ?? []),
  ]);

  return (
    <div className="flex flex-col gap-4 py-2">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Milk pricing</h1>
        <p className="text-xs text-muted-foreground">
          Effective-dated pricing schemes. Per-cow value reporting and
          tank-settlement reconciliation read the active scheme.
        </p>
      </header>
      <MilkPricingTable
        locationId={id}
        rows={schemes}
        templates={templates.map((t) => ({
          id: t.id as string,
          slug: t.slug as string,
          name: t.name as string,
          currency: t.currency as string,
          base_unit: t.base_unit as string,
          correction_method: t.correction_method as string,
        }))}
      />
    </div>
  );
}
