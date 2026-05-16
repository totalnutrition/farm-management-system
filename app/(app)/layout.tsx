import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { createClient } from "@/lib/supabase-server";
import { PathLogin } from "@/lib/misc";
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

  return (
    <SidebarProvider>
      <AppSidebar user={{ email: user.email ?? "", name, role }} />
      <TooltipProvider>
        <main className="w-full">
          <SidebarTrigger />
          <section className="px-6 py-2">{children}</section>
        </main>
      </TooltipProvider>
      <Toaster position="top-center" />
    </SidebarProvider>
  );
}
