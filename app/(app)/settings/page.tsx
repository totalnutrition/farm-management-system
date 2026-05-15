import { redirect } from "next/navigation";
import {
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { firstSettingsHrefForRole } from "@/lib/settings-registry";
import { getActiveLocation } from "@/lib/locations";

export const dynamic = "force-dynamic";

export default async function SettingsIndexPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const role = getRoleFromUser(user);

  // Default landing: the active location's General settings — that's
  // where farm staff actually want to land. Falls back to the role's
  // first settings item if no location is selected.
  const active = await getActiveLocation();
  if (active) {
    redirect(`/settings/locations/${active.id}/general`);
  }
  redirect(firstSettingsHrefForRole(role));
}
