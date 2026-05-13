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
import { DairyReproductionForm } from "../../dairy-reproduction-form";

export const metadata = { title: "Location · Reproduction" };
export const dynamic = "force-dynamic";

export default async function LocationReproductionPage({
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
        title="Reproduction"
        description="Reproductive defaults apply to livestock locations."
      />
    );
  }

  const settings = await getDairySettings(id);

  return (
    <div className="flex flex-col gap-4 py-2">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Reproduction</h1>
        <p className="text-xs text-muted-foreground">
          Voluntary waiting period, heat detection, pregnancy-check schedule,
          dry-off and close-up triggers, and reproductive KPI targets. These
          policies drive automatic event suggestions and dashboards.
        </p>
      </header>
      <section className="ring-1 ring-foreground/10 p-4">
        <DairyReproductionForm locationId={id} initial={settings} />
      </section>
      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-2">
        <h2 className="text-sm font-medium">Synchronization protocols</h2>
        <p className="text-xs text-muted-foreground">
          Library of named hormone protocols (OvSynch, Double-Ov,
          Presynch-OvSynch, custom) with day sequences. Coming next — for
          now record sync protocol on each breeding event manually.
        </p>
      </section>
    </div>
  );
}
