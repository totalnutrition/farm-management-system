import {
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { SettingsShell } from "./settings-shell";
import { settingsItemsForRole } from "@/lib/settings-registry";

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const role = getRoleFromUser(user);
  const groups = settingsItemsForRole(role);

  return <SettingsShell groups={groups}>{children}</SettingsShell>;
}
