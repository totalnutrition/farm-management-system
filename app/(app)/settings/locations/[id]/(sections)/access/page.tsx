import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import {
  listLocationAccess,
  listOrgUsers,
} from "../../access-actions";
import { AccessClient } from "../../access-client";

export const metadata = { title: "Location · Access" };
export const dynamic = "force-dynamic";

export default async function LocationAccessPage({
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
    .select("id, organization_id")
    .eq("id", id)
    .single();
  if (!data) notFound();
  if (role !== RoleSuperAdmin && data.organization_id !== orgId) notFound();

  const [rows, orgUsers] = await Promise.all([
    listLocationAccess(id),
    listOrgUsers(id),
  ]);

  return (
    <div className="flex flex-col gap-4 py-2">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Access</h1>
        <p className="text-xs text-muted-foreground">
          Users who can access this location and their per-section
          permissions. Org admins always have full access — only grant
          rows for non-admin members.
        </p>
      </header>
      <AccessClient locationId={id} rows={rows} orgUsers={orgUsers} />
    </div>
  );
}
