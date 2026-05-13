import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import { ComingSoon } from "@/components/coming-soon";
import {
  listDiversions,
  listTankReadings,
} from "../../bulk-tank-actions";
import { BulkTankClient } from "../../bulk-tank-client";

export const metadata = { title: "Location · Bulk tank" };
export const dynamic = "force-dynamic";

export default async function BulkTankPage({
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
        title="Bulk tank"
        description="Bulk tank tracking applies to locations that manage livestock."
        note="Enable the Livestock module from Locations → Edit."
      />
    );
  }

  const [readings, diversions] = await Promise.all([
    listTankReadings(id),
    listDiversions(id),
  ]);

  return (
    <div className="flex flex-col gap-4 py-2">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Bulk tank</h1>
        <p className="text-xs text-muted-foreground">
          Daily readings and milk diversions. Full reconciliation against
          per-cow milkings ships when daily entry forms land (PR-N).
        </p>
      </header>
      <BulkTankClient locationId={id} readings={readings} diversions={diversions} />
    </div>
  );
}
