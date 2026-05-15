import { requireAnyRole } from "@/lib/supabase-auth";
import { loadHerd } from "@/lib/herd-data";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set-up" };

export default async function SetupPage() {
  await requireAnyRole(["super_admin", "admin"]);
  const { settings } = await loadHerd();

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Set-up</h1>
        <p className="text-xs text-muted-foreground">
          A small, one-time herd configuration. These values drive every
          worklist and monitor threshold.
        </p>
      </header>
      <SettingsForm settings={settings} />
    </div>
  );
}
