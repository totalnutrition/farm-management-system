import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { FarmTypeView, RoleSuperAdmin } from "@/lib/misc";
import {
  resolveLocationSettings,
  sourceLabel,
  type SettingSource,
  type Units,
} from "@/lib/settings-resolver";

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
  currency_override: string | null;
  units_override: Units | null;
};

type OrgRow = {
  id: string;
  name: string;
  default_currency: string;
  default_units: Units;
  default_timezone: string;
};

export const metadata = { title: "Location · General" };
export const dynamic = "force-dynamic";

function SourceBadge({ source }: { source: SettingSource }) {
  const styles =
    source === "location"
      ? "bg-primary/10 text-primary ring-primary/20"
      : source === "organization"
        ? "bg-foreground/5 text-muted-foreground ring-foreground/10"
        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20";
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 ring-1 ${styles}`}
      title={sourceLabel(source)}
    >
      {source === "location"
        ? "Set here"
        : source === "organization"
          ? "Inherited"
          : "Fallback"}
    </span>
  );
}

export default async function LocationGeneralPage({
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
      "id, organization_id, name, short_code, farm_type, country, province, city, address, latitude, longitude, status, manages_livestock, manages_crops, livestock_area_hectares, arable_area_hectares, timezone, currency_override, units_override",
    )
    .eq("id", id)
    .single();

  if (!data) notFound();
  const loc = data as LocationRow;
  if (role !== RoleSuperAdmin && loc.organization_id !== orgId) notFound();

  const { data: orgData } = await admin
    .from("organizations")
    .select("id, name, default_currency, default_units, default_timezone")
    .eq("id", loc.organization_id)
    .single();
  const org = orgData
    ? ({
        id: orgData.id as string,
        name: orgData.name as string,
        default_currency: (orgData.default_currency as string) ?? "USD",
        default_units:
          (orgData.default_units as Units) ?? "metric",
        default_timezone: (orgData.default_timezone as string) ?? "UTC",
      } satisfies OrgRow)
    : null;

  const resolved = resolveLocationSettings(
    {
      currency_override: loc.currency_override,
      units_override: loc.units_override,
      timezone: loc.timezone,
    },
    org,
  );

  return (
    <div className="flex flex-col gap-4 py-2">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">General</h1>
        <p className="text-xs text-muted-foreground">
          Identity, modules, areas, and the inherited settings stack.
        </p>
      </header>

      <section className="ring-1 ring-foreground/10 p-4 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-[10rem_1fr]">
        <div className="text-muted-foreground">Name</div>
        <div className="font-medium">{loc.name}</div>

        <div className="text-muted-foreground">Short code</div>
        <div className="font-mono">{loc.short_code}</div>

        <div className="text-muted-foreground">Farm type</div>
        <div>{FarmTypeView[loc.farm_type] ?? loc.farm_type}</div>

        <div className="text-muted-foreground">Status</div>
        <div className="capitalize">{loc.status}</div>

        <div className="text-muted-foreground">Country / state / city</div>
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
      </section>

      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <header className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium">Inherited settings</h2>
          <p className="text-xs text-muted-foreground">
            ORG default → LOC override. Set on this location to override
            {org ? ` ${org.name}` : " the organization"}'s defaults.
          </p>
        </header>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-[10rem_1fr_auto]">
          <dt className="text-muted-foreground">Currency</dt>
          <dd className="font-mono">{resolved.currency.value}</dd>
          <dd>
            <SourceBadge source={resolved.currency.source} />
          </dd>

          <dt className="text-muted-foreground">Units</dt>
          <dd className="capitalize">{resolved.units.value}</dd>
          <dd>
            <SourceBadge source={resolved.units.source} />
          </dd>

          <dt className="text-muted-foreground">Timezone</dt>
          <dd>{resolved.timezone.value}</dd>
          <dd>
            <SourceBadge source={resolved.timezone.source} />
          </dd>
        </dl>
      </section>

      <p className="text-xs text-muted-foreground">
        Edit these fields from the{" "}
        <Link
          href="/settings/locations"
          className="underline underline-offset-2"
        >
          Locations list
        </Link>
        . Inline editing arrives in a follow-up PR.
      </p>
    </div>
  );
}
