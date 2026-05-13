import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import { ComingSoon } from "@/components/coming-soon";
import { getRecordingProfile } from "../../recording-actions";
import { RecordingProfileForm } from "../../recording-form";

export const metadata = { title: "Location · Milk recording setup" };
export const dynamic = "force-dynamic";

export default async function LocationRecordingPage({
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
        title="Milk recording setup"
        description="Milk recording setup applies to locations that manage livestock."
        note="Enable the Livestock module from Locations → Edit to use this section."
      />
    );
  }

  const profile = await getRecordingProfile(id);

  return (
    <div className="flex flex-col gap-4 py-2">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Milk recording setup</h1>
        <p className="text-xs text-muted-foreground">
          How milk gets recorded at this location. Drives which entry UIs
          appear and what cardinality downstream events expect. Day-to-day
          recording entry lives under <strong>Milk recording</strong> in
          the left sidebar.
        </p>
      </header>
      <section className="ring-1 ring-foreground/10 p-4">
        <RecordingProfileForm
          locationId={id}
          initial={profile}
          mode="standalone"
        />
      </section>
    </div>
  );
}
