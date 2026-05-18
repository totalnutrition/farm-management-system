import { createAdminClient } from "@/lib/supabase-admin";
import {
  requireAnyRole,
  getOrganizationIdFromUser,
} from "@/lib/supabase-auth";
import { EnterClient } from "./enter-client";

export const metadata = { title: "Enter" };
export const dynamic = "force-dynamic";

export default async function EnterPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );

  const admin = createAdminClient();
  const [{ data: animalSubs }, { data: codeRows }, { data: itemRows }] =
    await Promise.all([
      admin
        .from("subjects")
        .select("natural_key")
        .eq("organization_id", orgId)
        .eq("subject_type", "animal")
        .order("natural_key"),
      admin
        .from("event_codes")
        .select("code, name, label")
        .eq("organization_id", orgId)
        .order("code"),
      admin
        .from("subjects")
        .select("natural_key, attrs")
        .eq("organization_id", orgId)
        .eq("subject_type", "supply_item")
        .order("natural_key"),
    ]);

  const animals = (animalSubs ?? []).map((a) => a.natural_key);
  const codes = (codeRows ?? []).map((c) => ({
    code: c.code,
    label: c.label || c.name,
  }));
  const allItems = (itemRows ?? []).map((i) => i.natural_key);
  const vetItems = (itemRows ?? [])
    .filter(
      (i) =>
        (i.attrs as Record<string, unknown>)?.category ===
        "Veterinary Drugs & Vaccines",
    )
    .map((i) => i.natural_key);

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Enter</h1>
        <p className="text-xs text-muted-foreground">
          Fast data entry — one event across many animals, or many
          events for one animal.
        </p>
      </header>
      <EnterClient
        animals={animals}
        codes={codes}
        allItems={allItems}
        vetItems={vetItems}
      />
    </div>
  );
}
