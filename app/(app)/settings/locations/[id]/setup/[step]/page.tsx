import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import {
  FarmTypeView,
  RoleSuperAdmin,
  SetupStepCapacityPlan,
  SetupStepGroupStrategy,
  SetupStepHerdProfile,
  SetupStepIdentity,
  SetupStepRecording,
  SetupStepRules,
  WizardSteps,
  nextWizardStep,
  type SetupStep,
} from "@/lib/misc";
import {
  GroupClassView,
  describePredicates,
  suggestStrategySlug,
} from "@/lib/herd-profile";
import {
  CapacityDefaultsFallback,
  type CapacityDefaults,
} from "@/lib/capacity-defaults";
import { computeCapacityPlan } from "@/lib/capacity-plan";
import { loadStrategyPresetCards } from "@/lib/group-strategy-presets";
import { GroupRuleEditor } from "../../group-rule-editor";
import { CapacityPlanTable } from "../../capacity-plan-table";
import { SetupStepArableParcels, SetupStepBarns, SetupStepPens } from "@/lib/misc";
import { listBarns } from "../../barns-actions";
import { BarnsTable } from "../../barns-table";
import { listPens } from "../../pens-actions";
import { PensTable } from "../../pens-table";
import { listArableParcels } from "../../arable-parcels-actions";
import { ArableParcelsTable } from "../../arable-parcels-table";
import { WizardShell, type WizardLocation } from "../wizard-shell";
import { getRecordingProfile } from "../../recording-actions";
import { RecordingProfileForm } from "../../recording-form";
import {
  getGroups,
  getHerdProfile,
} from "../../groups-actions";
import { HerdProfileForm } from "../../herd-profile-form";
import { GroupStrategyPicker } from "../../group-strategy-picker";

type LocationRow = {
  id: string;
  organization_id: string;
  name: string;
  short_code: string;
  farm_type: string;
  country: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  manages_livestock: boolean;
  manages_crops: boolean;
  livestock_area_hectares: number | null;
  arable_area_hectares: number | null;
  timezone: string | null;
  setup_step: string;
};

export const dynamic = "force-dynamic";

const ValidSteps = new Set(WizardSteps.map((s) => s.key));

