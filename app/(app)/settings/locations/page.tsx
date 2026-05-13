import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import { LocationsTable, type LocationRow } from "./locations-table";

export const metadata = { title: "Locations" };
export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  const admin = createAdminClient();
  let query = admin
    .from("locations")
    // Use `*` so the page keeps loading even on databases where the
    // newer override columns (0017/0018) haven't been applied yet.
    // Missing columns simply come back as undefined.
    .select("*")
    .order("name");

  if (role !== RoleSuperAdmin) {
    if (!orgId) {
      return (
        <p className="p-4 text-xs text-destructive">
          Your account is not linked to an organization. Contact your admin.
        </p>
      );
    }
    query = query.eq("organization_id", orgId);
  }

  const { data, error } = await query;
  const rows = (data ?? []) as LocationRow[];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-medium">Locations</h2>
        <p className="text-xs text-muted-foreground">
          Farms and sites under this organization. Animals and stock can move
          between locations.
        </p>
      </header>
      {error ? (
        <p className="text-xs text-destructive">{error.message}</p>
      ) : null}
      <LocationsTable rows={rows} />
    </div>
  );
}
