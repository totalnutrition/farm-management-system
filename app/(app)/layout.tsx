import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar, type TopbarLocation } from "@/components/topbar";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { CurrentLocationCookie } from "@/lib/current-location";
import { PathLogin, RoleAdmin, RoleSuperAdmin } from "@/lib/misc";
import type { UserRole } from "@/lib/supabase-auth";
import type { LocationKind } from "@/lib/types";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(PathLogin);
  }

  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;
  const role = (user.app_metadata?.role as UserRole | undefined) ?? null;
  const orgId =
    (user.app_metadata?.organization_id as string | undefined) ?? null;

  let locations: TopbarLocation[] = [];
  if (role === RoleSuperAdmin || orgId) {
    const admin = createAdminClient();
    let q = admin
      .from("locations")
      .select("id, name, kind")
      .order("created_at", { ascending: true });
    if (role !== RoleSuperAdmin && orgId) q = q.eq("organization_id", orgId);
    const { data } = await q;
    locations = (data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      kind: r.kind as LocationKind,
    }));
  }

  const currentLocationId =
    cookieStore.get(CurrentLocationCookie)?.value ?? null;
  const canManageLocations = role === RoleSuperAdmin || role === RoleAdmin;

  return (
    <SidebarProvider>
      <AppSidebar user={{ email: user.email ?? "", name, role }} />
      <TooltipProvider>
        <main className="w-full">
          <Topbar
            locations={locations}
            currentLocationId={currentLocationId}
            canManageLocations={canManageLocations}
          />
          <section className="px-2">{children}</section>
        </main>
      </TooltipProvider>
      <Toaster position="top-center" />
    </SidebarProvider>
  );
}
