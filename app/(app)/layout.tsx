import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { LocationSwitcher } from "@/components/location-switcher";
import { createClient } from "@/lib/supabase-server";
import { PathLogin } from "@/lib/misc";
import {
  getActiveLocation,
  listAccessibleLocations,
} from "@/lib/locations";
import type { UserRole } from "@/lib/supabase-auth";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(PathLogin);
  }

  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;
  const role = (user.app_metadata?.role as UserRole | undefined) ?? null;

  const [locations, active] = await Promise.all([
    listAccessibleLocations(),
    getActiveLocation(),
  ]);

  // Sidebar starts collapsed to icon-only; cookie persists user choice
  // after they toggle it.
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get("sidebar_state")?.value;
  const sidebarDefaultOpen = sidebarCookie === "true";

  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen}>
      <TooltipProvider>
        <AppSidebar user={{ email: user.email ?? "", name, role }} />
        <main className="w-full">
          <div className="flex items-center justify-between gap-2 border-b px-2 py-1">
            <SidebarTrigger />
            <LocationSwitcher
              locations={locations.map((l) => ({
                id: l.id,
                name: l.name,
                short_code: l.short_code,
              }))}
              activeId={active?.id ?? null}
            />
          </div>
          <section className="px-2">{children}</section>
        </main>
      </TooltipProvider>
      <Toaster position="top-center" />
    </SidebarProvider>
  );
}
