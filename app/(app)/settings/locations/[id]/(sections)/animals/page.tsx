import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import { ComingSoon } from "@/components/coming-soon";
import { listAnimals } from "../../animals-actions";
import { listPens } from "../../pens-actions";
import { getGroups } from "../../groups-actions";
import { AnimalsTable } from "../../animals-table";

export const metadata = { title: "Location · Animals" };
export const dynamic = "force-dynamic";

const STATUS_VALUES = ["active", "sold", "dead", "culled", "reference"] as const;

export default async function AnimalsListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const { status } = await searchParams;
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
        title="Animals"
        description="Animals apply to locations that manage livestock."
        note="Enable the Livestock module from Locations → Edit."
      />
    );
  }

  const validStatus = status && STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number])
    ? (status as string)
    : null;

  const [rows, pens, groups, breeds, statusCountsRaw] = await Promise.all([
    listAnimals(id, validStatus),
    listPens(id),
    getGroups(id),
    admin
      .from("breeds_catalog")
      .select("code, name")
      .order("display_order")
      .then(({ data }) => (data ?? []) as { code: string; name: string }[]),
    admin
      .from("animals")
      .select("status")
      .eq("location_id", id)
      .then(({ data }) => (data ?? []) as { status: string }[]),
  ]);

  const totalsByStatus: Record<string, number> = {};
  for (const r of statusCountsRaw) {
    totalsByStatus[r.status] = (totalsByStatus[r.status] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Animals</h1>
        <p className="text-xs text-muted-foreground">
          Roster of animals at this location. Identity + current pen/group.
          Event timelines live on the animal&apos;s detail page.
        </p>
      </header>
      <AnimalsTable
        locationId={id}
        rows={rows}
        pens={pens.map((p) => ({ id: p.id, name: p.name }))}
        groups={groups.map((g) => ({ id: g.id, label: g.label }))}
        breeds={breeds}
        statusFilter={validStatus}
        totalsByStatus={totalsByStatus}
      />
    </div>
  );
}
