import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import { UsersTable, type AdminRow } from "./users-table";

export const metadata = { title: "User Management" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  const admin = createAdminClient();
  let query = admin
    .from("profiles")
    .select(
      "id, email, full_name, role, is_active, created_at, organization_id, organizations(name)",
    )
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
    query = query.eq("organization_id", orgId);
  }

  const { data, error } = await query;

  const rows: AdminRow[] = (data ?? []).map((r) => {
    const orgs = r.organizations as
      | { name: string }
      | { name: string }[]
      | null;
    const organization_name = Array.isArray(orgs)
      ? orgs[0]?.name ?? null
      : orgs?.name ?? null;
    return {
      id: r.id,
      email: r.email,
      full_name: r.full_name,
      role: r.role,
      is_active: r.is_active,
      organization_id: r.organization_id,
      organization_name,
    };
  });

  const canManage = role === RoleSuperAdmin;

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">User Management</h1>
        <p className="text-xs text-muted-foreground">
          {canManage
            ? "Create and manage Admin users (one per client organization)."
            : "Users in your organization."}
        </p>
      </header>
      {error ? (
        <p className="text-xs text-destructive">{error.message}</p>
      ) : null}
      <UsersTable
        users={rows}
        currentUserId={user.id}
        canManage={canManage}
      />
    </div>
  );
}
