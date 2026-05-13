import Link from "next/link";
import { notFound } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Location01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import {
  FarmTypeView,
  RoleSuperAdmin,
  SetupStepDone,
  WizardSteps,
  pathLocationSetup,
} from "@/lib/misc";

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
  setup_completed_at: string | null;
};

export const metadata = { title: "Location" };
export const dynamic = "force-dynamic";

function relevantSteps(loc: LocationRow) {
  return WizardSteps.filter((s) => {
    if (s.livestockOnly && !loc.manages_livestock) return false;
    if (s.cropsOnly && !loc.manages_crops) return false;
    return true;
  });
}

export default async function LocationDetailPage({
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
      "id, organization_id, name, short_code, farm_type, country, province, city, address, latitude, longitude, status, manages_livestock, manages_crops, livestock_area_hectares, arable_area_hectares, timezone, setup_step, setup_completed_at",
    )
    .eq("id", id)
    .single();

  if (!data) notFound();
  const loc = data as LocationRow;
  if (role !== RoleSuperAdmin && loc.organization_id !== orgId) notFound();

  const steps = relevantSteps(loc);
  const completedCount = steps.filter((s) => {
    const stepOrder = WizardSteps.findIndex((w) => w.key === s.key);
    const currentOrder = WizardSteps.findIndex((w) => w.key === loc.setup_step);
    if (loc.setup_step === SetupStepDone) return true;
    return stepOrder < currentOrder;
  }).length;
  const setupComplete = loc.setup_step === SetupStepDone;
  const pct = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/settings/locations" className="hover:underline">
            Locations
          </Link>
          <span>/</span>
          <span className="font-mono">{loc.short_code}</span>
        </div>
        <h2 className="font-heading text-2xl font-medium">{loc.name}</h2>
        <p className="text-xs text-muted-foreground">
          {FarmTypeView[loc.farm_type] ?? loc.farm_type}
          {loc.city ? ` · ${loc.city}` : ""}
          {loc.country ? `, ${loc.country}` : ""}
        </p>
      </header>

      {!setupComplete ? (
        <section className="ring-1 ring-foreground/15 bg-muted/30 p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium">Finish setup</h3>
              <p className="text-xs text-muted-foreground">
                {completedCount} of {steps.length} steps complete ({pct}%).
                You can skip the rest for now and come back later.
              </p>
            </div>
            <Button asChild>
              <Link href={pathLocationSetup(loc.id)}>
                Continue setup
                <HugeiconsIcon icon={ArrowRight01Icon} />
              </Link>
            </Button>
          </div>
          <div className="h-1.5 bg-foreground/10 overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="ring-1 ring-foreground/10 p-4 flex flex-col gap-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <HugeiconsIcon icon={Location01Icon} className="size-4" />
            Identity
          </h3>
          <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Code</dt>
            <dd className="font-mono">{loc.short_code}</dd>
            <dt className="text-muted-foreground">Type</dt>
            <dd>{FarmTypeView[loc.farm_type] ?? loc.farm_type}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="capitalize">{loc.status}</dd>
            <dt className="text-muted-foreground">Timezone</dt>
            <dd>{loc.timezone ?? "—"}</dd>
            {loc.address ? (
              <>
                <dt className="text-muted-foreground">Address</dt>
                <dd className="whitespace-pre-wrap">{loc.address}</dd>
              </>
            ) : null}
            {loc.latitude !== null && loc.longitude !== null ? (
              <>
                <dt className="text-muted-foreground">Pin</dt>
                <dd className="font-mono">
                  {loc.latitude}, {loc.longitude}
                </dd>
              </>
            ) : null}
          </dl>
        </div>

        <div className="ring-1 ring-foreground/10 p-4 flex flex-col gap-2">
          <h3 className="text-sm font-medium">Modules &amp; Areas</h3>
          <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Livestock</dt>
            <dd>
              {loc.manages_livestock
                ? `Enabled · ${loc.livestock_area_hectares ?? "—"} ha`
                : "Disabled"}
            </dd>
            <dt className="text-muted-foreground">Crops</dt>
            <dd>
              {loc.manages_crops
                ? `Enabled · ${loc.arable_area_hectares ?? "—"} ha`
                : "Disabled"}
            </dd>
          </dl>
        </div>
      </section>
    </div>
  );
}
