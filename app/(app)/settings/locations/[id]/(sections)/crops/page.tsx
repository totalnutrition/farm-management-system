import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import { ComingSoon } from "@/components/coming-soon";
import { listArableParcels } from "../../arable-parcels-actions";
import { listCropPlansForLocation } from "../../crops-actions";
import { CropsClient } from "../../crops-client";

export const metadata = { title: "Location · Crops" };
export const dynamic = "force-dynamic";

export default async function CropsPage({
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
    .select("id, organization_id, manages_crops")
    .eq("id", id)
    .single();
  if (!data) notFound();
  if (role !== RoleSuperAdmin && data.organization_id !== orgId) notFound();
  if (!data.manages_crops) {
    return (
      <ComingSoon
        title="Crops"
        description="Crops apply to locations that manage arable land."
        note="Enable the Crops module from Locations → Edit."
      />
    );
  }

  const [parcels, plans] = await Promise.all([
    listArableParcels(id),
    listCropPlansForLocation(id),
  ]);

  return (
    <div className="flex flex-col gap-4 py-2">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Crops</h1>
        <p className="text-xs text-muted-foreground">
          Crop plans tied to arable parcels. Log events as the season
          progresses — planting, irrigation, fertilization, spray, scouting,
          harvest.
        </p>
      </header>
      <CropsClient
        parcels={parcels.map((p) => ({
          id: p.id,
          name: p.name,
          area_hectares: p.area_hectares,
        }))}
        plans={plans}
      />
    </div>
  );
}
