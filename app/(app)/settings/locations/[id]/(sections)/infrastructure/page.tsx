import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import {
  CapacityDefaultsFallback,
  type CapacityDefaults,
} from "@/lib/capacity-defaults";
import { computeCapacityPlan } from "@/lib/capacity-plan";
import { ComingSoon } from "@/components/coming-soon";
import { listBarns } from "../../barns-actions";
import { BarnsTable } from "../../barns-table";
import { getGroups, getHerdProfile } from "../../groups-actions";
import { listPens } from "../../pens-actions";
import { PensTable } from "../../pens-table";

export const metadata = { title: "Location · Infrastructure" };
export const dynamic = "force-dynamic";

export default async function LocationInfrastructurePage({
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
        title="Infrastructure"
        description="Barns and pens apply to locations that manage livestock."
        note="Enable the Livestock module from Locations → Edit."
      />
    );
  }

  const [profile, groups, barns, pens, capDefaults] = await Promise.all([
    getHerdProfile(id),
    getGroups(id),
    listBarns(id),
    listPens(id),
    admin
      .from("org_capacity_defaults")
      .select("*")
      .eq("organization_id", orgId ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle()
      .then(({ data }) => data),
  ]);

  const defaults: CapacityDefaults = capDefaults
    ? {
        fresh_stocking_pct: Number(capDefaults.fresh_stocking_pct),
        high_stocking_pct: Number(capDefaults.high_stocking_pct),
        mid_stocking_pct: Number(capDefaults.mid_stocking_pct),
        low_stocking_pct: Number(capDefaults.low_stocking_pct),
        dry_close_stocking_pct: Number(capDefaults.dry_close_stocking_pct),
        dry_far_stocking_pct: Number(capDefaults.dry_far_stocking_pct),
        fresh_bunk_in: Number(capDefaults.fresh_bunk_in),
        high_bunk_in: Number(capDefaults.high_bunk_in),
        mid_bunk_in: Number(capDefaults.mid_bunk_in),
        low_bunk_in: Number(capDefaults.low_bunk_in),
        dry_close_bunk_in: Number(capDefaults.dry_close_bunk_in),
        dry_far_bunk_in: Number(capDefaults.dry_far_bunk_in),
      }
    : CapacityDefaultsFallback;

  const plan = computeCapacityPlan(profile, groups, defaults);

  return (
    <div className="flex flex-col gap-6 py-2">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Infrastructure</h1>
        <p className="text-xs text-muted-foreground">
          Physical barns and pens. The gauge tracks how close you are to
          the capacity plan&apos;s stall target.
        </p>
      </header>
      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <h2 className="text-sm font-medium">Barns</h2>
        <BarnsTable
          locationId={id}
          rows={barns}
          planTotalStalls={plan.totals.pen_capacity}
        />
      </section>
      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <h2 className="text-sm font-medium">Pens</h2>
        <PensTable
          locationId={id}
          rows={pens}
          barns={barns.map((b) => ({ id: b.id, name: b.name }))}
          groups={groups.map((g) => ({ id: g.id, label: g.label }))}
        />
      </section>
    </div>
  );
}
