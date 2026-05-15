import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import { SiresTable, type SireRow, type BreedOption } from "./sires-table";

export const metadata = { title: "Organization · Sires" };
export const dynamic = "force-dynamic";

export default async function OrganizationSiresPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  const admin = createAdminClient();

  // Visible sires: org's own + seed/global rows (organization_id is null).
  const [{ data: sireData }, { data: breedData }, { data: strawCount }] =
    await Promise.all([
      admin
        .from("sires")
        .select(
          "id, naab, registered_name, short_name, breed_code, status, country_of_origin, owner_company, ptam_milk_kg, ptam_fat_kg, ptam_protein_kg, ptam_scs, ptam_dpr, ptam_calving_ease_pct, ptam_productive_life, net_merit, photo_url, notes, is_seed, organization_id",
        )
        .or(
          role === RoleSuperAdmin || !orgId
            ? "organization_id.is.null"
            : `organization_id.is.null,organization_id.eq.${orgId}`,
        )
        .order("registered_name"),
      admin
        .from("breeds_catalog")
        .select("code, name")
        .order("display_order"),
      admin
        .from("semen_straws")
        .select("sire_id, id")
        .not("sire_id", "is", null),
    ]);

  const sires = (sireData ?? []) as SireRow[];
  const breeds = (breedData ?? []) as BreedOption[];
  const strawCounts = new Map<string, number>();
  for (const r of (strawCount ?? []) as Array<{ sire_id: string | null }>) {
    if (!r.sire_id) continue;
    strawCounts.set(r.sire_id, (strawCounts.get(r.sire_id) ?? 0) + 1);
  }
  const sireRowsWithStraws = sires.map((s) => ({
    ...s,
    straw_batches: strawCounts.get(s.id) ?? 0,
  }));
  const ownerOrg = orgId ?? null;
  const isSuperAdmin = role === RoleSuperAdmin;

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Bulls · Sires catalog</h1>
        <p className="text-xs text-muted-foreground">
          Master list of AI bulls used across your locations. NAAB codes,
          breed, transmitted-trait values and ownership. Semen-straw
          inventory batches at each location reference this catalog.
        </p>
      </header>
      <SiresTable
        rows={sireRowsWithStraws}
        breeds={breeds}
        canEdit={isSuperAdmin || !!ownerOrg}
        ownerOrgId={ownerOrg}
      />
    </div>
  );
}
