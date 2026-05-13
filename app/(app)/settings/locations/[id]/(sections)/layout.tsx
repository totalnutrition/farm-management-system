import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import {
  LocationSectionGroupLabels,
  LocationSectionGroupOrder,
  pathForLocationSection,
  relevantLocationSections,
} from "@/lib/location-sections";
import { SectionSubnav } from "@/components/section-subnav";
import { BackToSettingsLink } from "../../../settings-shell";

export const dynamic = "force-dynamic";

export default async function LocationSectionsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAnyRole(["super_admin", "admin"]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  const admin = createAdminClient();
  const { data } = await admin
    .from("locations")
    .select("id, organization_id, name, short_code, manages_livestock, manages_crops")
    .eq("id", id)
    .single();

  if (!data) notFound();
  if (role !== RoleSuperAdmin && data.organization_id !== orgId) notFound();

  const sections = relevantLocationSections({
    manages_livestock: data.manages_livestock,
    manages_crops: data.manages_crops,
  });

  const items = sections.map((s) => ({
    href: pathForLocationSection(id, s),
    label: s.label,
    description: s.description,
    icon: s.icon,
    shipped: s.shipped,
    group: s.group,
  }));

  const navGroups = LocationSectionGroupOrder.map((key) => ({
    key,
    label: LocationSectionGroupLabels[key],
  }));

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[14rem_1fr]">
      <aside className="flex flex-col gap-2">
        <div className="px-2 flex flex-col gap-0.5">
          <BackToSettingsLink />
          <Link
            href="/settings/locations"
            className="text-[10px] uppercase tracking-wide text-muted-foreground hover:underline"
          >
            ← Locations
          </Link>
          <span className="text-xs font-medium mt-1">{data.name}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {data.short_code}
          </span>
        </div>
        <SectionSubnav
          items={items}
          ariaLabel="Location settings"
          groups={navGroups}
        />
      </aside>
      <main className="flex flex-col gap-4">{children}</main>
    </div>
  );
}
