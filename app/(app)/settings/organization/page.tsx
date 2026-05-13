import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import {
  OrganizationsTable,
  type OrganizationRow,
} from "./organizations-table";

export const metadata = { title: "Organizations" };
export const dynamic = "force-dynamic";

export default async function OrganizationsPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  const admin = createAdminClient();
  let query = admin
    .from("organizations")
    .select("id, name, address, created_at")
    .order("created_at", { ascending: false });

  if (role !== RoleSuperAdmin) {
    if (!orgId) {
      return (
        <p className="p-4 text-xs text-destructive">
          Your account is not linked to an organization. Contact your super
          admin.
        </p>
      );
    }
    query = query.eq("id", orgId);
  }

  const { data, error } = await query;

  const rows: OrganizationRow[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
  }));

  const canManage = role === RoleSuperAdmin;

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Organizations</h1>
        <p className="text-xs text-muted-foreground">
          {canManage
            ? "Create and manage client organizations."
            : "Your organization."}
        </p>
      </header>
      {error ? (
        <p className="text-xs text-destructive">{error.message}</p>
      ) : null}
      <OrganizationsTable rows={rows} canManage={canManage} canEdit />
    </div>
  );
}
