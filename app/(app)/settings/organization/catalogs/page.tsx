import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import {
  AddFeedMaterialButton,
  AddVetMedicineButton,
  AddReproProtocolButton,
  AddVaccinationProtocolButton,
  AddTreatmentProtocolButton,
  FeedMaterialActions,
  VetMedicineActions,
  ReproProtocolActions,
  VaccinationProtocolActions,
  TreatmentProtocolActions,
  type FeedRow,
  type VetRow,
  type ReproRow,
  type VaxRow,
  type TxRow,
} from "./catalog-forms";

export const metadata = { title: "Organization · Catalogs" };
export const dynamic = "force-dynamic";

async function loadCatalog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  table: string,
  orderBy: string,
  cols: string,
  orgIdOrAny: string,
): Promise<Record<string, unknown>[]> {
  try {
    const { data, error } = await admin
      .from(table)
      .select(cols)
      .or(`organization_id.is.null,organization_id.eq.${orgIdOrAny}`)
      .order(orderBy);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function OrganizationCatalogsPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);
  const orgIdOrAny =
    role === RoleSuperAdmin || !orgId
      ? "00000000-0000-0000-0000-000000000000"
      : orgId;

  const admin = createAdminClient();

  const [breeds, diagnoses, routes, cull, repro, vax, treatments, feed, vet] = await Promise.all([
    admin.from("breeds_catalog").select("*").order("display_order").then(({ data }: { data: Record<string, unknown>[] | null }) => data ?? []),
    admin.from("diagnoses_catalog").select("*").order("display_order").then(({ data }: { data: Record<string, unknown>[] | null }) => data ?? []),
    admin.from("routes_catalog").select("*").order("display_order").then(({ data }: { data: Record<string, unknown>[] | null }) => data ?? []),
    admin.from("cull_reasons_catalog").select("*").order("display_order").then(({ data }: { data: Record<string, unknown>[] | null }) => data ?? []),
    loadCatalog(admin, "org_repro_protocols", "name", "id, slug, name, description, protocol_type, is_seed", orgIdOrAny),
    loadCatalog(admin, "org_vaccination_protocols", "name", "id, slug, name, target_class, description, is_seed", orgIdOrAny),
    loadCatalog(admin, "org_treatment_protocols", "name", "id, slug, name, diagnosis_code, description, is_seed", orgIdOrAny),
    loadCatalog(admin, "org_feed_materials", "name", "id, name, category, dm_pct, ne_l_mcal_per_kg, cp_pct, ndf_pct, starch_pct, is_seed", orgIdOrAny),
    loadCatalog(admin, "org_vet_medicines", "name", "id, name, brand, active_ingredient, category, route, default_dose, withdrawal_milk_hours, withdrawal_meat_days, is_seed", orgIdOrAny),
  ]);

  return (
    <div className="flex flex-col gap-6 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Catalogs</h1>
        <p className="text-xs text-muted-foreground">
          Tenant-wide reference data. Seed rows ship with the product and stay
          read-only; your own additions can be edited or removed. Locations
          inherit from these.
        </p>
      </header>

      <Section
        title="Reproduction protocols"
        count={repro.length}
        hint="Synchronization, resync, and fixed-time-AI protocols."
        actions={<AddReproProtocolButton />}
      >
        <CatalogTable
          cols={["Name", "Type", "Description", ""]}
          rows={repro.map((r) => [
            <SeedCell key={r.id as string} name={r.name as string} isSeed={r.is_seed as boolean} />,
            (r.protocol_type as string) ?? "—",
            (r.description as string | null) ?? "—",
            <ReproProtocolActions key={`a${r.id}`} row={r as unknown as ReproRow} />,
          ])}
        />
      </Section>

      <Section
        title="Vaccination protocols"
        count={vax.length}
        hint="Per-class vaccination schedules."
        actions={<AddVaccinationProtocolButton />}
      >
        <CatalogTable
          cols={["Name", "Target class", "Description", ""]}
          rows={vax.map((v) => [
            <SeedCell key={v.id as string} name={v.name as string} isSeed={v.is_seed as boolean} />,
            v.target_class as string,
            (v.description as string | null) ?? "—",
            <VaccinationProtocolActions key={`a${v.id}`} row={v as unknown as VaxRow} />,
          ])}
        />
      </Section>

      <Section
        title="Treatment protocols"
        count={treatments.length}
        hint="Drug + dose + route + withdrawal for common diagnoses."
        actions={<AddTreatmentProtocolButton />}
      >
        <CatalogTable
          cols={["Name", "Diagnosis", "Description", ""]}
          rows={treatments.map((t) => [
            <SeedCell key={t.id as string} name={t.name as string} isSeed={t.is_seed as boolean} />,
            (t.diagnosis_code as string | null) ?? "—",
            (t.description as string | null) ?? "—",
            <TreatmentProtocolActions key={`a${t.id}`} row={t as unknown as TxRow} />,
          ])}
        />
      </Section>

      <Section
        title="Feed materials"
        count={feed.length}
        hint="Forages, grains, byproducts, minerals. Powers TMR recipes and feeding events."
        actions={<AddFeedMaterialButton />}
      >
        <CatalogTable
          cols={["Name", "Category", "DM %", "NEL Mcal/kg", "CP %", "NDF %", "Starch %", ""]}
          rows={feed.map((f) => [
            <SeedCell key={f.id as string} name={f.name as string} isSeed={f.is_seed as boolean} />,
            f.category as string,
            num(f.dm_pct),
            num(f.ne_l_mcal_per_kg),
            num(f.cp_pct),
            num(f.ndf_pct),
            num(f.starch_pct),
            <FeedMaterialActions key={`a${f.id}`} row={f as unknown as FeedRow} />,
          ])}
        />
      </Section>

      <Section
        title="Veterinary medicines"
        count={vet.length}
        hint="Drug catalog with default dose, route, and withdrawal periods."
        actions={<AddVetMedicineButton />}
      >
        <CatalogTable
          cols={["Name", "Brand", "Active", "Category", "Route", "Default dose", "Milk WD (h)", "Meat WD (d)", ""]}
          rows={vet.map((v) => [
            <SeedCell key={v.id as string} name={v.name as string} isSeed={v.is_seed as boolean} />,
            (v.brand as string | null) ?? "—",
            (v.active_ingredient as string | null) ?? "—",
            v.category as string,
            (v.route as string | null) ?? "—",
            (v.default_dose as string | null) ?? "—",
            num(v.withdrawal_milk_hours),
            num(v.withdrawal_meat_days),
            <VetMedicineActions key={`a${v.id}`} row={v as unknown as VetRow} />,
          ])}
        />
      </Section>

      <Section title="Breeds" count={breeds.length} hint="Standard breed codes (NAAB Uniform).">
        <CatalogTable cols={["Code", "Name", "Source"]}
          rows={breeds.map((b) => [
            <span key={b.code as string} className="font-mono">{b.code as string}</span>,
            b.name as string,
            (b.source as string | null) ?? "—",
          ])} />
      </Section>

      <Section title="Diagnoses" count={diagnoses.length} hint="ICAR Section 7.1 dairy health code subset.">
        <CatalogTable cols={["Code", "Name", "Category"]}
          rows={diagnoses.map((d) => [
            <span key={d.code as string} className="font-mono">{d.code as string}</span>,
            d.name as string,
            d.category as string,
          ])} />
      </Section>

      <Section title="Routes of administration" count={routes.length}>
        <CatalogTable cols={["Code", "Name"]}
          rows={routes.map((r) => [
            <span key={r.code as string} className="font-mono">{r.code as string}</span>,
            r.name as string,
          ])} />
      </Section>

      <Section title="Cull reasons" count={cull.length} hint="DHIA 9-code + extensions.">
        <CatalogTable cols={["Code", "Name", "Category"]}
          rows={cull.map((c) => [
            <span key={c.code as string} className="font-mono">{c.code as string}</span>,
            c.name as string,
            c.category as string,
          ])} />
      </Section>
    </div>
  );
}

function num(v: unknown): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

function Section({
  title,
  count,
  hint,
  actions,
  children,
}: {
  title: string;
  count: number;
  hint?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium">
            {title}
            <span className="ml-2 text-[10px] font-normal text-muted-foreground">
              {count} item{count === 1 ? "" : "s"}
            </span>
          </h2>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

function CatalogTable({
  cols,
  rows,
}: {
  cols: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="ring-1 ring-foreground/10 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-foreground/5">
          <tr className="text-left">
            {cols.map((c, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length} className="px-3 py-3 text-center text-muted-foreground">
                Empty. Catalog tables may not be migrated yet — apply migration 0019.
              </td>
            </tr>
          ) : (
            rows.map((cells, i) => (
              <tr key={i} className="border-t border-foreground/10">
                {cells.map((cell, j) => (
                  <td key={j} className="px-3 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SeedCell({ name, isSeed }: { name: string; isSeed: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="font-medium">{name}</span>
      {isSeed ? (
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          seed
        </span>
      ) : null}
    </span>
  );
}
