import { requireAnyRole } from "@/lib/supabase-auth";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAnyRole(["super_admin", "admin"]);
  return <>{children}</>;
}
