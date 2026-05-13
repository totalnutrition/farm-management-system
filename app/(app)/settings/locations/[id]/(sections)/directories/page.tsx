import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import { listDirectory } from "../../directory-actions";
import { DirectoryClient } from "../../directory-client";

export const metadata = { title: "Location · Directories" };
export const dynamic = "force-dynamic";

export default async function DirectoriesPage({
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

  const rows = await listDirectory(id);

  return (
    <div className="flex flex-col gap-4 py-2">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Directories</h1>
        <p className="text-xs text-muted-foreground">
          People referenced by events at this location: technicians,
          veterinarians, hoof trimmers, nutritionists, inseminators,
          consultants. Future events will FK into this list.
        </p>
      </header>
      <DirectoryClient locationId={id} rows={rows} />
    </div>
  );
}
