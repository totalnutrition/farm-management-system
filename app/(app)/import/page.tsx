import { requireAnyRole } from "@/lib/supabase-auth";
import { ImportClient } from "./import-client";

export const metadata = { title: "Bulk Import" };
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireAnyRole(["super_admin", "admin"]);
  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Bulk Import</h1>
        <p className="text-xs text-muted-foreground">
          Onboard a herd or load milkings from CSV. Download a template,
          fill it, paste it back.
        </p>
      </header>
      <ImportClient />
    </div>
  );
}
