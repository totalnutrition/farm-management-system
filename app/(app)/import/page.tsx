import Link from "next/link";
import { requireAnyRole } from "@/lib/supabase-auth";
import { ImportClient } from "./import-client";

export const metadata = { title: "Bulk Import" };
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireAnyRole(["super_admin", "admin"]);
  return (
    <div className="flex flex-col gap-4 py-4">
      <Link
        href="/records"
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        ← Herd
      </Link>
      <header>
        <h1 className="font-heading text-lg font-medium">Bulk Import</h1>
        <p className="text-xs text-muted-foreground">
          Onboard a herd or load milkings from CSV. Upload a file (or
          paste) — columns are verified and previewed before anything
          is written.
        </p>
      </header>
      <ImportClient />
    </div>
  );
}
