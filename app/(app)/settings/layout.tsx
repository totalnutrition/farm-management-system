import {
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { SettingsNav } from "./settings-nav";
import { settingsItemsForRole } from "@/lib/settings-registry";

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const role = getRoleFromUser(user);
  const groups = settingsItemsForRole(role);

  return (
    <div className="flex flex-col gap-4 py-4 md:flex-row md:gap-8">
      <aside className="w-full shrink-0 md:w-56">
        <h1 className="px-2 pb-3 font-heading text-lg font-semibold">
          Settings
        </h1>
        <SettingsNav groups={groups} />
      </aside>
      <section className="min-w-0 flex-1">{children}</section>
    </div>
  );
}