export default async function SetupStepPage({
  params,
}: {
  params: Promise<{ id: string; step: string }>;
}) {
  const { id, step } = await params;
  if (!ValidSteps.has(step as SetupStep)) notFound();

  const user = await requireAnyRole(["super_admin", "admin"]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  const admin = createAdminClient();
  const { data } = await admin
    .from("locations")
    .select(
      "id, organization_id, name, short_code, farm_type, country, province, city, address, latitude, longitude, status, manages_livestock, manages_crops, livestock_area_hectares, arable_area_hectares, timezone, setup_step",
    )
    .eq("id", id)
    .single();

  if (!data) notFound();
  const loc = data as LocationRow;
  if (role !== RoleSuperAdmin && loc.organization_id !== orgId) notFound();

  const wizardLoc: WizardLocation = {
    id: loc.id,
    name: loc.name,
    short_code: loc.short_code,
    manages_livestock: loc.manages_livestock,
    manages_crops: loc.manages_crops,
    setup_step: loc.setup_step,
  };

  // Determine the step's "next" so step pages with their own submit
  // know where to advance to.
  const next = nextWizardStep(
    {
      manages_livestock: loc.manages_livestock,
      manages_crops: loc.manages_crops,
    },
    step as SetupStep,
  );

  if (step === SetupStepRecording && loc.manages_livestock) {
    const profile = await getRecordingProfile(id);
    return (
      <WizardShell
        location={wizardLoc}
        currentStep={step as SetupStep}
        hideShellNext
      >
        <RecordingProfileForm
          locationId={id}
          initial={profile}
          mode="wizard"
          nextStep={next}
        />
      </WizardShell>
    );
  }

  if (step === SetupStepHerdProfile && loc.manages_livestock) {
    const profile = await getHerdProfile(id);
    return (
      <WizardShell
        location={wizardLoc}
        currentStep={step as SetupStep}
        hideShellNext
      >
        <HerdProfileForm
          locationId={id}
          initial={profile}
          mode="wizard"
          nextStep={next}
        />
      </WizardShell>
    );
  }

  if (step === SetupStepGroupStrategy && loc.manages_livestock) {
    const [profile, groups, presets] = await Promise.all([
      getHerdProfile(id),
      getGroups(id),
      loadStrategyPresetCards(orgId),
    ]);
    const suggestedSlug = suggestStrategySlug(profile.target_lactating_count);
    const currentSlug =
      groups.find((g) => g.preset_slug)?.preset_slug ?? null;
    return (
      <WizardShell
        location={wizardLoc}
        currentStep={step as SetupStep}
        hideShellNext
      >
        <GroupStrategyPicker
          locationId={id}
          presets={presets}
          suggestedSlug={suggestedSlug}
          currentSlug={currentSlug}
          mode="wizard"
          nextStep={next}
        />
      </WizardShell>
    );
  }

  if (step === SetupStepRules && loc.manages_livestock) {
    const groups = await getGroups(id);
    return (
      <WizardShell location={wizardLoc} currentStep={step as SetupStep}>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Review and tweak the rule predicates assigned to each group.
            Defaults come from the preset you picked in the last step.
            Use Next to continue once they look right.
          </p>
          {groups.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No groups yet — go back and pick a strategy.
            </p>
          ) : (
            <div className="ring-1 ring-foreground/10 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-foreground/5">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Label</th>
                    <th className="px-3 py-2 font-medium">Class</th>
                    <th className="px-3 py-2 font-medium">Rule</th>
                    <th className="px-3 py-2 font-medium text-right">Edit</th>
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
        </div>
      </WizardShell>
    );
  }

  if (step === SetupStepBarns && loc.manages_livestock) {
    const [profile, groups, barns] = await Promise.all([
      getHerdProfile(id),
      getGroups(id),
      listBarns(id),
    ]);
    const { data: capDefaults } = await admin
      .from("org_capacity_defaults")
      .select("*")
      .eq("organization_id", orgId ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
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
      <WizardShell location={wizardLoc} currentStep={step as SetupStep}>
        <BarnsTable
          locationId={id}
          rows={barns}
          planTotalStalls={plan.totals.pen_capacity}
        />
      </WizardShell>
    );
  }

  if (step === SetupStepPens && loc.manages_livestock) {
    const [barns, pens, groups] = await Promise.all([
      listBarns(id),
      listPens(id),
      getGroups(id),
    ]);
    return (
      <WizardShell location={wizardLoc} currentStep={step as SetupStep}>
        <PensTable
          locationId={id}
          rows={pens}
          barns={barns.map((b) => ({ id: b.id, name: b.name }))}
          groups={groups.map((g) => ({ id: g.id, label: g.label }))}
        />
      </WizardShell>
    );
  }

  if (step === SetupStepArableParcels && loc.manages_crops) {
    const parcels = await listArableParcels(id);
    return (
      <WizardShell location={wizardLoc} currentStep={step as SetupStep}>
        <ArableParcelsTable
          locationId={id}
          rows={parcels}
          plannedTotalHectares={
            loc.arable_area_hectares !== null
              ? Number(loc.arable_area_hectares)
              : null
          }
        />
      </WizardShell>
    );
  }

  if (step === SetupStepCapacityPlan && loc.manages_livestock) {
    const [profile, groups] = await Promise.all([
      getHerdProfile(id),
      getGroups(id),
    ]);
    const { data: capDefaults } = await admin
      .from("org_capacity_defaults")
      .select(
        "fresh_stocking_pct, high_stocking_pct, mid_stocking_pct, low_stocking_pct, dry_close_stocking_pct, dry_far_stocking_pct, fresh_bunk_in, high_bunk_in, mid_bunk_in, low_bunk_in, dry_close_bunk_in, dry_far_bunk_in",
      )
      .eq("organization_id", orgId ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
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
      <WizardShell location={wizardLoc} currentStep={step as SetupStep}>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Computed from your herd profile × group rules × organization
            stocking defaults. The Barn and Pen steps build toward these
            numbers.
          </p>
          <CapacityPlanTable plan={plan} />
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell location={wizardLoc} currentStep={step as SetupStep}>
      {step === SetupStepIdentity ? (
        <IdentityReview loc={loc} />
      ) : (
        <ComingSoon stepKey={step as SetupStep} />
      )}
    </WizardShell>
  );
}

function IdentityReview({ loc }: { loc: LocationRow }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="ring-1 ring-foreground/10 p-4 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        <div className="text-muted-foreground">Name</div>
        <div className="font-medium">{loc.name}</div>

        <div className="text-muted-foreground">Short code</div>
        <div className="font-mono">{loc.short_code}</div>

        <div className="text-muted-foreground">Farm type</div>
        <div>{FarmTypeView[loc.farm_type] ?? loc.farm_type}</div>

        <div className="text-muted-foreground">Status</div>
        <div className="capitalize">{loc.status}</div>

        <div className="text-muted-foreground">Timezone</div>
        <div>{loc.timezone ?? "—"}</div>

        <div className="text-muted-foreground">Country / state</div>
        <div>
          {[loc.country, loc.province, loc.city].filter(Boolean).join(", ") ||
            "—"}
        </div>

        {loc.address ? (
          <>
            <div className="text-muted-foreground">Address</div>
            <div className="whitespace-pre-wrap">{loc.address}</div>
          </>
        ) : null}

        {loc.latitude !== null && loc.longitude !== null ? (
          <>
            <div className="text-muted-foreground">Pin</div>
            <div className="font-mono">
              {loc.latitude}, {loc.longitude}
            </div>
          </>
        ) : null}

        <div className="text-muted-foreground">Livestock module</div>
        <div>
          {loc.manages_livestock
            ? `Enabled · ${loc.livestock_area_hectares ?? "—"} ha`
            : "Disabled"}
        </div>

        <div className="text-muted-foreground">Crops module</div>
        <div>
          {loc.manages_crops
            ? `Enabled · ${loc.arable_area_hectares ?? "—"} ha`
            : "Disabled"}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Need to fix something here? Edit it from the{" "}
        <Link
          href="/settings/locations"
          className="underline underline-offset-2"
        >
          Locations list
        </Link>
        . When you&apos;re ready, continue to the next step.
      </p>
    </div>
  );
}

function ComingSoon({ stepKey }: { stepKey: SetupStep }) {
  const step = WizardSteps.find((s) => s.key === stepKey);
  return (
    <div className="ring-1 ring-foreground/10 p-6 flex flex-col gap-2">
      <h3 className="text-sm font-medium">Coming soon</h3>
      <p className="text-xs text-muted-foreground">
        {step?.description} This step is part of the master plan and ships in
        a follow-up PR. You can skip it for now and continue.
      </p>
    </div>
  );
}
