import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import { loadPlaybook } from "@/lib/playbook";
import { KpisClient } from "./kpis-client";

export const metadata = { title: "Location · KPIs & targets" };
export const dynamic = "force-dynamic";

export default async function LocationKpisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAnyRole(["super_admin", "admin"]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  const admin = createAdminClient();
  const { data: location } = await admin
    .from("locations")
    .select("id, name, organization_id")
    .eq("id", id)
    .maybeSingle();
  if (!location) notFound();
  if (role !== RoleSuperAdmin && location.organization_id !== orgId) {
    notFound();
  }

  const playbook = await loadPlaybook(id);

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">KPIs &amp; targets</h1>
        <p className="text-xs text-muted-foreground">
          {location.name as string} · the single source of truth for every
          threshold and target on this farm — stocking density, bunk space,
          21-day pregnancy rate, conception rate, SCC ceiling, DMI, refusal,
          days-open. The Hot list and the rule engines read these on every
          page load. Blank a field to fall back to the shipped default.
        </p>
      </header>
      <KpisClient locationId={id} playbook={playbook} />
    </div>
  );
}
