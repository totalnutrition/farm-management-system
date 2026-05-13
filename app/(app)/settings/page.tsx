import { redirect } from "next/navigation";
import {
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { firstSettingsHrefForRole } from "@/lib/settings-registry";

export const dynamic = "force-dynamic";

export default async function SettingsIndexPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const role = getRoleFromUser(user);
  redirect(firstSettingsHrefForRole(role));
}
