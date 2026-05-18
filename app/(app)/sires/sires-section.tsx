import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { SiresClient, type SireRow } from "./sires-client";

export async function SiresSection() {
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
    .from("subjects")
    .select("id, natural_key, attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "sire")
    .order("natural_key");
  const rows: SireRow[] = (data ?? []).map((s) => {
    const a = (s.attrs ?? {}) as Record<string, unknown>;
    return {
      id: s.id,
      naab: s.natural_key,
      breed: typeof a.breed === "string" ? a.breed : null,
      semenType:
        typeof a.semen_type === "string" ? a.semen_type : "conventional",
      straws: typeof a.straws === "number" ? a.straws : 0,
    };
  });

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">
          Sires &amp; Semen
        </h1>
        <p className="text-xs text-muted-foreground">
          Sire catalog and straw inventory. Service sire on BRED
          references these.
        </p>
      </header>
      <SiresClient rows={rows} />
    </div>
  );
}
