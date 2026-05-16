import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );

  const admin = createAdminClient();
  const { data } = await admin
    .from("org_settings")
    .select("unit_system, country, params")
    .eq("organization_id", orgId)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Settings</h1>
        <p className="text-xs text-muted-foreground">
          Units, region, and herd assumptions. Data is stored
          canonically (metric); units only change display & entry.
        </p>
      </header>
      <SettingsClient
        unitSystem={(data?.unit_system as "metric" | "imperial") ?? "metric"}
        country={(data?.country as string) ?? "XX"}
        params={(data?.params as Record<string, number>) ?? {}}
      />
    </div>
  );
}
