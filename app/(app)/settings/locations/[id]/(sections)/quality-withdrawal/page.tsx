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
import { DairyQualityForm } from "../../dairy-quality-form";

export const metadata = { title: "Location · Quality & withdrawal" };
export const dynamic = "force-dynamic";

export default async function LocationQualityWithdrawalPage({
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
        title="Quality & withdrawal"
        description="Milk quality thresholds and withdrawal policy apply to livestock locations."
      />
    );
  }

  const settings = await getDairySettings(id);

  return (
    <div className="flex flex-col gap-4 py-2">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">
          Quality &amp; withdrawal
        </h1>
        <p className="text-xs text-muted-foreground">
          SCC + component thresholds, milk / meat withdrawal policy, and
          herd-level cull / RHA targets. Drives hospital-pen flags, milk
          diversion warnings, and dashboards.
        </p>
      </header>
      <section className="ring-1 ring-foreground/10 p-4">
        <DairyQualityForm locationId={id} initial={settings} />
      </section>
    </div>
  );
}
