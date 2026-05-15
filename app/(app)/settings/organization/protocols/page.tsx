import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import {
  AddReproProtocolButton,
  AddVaccinationProtocolButton,
  AddTreatmentProtocolButton,
  ReproProtocolActions,
  VaccinationProtocolActions,
  TreatmentProtocolActions,
  type ReproRow,
  type VaxRow,
  type TxRow,
} from "../catalogs/catalog-forms";
import {
  AddHoofTrimButton,
  AddDewormingButton,
  AddDryOffButton,
  HoofTrimActions,
  DewormingActions,
  DryOffActions,
  type HoofRow,
  type DewormRow,
  type DryOffRow,
} from "./protocols-forms";

export const metadata = { title: "Organization · Protocols" };
export const dynamic = "force-dynamic";

async function loadCatalog<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  table: string,
  cols: string,
  orderBy: string,
  orgIdOrAny: string,
): Promise<T[]> {
  try {
    const { data, error } = await admin
      .from(table)
      .select(cols)
      .or(`organization_id.is.null,organization_id.eq.${orgIdOrAny}`)
      .order(orderBy);
    if (error) return [];
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

export default async function ProtocolsPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);
  const orgIdOrAny =
    role === RoleSuperAdmin || !orgId
      ? "00000000-0000-0000-0000-000000000000"
      : orgId;

  const admin = createAdminClient();

  const [repro, vax, treatments, hoof, deworm, dryoff] = await Promise.all([
    loadCatalog<ReproRow>(
      admin,
      "org_repro_protocols",
      "id, slug, name, description, protocol_type, is_seed",
      "name",
      orgIdOrAny,
    ),
    loadCatalog<VaxRow>(
      admin,
      "org_vaccination_protocols",
      "id, slug, name, target_class, description, is_seed",
      "name",
      orgIdOrAny,
    ),
    loadCatalog<TxRow>(
      admin,
      "org_treatment_protocols",
      "id, slug, name, diagnosis_code, description, is_seed",
      "name",
      orgIdOrAny,
    ),
    loadCatalog<HoofRow>(
      admin,
      "org_hoof_trim_protocols",
      "id, slug, name, target_class, description, is_seed",
      "name",
      orgIdOrAny,
    ),
    loadCatalog<DewormRow>(
      admin,
      "org_deworming_protocols",
      "id, slug, name, target_class, description, is_seed",
      "name",
      orgIdOrAny,
    ),
    loadCatalog<DryOffRow>(
      admin,
      "org_dry_off_protocols",
      "id, slug, name, approach_days, description, is_seed",
      "name",
      orgIdOrAny,
    ),
  ]);

  return (
    <div className="flex flex-col gap-6 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Protocols</h1>
        <p className="text-xs text-muted-foreground">
          Standard operating procedures and schedules. Each protocol drives
          the Hot list (e.g. &ldquo;vaccinations due&rdquo;) and the action
          calendar. Seed rows ship with the product; your own protocols
          can be edited freely.
        </p>
      </header>

      <Section
        title="Reproduction"
        hint="Synchronization, resync, and fixed-time-AI protocols."
        count={repro.length}
        actions={<AddReproProtocolButton />}
      >
        <ProtocolTable
          cols={["Name", "Type", "Description", ""]}
          rows={repro.map((r) => [
            <SeedCell key={r.id} name={r.name} isSeed={r.is_seed} />,
            r.protocol_type ?? "—",
            r.description ?? "—",
            <ReproProtocolActions key={`a${r.id}`} row={r} />,
          ])}
        />
      </Section>

      <Section
        title="Vaccinations"
        hint="Per-class vaccination schedules — adult annual, pre-breeding heifer, calf series, dry-off mastitis."
        count={vax.length}
        actions={<AddVaccinationProtocolButton />}
      >
        <ProtocolTable
          cols={["Name", "Target class", "Description", ""]}
          rows={vax.map((v) => [
            <SeedCell key={v.id} name={v.name} isSeed={v.is_seed} />,
            v.target_class,
            v.description ?? "—",
            <VaccinationProtocolActions key={`a${v.id}`} row={v} />,
          ])}
        />
      </Section>

      <Section
        title="Treatment"
        hint="Drug + dose + route + withdrawal per common diagnosis."
        count={treatments.length}
        actions={<AddTreatmentProtocolButton />}
      >
        <ProtocolTable
          cols={["Name", "Diagnosis", "Description", ""]}
          rows={treatments.map((t) => [
            <SeedCell key={t.id} name={t.name} isSeed={t.is_seed} />,
            t.diagnosis_code ?? "—",
            t.description ?? "—",
            <TreatmentProtocolActions key={`a${t.id}`} row={t} />,
          ])}
        />
      </Section>

      <Section
        title="Hoof trimming"
        hint="Routine claw work — pre-breeding, mid-lactation, pre-dry-off."
        count={hoof.length}
        actions={<AddHoofTrimButton />}
      >
        <ProtocolTable
          cols={["Name", "Target class", "Description", ""]}
          rows={hoof.map((h) => [
            <SeedCell key={h.id} name={h.name} isSeed={h.is_seed} />,
            h.target_class,
            h.description ?? "—",
            <HoofTrimActions key={`a${h.id}`} row={h} />,
          ])}
        />
      </Section>

      <Section
        title="Deworming"
        hint="Anthelmintic schedules with drug + dose + withdrawal."
        count={deworm.length}
        actions={<AddDewormingButton />}
      >
        <ProtocolTable
          cols={["Name", "Target class", "Description", ""]}
          rows={deworm.map((d) => [
            <SeedCell key={d.id} name={d.name} isSeed={d.is_seed} />,
            d.target_class,
            d.description ?? "—",
            <DewormingActions key={`a${d.id}`} row={d} />,
          ])}
        />
      </Section>

      <Section
        title="Dry-off"
        hint="Dry-cow therapy — antibiotic strategy + sealant + approach window."
        count={dryoff.length}
        actions={<AddDryOffButton />}
      >
        <ProtocolTable
          cols={["Name", "Approach (d)", "Description", ""]}
          rows={dryoff.map((d) => [
            <SeedCell key={d.id} name={d.name} isSeed={d.is_seed} />,
            String(d.approach_days),
            d.description ?? "—",
            <DryOffActions key={`a${d.id}`} row={d} />,
          ])}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  count,
  actions,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="ring-1 ring-foreground/10 flex flex-col">
      <header className="px-3 py-2 bg-foreground/5 flex items-baseline justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium">
            {title}{" "}
            <span className="text-[10px] font-normal text-muted-foreground tabular-nums">
              · {count}
            </span>
          </h2>
          <p className="text-[10px] text-muted-foreground">{hint}</p>
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

function ProtocolTable({
  cols,
  rows,
}: {
  cols: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left bg-foreground/[0.025]">
            {cols.map((c) => (
              <th
                key={c}
                className="px-3 py-1.5 font-medium text-muted-foreground"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={cols.length}
                className="px-3 py-6 text-center text-muted-foreground italic"
              >
                No protocols defined yet.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-t border-foreground/10">
                {r.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5 align-top">
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
    <span className="flex items-center gap-1 font-medium">
      {name}
      {isSeed ? (
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground bg-foreground/5 px-1 rounded">
          seed
        </span>
      ) : null}
    </span>
  );
}
