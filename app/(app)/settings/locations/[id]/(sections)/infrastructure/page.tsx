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
import { computeCapacityPlanFromCounts } from "@/lib/capacity-plan";
import { computeGroupHeadcounts } from "@/lib/group-headcount";
import type { GroupDef } from "@/lib/group-rules";
import { ComingSoon } from "@/components/coming-soon";
import { listBarns } from "../../barns-actions";
import { BarnsTable } from "../../barns-table";
import { getGroups } from "../../groups-actions";
import { listPens } from "../../pens-actions";
import { PensTable } from "../../pens-table";
import { CapacityPlanTable } from "../../capacity-plan-table";
import { BarnVisualizer } from "../../barn-visualizer";
import { listArableParcels } from "../../arable-parcels-actions";
import { ArableParcelsTable } from "../../arable-parcels-table";

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
    .select(
      "id, organization_id, manages_livestock, manages_crops, arable_area_hectares",
    )
    .eq("id", id)
    .single();
  if (!data) notFound();
  if (role !== RoleSuperAdmin && data.organization_id !== orgId) notFound();

  if (!data.manages_livestock && !data.manages_crops) {
    return (
      <ComingSoon
        title="Infrastructure"
        description="Barns and pens apply to locations that manage livestock."
        note="Enable the Livestock module from Locations → Edit."
      />
    );
  }

  const [groups, barns, pens, capDefaults, animalGroupRows] = await Promise.all([
    getGroups(id),
    listBarns(id),
    listPens(id),
    admin
      .from("org_capacity_defaults")
      .select("*")
      .eq("organization_id", orgId ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle()
      .then(({ data }) => data),
    admin
      .from("animals")
      .select("current_group_id, current_pen_id")
      .eq("location_id", id)
      .eq("status", "active")
      .then(({ data }) =>
        (data ?? []) as {
          current_group_id: string | null;
          current_pen_id: string | null;
        }[],
      ),
  ]);

  const headcountByGroup: Record<string, number> = {};
  const headcountByPen: Record<string, number> = {};
  for (const a of animalGroupRows) {
    if (a.current_group_id) {
      headcountByGroup[a.current_group_id] = (headcountByGroup[a.current_group_id] ?? 0) + 1;
    }
    if (a.current_pen_id) {
      headcountByPen[a.current_pen_id] = (headcountByPen[a.current_pen_id] ?? 0) + 1;
    }
  }
  const groupLabelById = new Map(groups.map((g) => [g.id, g.label] as const));

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

  // Target capacity per group is driven by the rule engine over the
  // active roster — same engine that powers /group-moves. The actual
  // pen capacity (sum of declared head/bunk on pens you've built) is
  // shown in the per-group sections below.
  const groupDefs: GroupDef[] = groups.map((g) => ({
    id: g.id,
    label: g.label,
    group_slug: g.group_slug,
    group_class: g.group_class,
    display_order: g.display_order,
    rule_predicates: g.rule_predicates as Record<string, unknown>,
  }));
  const headCounts = await computeGroupHeadcounts(id, groupDefs);
  const plan = computeCapacityPlanFromCounts(groups, headCounts.byGroup, defaults);

  // Build a per-group map of target pen capacity + bunk ft so the
  // PensTable can show target alongside declared on each section.
  const targetByGroup: Record<string, { pen_cap: number; bunk_ft: number }> = {};
  for (const row of plan.rows) {
    targetByGroup[row.group_id] = {
      pen_cap: row.pen_capacity,
      bunk_ft: row.bunk_total_ft,
    };
  }

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
        <header className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium">Capacity plan</h2>
          <p className="text-xs text-muted-foreground">
            Per-group target driven by the rule engine over your active
            roster: <span className="font-mono">head × stocking %</span> →
            pen cap, <span className="font-mono">head × bunk in / 12</span> →
            bunk ft. The pens you declare below should sum up to (at least)
            this target.
            {headCounts.unassigned > 0 ? (
              <span className="block text-amber-600 dark:text-amber-400 mt-1">
                {headCounts.unassigned} animal
                {headCounts.unassigned === 1 ? "" : "s"} don&apos;t match any
                group rule — open Group moves to resolve.
              </span>
            ) : null}
          </p>
        </header>
        <CapacityPlanTable plan={plan} />
      </section>
      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <h2 className="text-sm font-medium">Barns</h2>
        <BarnsTable
          locationId={id}
          rows={barns}
          planTotalStalls={plan.totals.pen_capacity}
        />
      </section>
      {barns.some((b) => b.length_ft && b.width_ft) ? (
        <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
          <header className="flex flex-col gap-0.5">
            <h2 className="text-sm font-medium">Visual layout</h2>
            <p className="text-xs text-muted-foreground">
              Top-down view of each barn. Pens are colour-coded by group;
              hover for details. Set length / width on the barn and on each
              pen to control sizing — otherwise pens flow evenly.
            </p>
          </header>
          <div className="flex flex-col gap-4">
            {barns
              .filter((b) => b.length_ft && b.width_ft)
              .map((b) => (
                <BarnVisualizer
                  key={b.id}
                  barn={b}
                  pens={pens}
                  groupLabel={(gid) => (gid ? groupLabelById.get(gid) ?? "—" : "—")}
                  headcountByPen={headcountByPen}
                />
              ))}
          </div>
        </section>
      ) : null}
      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <h2 className="text-sm font-medium">Pens</h2>
        <PensTable
          locationId={id}
          rows={pens}
          barns={barns.map((b) => ({ id: b.id, name: b.name }))}
          groups={groups.map((g) => ({ id: g.id, label: g.label }))}
          headcountByGroup={headcountByGroup}
          targetByGroup={targetByGroup}
        />
      </section>
      {data.manages_crops ? (
        <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
          <h2 className="text-sm font-medium">Arable parcels</h2>
          <ArableParcelsTable
            locationId={id}
            rows={await listArableParcels(id)}
            plannedTotalHectares={
              data.arable_area_hectares !== null
                ? Number(data.arable_area_hectares)
                : null
            }
          />
        </section>
      ) : null}
    </div>
  );
}
