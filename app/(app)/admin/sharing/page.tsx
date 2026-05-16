import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { SharingClient, type ShareRow } from "./sharing-client";

export const metadata = { title: "External Access" };
export const dynamic = "force-dynamic";

export default async function SharingPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );

  const admin = createAdminClient();
  const { data } = await admin
    .from("org_shares")
    .select("id, email, role, scope")
    .eq("organization_id", orgId)
    .order("email");

  const rows: ShareRow[] = (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    scope: r.scope,
  }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">
          External Access
        </h1>
        <p className="text-xs text-muted-foreground">
          Grant your vet / nutritionist scoped access to this farm. You
          own the data and control who sees it.
        </p>
      </header>
      <SharingClient rows={rows} />
    </div>
  );
}
