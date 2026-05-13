import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import { ComingSoon } from "@/components/coming-soon";
import { getDairySettings } from "../../dairy-settings-actions";
import { DairyBulkTankForm } from "../../dairy-bulk-tank-form";

export const metadata = { title: "Location · Bulk-tank settings" };
export const dynamic = "force-dynamic";

export default async function LocationBulkTankSettingsPage({
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
        title="Bulk-tank settings"
        description="Bulk-tank configuration applies to livestock locations."
      />
    );
  }

  const settings = await getDairySettings(id);

  return (
    <div className="flex flex-col gap-4 py-2">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Bulk-tank settings</h1>
        <p className="text-xs text-muted-foreground">
          Reconciliation alert threshold and pickup cadence. Day-to-day
          readings live under <strong>Bulk tank</strong> in the left sidebar.
        </p>
      </header>
      <section className="ring-1 ring-foreground/10 p-4">
        <DairyBulkTankForm locationId={id} initial={settings} />
      </section>
    </div>
  );
}
