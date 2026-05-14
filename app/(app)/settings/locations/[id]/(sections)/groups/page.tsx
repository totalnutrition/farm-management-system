import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import {
  GroupClassView,
  describePredicates,
  suggestStrategySlug,
} from "@/lib/herd-profile";
import { CapacityDefaultsFallback } from "@/lib/capacity-defaults";
import { computeCapacityPlanFromCounts } from "@/lib/capacity-plan";
import { loadStrategyPresetCards } from "@/lib/group-strategy-presets";
import { computeGroupHeadcounts } from "@/lib/group-headcount";
import type { GroupDef } from "@/lib/group-rules";
import { ComingSoon } from "@/components/coming-soon";
import { getGroups, getHerdProfile } from "../../groups-actions";
import { GroupStrategyPicker } from "../../group-strategy-picker";
import { GroupRuleEditor } from "../../group-rule-editor";
import { CapacityPlanTable } from "../../capacity-plan-table";

export const metadata = { title: "Location · Herd structure" };
export const dynamic = "force-dynamic";

export default async function LocationGroupsPage({
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
        title="Herd structure"
        description="Groups apply to locations that manage livestock."
        note="Enable the Livestock module from Locations → Edit."
      />
    );
  }

  // Observed animal counts from the actual roster — by life_stage,
  // not by parity, so dry cows show up as dry (they have parity > 0
  // but aren't milking).
  const { data: animalRows } = await admin
    .from("animals")
    .select("sex, status, life_stage")
    .eq("location_id", id);
  const animals = animalRows ?? [];
  const activeAnimals = animals.filter((a) => a.status === "active");
  const observedCounts = {
    lactating: activeAnimals.filter((a) => a.life_stage === "lactating").length,
    dry: activeAnimals.filter((a) => a.life_stage === "dry").length,
    heifer: activeAnimals.filter(
      (a) =>
        a.life_stage === "weaned_heifer" ||
        a.life_stage === "breeding_heifer" ||
        a.life_stage === "bred_heifer",
    ).length,
    calf: activeAnimals.filter((a) => a.life_stage === "calf").length,
    total: activeAnimals.length,
  };

  const [profile, groups, presets, capDefaults] = await Promise.all([
    getHerdProfile(id),
    getGroups(id),
    loadStrategyPresetCards(orgId),
    admin
      .from("org_capacity_defaults")
      .select(
        "fresh_stocking_pct, high_stocking_pct, mid_stocking_pct, low_stocking_pct, dry_close_stocking_pct, dry_far_stocking_pct, fresh_bunk_in, high_bunk_in, mid_bunk_in, low_bunk_in, dry_close_bunk_in, dry_far_bunk_in",
      )
      .eq("organization_id", orgId ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle()
      .then(({ data }) => data),
  ]);

  const defaults = capDefaults
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

  // Run the rule engine over the actual roster to get accurate per-
  // group head counts. The previous implementation used herd_profile
  // targets which left most groups at 0 for fresh installs.
  const groupDefs: GroupDef[] = groups.map((g) => ({
    id: g.id,
    label: g.label,
    group_slug: g.group_slug,
    group_class: g.group_class,
    display_order: g.display_order,
    rule_predicates: g.rule_predicates as Record<string, unknown>,
  }));
  const headCounts = await computeGroupHeadcounts(id, groupDefs);
  const capacityPlan = computeCapacityPlanFromCounts(
    groups,
    headCounts.byGroup,
    defaults,
  );
  // profile remains in scope for the suggested-slug helper below.
  void profile;

  const suggestedSlug = suggestStrategySlug(profile.target_lactating_count);
  const currentSlug =
    groups.find((g) => g.preset_slug)?.preset_slug ?? null;

  return (
    <div className="flex flex-col gap-6 py-2">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Herd structure</h1>
        <p className="text-xs text-muted-foreground">
          Logical cohorts that drive ration assignment and milking order.
          Animal counts come from the roster — add or import animals to
          shape these numbers.
        </p>
      </header>

      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <h2 className="text-sm font-medium">Observed herd counts</h2>
        <p className="text-xs text-muted-foreground">
          Derived from active animals at this location. Capacity-plan math
          below uses these numbers.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-xs">
          <Stat label="Total active" value={observedCounts.total} />
          <Stat label="Lactating" value={observedCounts.lactating} />
          <Stat label="Dry" value={observedCounts.dry} />
          <Stat label="Heifers" value={observedCounts.heifer} />
          <Stat label="Calves" value={observedCounts.calf} />
        </div>
      </section>

      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <header className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium">Active strategy</h2>
          <p className="text-xs text-muted-foreground">
            {currentSlug ? (
              <>
                Current preset: <span className="font-medium">{currentSlug}</span>.
              </>
            ) : (
              <>No strategy applied yet. Pick or duplicate one below.</>
            )}
          </p>
        </header>
        <GroupStrategyPicker
          locationId={id}
          presets={presets}
          suggestedSlug={suggestedSlug}
          currentSlug={currentSlug}
          mode="standalone"
        />
      </section>

      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <h2 className="text-sm font-medium">Current groups &amp; rules</h2>
        {groups.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No groups yet. Pick a strategy above to seed them.
          </p>
        ) : (
          <div className="ring-1 ring-foreground/10 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-foreground/5">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Label</th>
                  <th className="px-3 py-2 font-medium">Class</th>
                  <th className="px-3 py-2 font-medium">Rule</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-t border-foreground/10">
                    <td className="px-3 py-2 font-medium">{g.label}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {GroupClassView[g.group_class] ?? g.group_class}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px]">
                      {describePredicates(g.rule_predicates)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <GroupRuleEditor
                        group={{
                          id: g.id,
                          label: g.label,
                          rule_predicates: g.rule_predicates,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <header className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium">Capacity plan</h2>
          <p className="text-xs text-muted-foreground">
            Each row&apos;s <span className="font-medium">Head</span> is the
            count of active animals the rule engine would place in that
            group right now (including milk yield for High / Mid / Low).
            <span className="font-medium"> Pen cap</span> ={" "}
            <span className="font-mono">head × stocking %</span> — the
            minimum stall count those pens must provide.{" "}
            <span className="font-medium">Bunk ft</span> ={" "}
            <span className="font-mono">head × bunk in/cow ÷ 12</span> — the
            minimum running feet of feed bunk. Settings → Infrastructure
            is where you build pens to satisfy these targets.
            {headCounts.unassigned > 0 ? (
              <span className="block text-amber-600 dark:text-amber-400 mt-1">
                {headCounts.unassigned} animal
                {headCounts.unassigned === 1 ? "" : "s"} don&apos;t match any
                group rule yet — likely missing milk data or out-of-range
                facts. Open Group moves to see which.
              </span>
            ) : null}
          </p>
        </header>
        <CapacityPlanTable plan={capacityPlan} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="ring-1 ring-foreground/10 p-3 flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-lg font-medium tabular-nums">{value}</span>
    </div>
  );
}
