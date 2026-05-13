import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import {
  RoleSuperAdmin,
  SetupStepDone,
  SetupStepIdentity,
  pathLocationDetail,
  pathLocationSetupStep,
  type SetupStep,
} from "@/lib/misc";

export const dynamic = "force-dynamic";

export default async function SetupIndex({
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
    .select("id, organization_id, setup_step")
    .eq("id", id)
    .single();

  if (!data) notFound();
  if (role !== RoleSuperAdmin && data.organization_id !== orgId) notFound();

  if (data.setup_step === SetupStepDone) {
    redirect(pathLocationDetail(id));
  }

  // Resume at the saved step, or start at identity.
  const step = (data.setup_step as SetupStep) ?? SetupStepIdentity;
  redirect(pathLocationSetupStep(id, step));
}
