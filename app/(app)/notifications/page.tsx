import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { NotificationsClient, type NotifRow } from "./notifications-client";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
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
    .from("notifications")
    .select("id, category, severity, title, body, link, created_at, read_at")
    .eq("organization_id", orgId)
    .order("read_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(300);

  const rows: NotifRow[] = (data ?? []).map((n) => ({
    id: n.id,
    category: n.category,
    severity: n.severity,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.read_at != null,
  }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Notifications</h1>
        <p className="text-xs text-muted-foreground">
          In-app alerts. Refresh runs a sweep now; scheduled sweeps and
          email/WhatsApp delivery are the next step.
        </p>
      </header>
      <NotificationsClient rows={rows} />
    </div>
  );
}
