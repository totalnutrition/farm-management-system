import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";
import type { LocationKind } from "@/lib/types";
import { LocationsTable, type LocationRow } from "./locations-table";

export const metadata = { title: "Locations" };
export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  const admin = createAdminClient();
  let query = admin
    .from("locations")
    .select("id, name, kind, address, is_active, created_at")
    .order("created_at", { ascending: true });

  if (role !== RoleSuperAdmin) {
    if (!orgId) {
      return (
        <p className="p-4 text-xs text-destructive">
          Your account is not linked to an organization. Contact your super
          admin.
        </p>
      );
    }
    query = query.eq("organization_id", orgId);
  }

  const { data, error } = await query;

  const rows: LocationRow[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind as LocationKind,
    address: r.address,
    is_active: r.is_active,
  }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Locations</h1>
        <p className="text-xs text-muted-foreground">
          Each location is a farm site. It holds its own land, barns, animals,
          and inventory. Resources can later be transferred between locations.
        </p>
      </header>
      {error ? (
        <p className="text-xs text-destructive">{error.message}</p>
      ) : null}
      <LocationsTable rows={rows} canManage />
    </div>
  );
}
