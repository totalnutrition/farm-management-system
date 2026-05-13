import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";
import { getCapacityDefaultsForOrg } from "./actions";
import { CapacityDefaultsForm } from "./capacity-defaults-form";

export const metadata = { title: "Organization · Presets" };
export const dynamic = "force-dynamic";

type GroupStrategyPreset = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  recommended_min_lactating: number | null;
  recommended_max_lactating: number | null;
  groups: {
    id: string;
    group_slug: string;
    group_label: string;
    group_class: string;
    display_order: number;
  }[];
};

type PricingTemplate = {
  id: string;
  slug: string;
  name: string;
  country_code: string | null;
  currency: string;
  base_unit: string;
  correction_method: string;
  description: string | null;
};

const CorrectionMethodView: Record<string, string> = {
  raw: "Raw",
  "fcm_3.5": "FCM 3.5%",
  fcm_4: "FCM 4.0%",
  ecm_nrc: "ECM (NRC)",
  ecm_tr: "ECM (Tyrrell-Reid)",
  ms: "Milksolids",
  ts: "Total Solids",
  fat_corrected: "Fat-corrected",
  snf_corrected: "SNF-corrected",
  custom: "Custom",
};

function recommendedHerdRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return "Any herd size";
  if (max === null) return `${min}+ cows`;
  if (min === null || min === 0) return `< ${max + 1} cows`;
  return `${min}–${max} cows`;
}

export default async function OrganizationPresetsPage() {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);
  const canEdit = role === RoleAdmin || role === RoleSuperAdmin;

  const capacity = await getCapacityDefaultsForOrg();

  const admin = createAdminClient();

  const { data: presetRows } = await admin
    .from("org_group_strategy_presets")
    .select(
      "id, slug, name, description, recommended_min_lactating, recommended_max_lactating",
    )
    .or(`organization_id.is.null,organization_id.eq.${orgId ?? "00000000-0000-0000-0000-000000000000"}`)
    .order("recommended_min_lactating", { ascending: true, nullsFirst: true });

  const presetIds = (presetRows ?? []).map((p) => p.id as string);
  const { data: groupRows } =
    presetIds.length > 0
      ? await admin
          .from("org_group_strategy_preset_groups")
          .select(
            "id, preset_id, group_slug, group_label, group_class, display_order",
          )
          .in("preset_id", presetIds)
          .order("display_order", { ascending: true })
      : { data: [] };

  const presets: GroupStrategyPreset[] = (presetRows ?? []).map((p) => ({
    id: p.id as string,
    slug: p.slug as string,
    name: p.name as string,
    description: (p.description as string | null) ?? null,
    recommended_min_lactating: p.recommended_min_lactating as number | null,
    recommended_max_lactating: p.recommended_max_lactating as number | null,
    groups: (groupRows ?? [])
      .filter((g) => (g as { preset_id: string }).preset_id === p.id)
      .map((g) => ({
        id: g.id as string,
        group_slug: g.group_slug as string,
        group_label: g.group_label as string,
        group_class: g.group_class as string,
        display_order: g.display_order as number,
      })),
  }));

  const { data: pricingRows } = await admin
    .from("org_pricing_scheme_templates")
    .select(
      "id, slug, name, country_code, currency, base_unit, correction_method, description",
    )
    .or(`organization_id.is.null,organization_id.eq.${orgId ?? "00000000-0000-0000-0000-000000000000"}`)
    .order("slug", { ascending: true });

  const pricing: PricingTemplate[] = (pricingRows ?? []).map((p) => ({
    id: p.id as string,
    slug: p.slug as string,
    name: p.name as string,
    country_code: (p.country_code as string | null) ?? null,
    currency: p.currency as string,
    base_unit: p.base_unit as string,
    correction_method: p.correction_method as string,
    description: (p.description as string | null) ?? null,
  }));

  return (
    <div className="flex flex-col gap-6 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Presets</h1>
        <p className="text-xs text-muted-foreground">
          Tenant-wide defaults that Locations inherit. Each location can
          override these later.
        </p>
      </header>

      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <header className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium">Capacity-plan defaults</h2>
          <p className="text-xs text-muted-foreground">
            Stocking percentages and bunk-space-per-cow defaults applied to
            new locations.
          </p>
        </header>
        <CapacityDefaultsForm initial={capacity} canEdit={canEdit} />
      </section>

      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <header className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium">Group strategy presets</h2>
          <p className="text-xs text-muted-foreground">
            Bundles of groups + default rules. Locations pick one during
            setup; you can edit and copy these per-org in a future PR.
          </p>
        </header>
        <div className="flex flex-col gap-2">
          {presets.length === 0 ? (
            <p className="text-xs text-muted-foreground">No presets found.</p>
          ) : (
            presets.map((p) => (
              <div
                key={p.id}
                className="ring-1 ring-foreground/10 p-3 flex flex-col gap-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-medium">{p.name}</h3>
                  <span className="text-[10px] text-muted-foreground">
                    {recommendedHerdRange(
                      p.recommended_min_lactating,
                      p.recommended_max_lactating,
                    )}
                  </span>
                </div>
                {p.description ? (
                  <p className="text-xs text-muted-foreground">
                    {p.description}
                  </p>
                ) : null}
                {p.groups.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {p.groups.map((g) => (
                      <span
                        key={g.id}
                        className="text-[10px] font-mono px-1.5 py-0.5 bg-foreground/5 ring-1 ring-foreground/10"
                        title={g.group_class}
                      >
                        {g.group_label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <header className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium">Pricing scheme templates</h2>
          <p className="text-xs text-muted-foreground">
            Country presets. Locations instantiate one and fill in their
            processor's actual base price and component bonuses (PR-L).
          </p>
        </header>
        <div className="flex flex-col gap-2">
          {pricing.length === 0 ? (
            <p className="text-xs text-muted-foreground">No templates found.</p>
          ) : (
            pricing.map((p) => (
              <div
                key={p.id}
                className="ring-1 ring-foreground/10 p-3 flex flex-col gap-1"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-medium">{p.name}</h3>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {p.currency} · {p.base_unit}
                  </span>
                </div>
                {p.description ? (
                  <p className="text-xs text-muted-foreground">
                    {p.description}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.country_code ? (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-foreground/5 ring-1 ring-foreground/10">
                      {p.country_code}
                    </span>
                  ) : null}
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-foreground/5 ring-1 ring-foreground/10">
                    {CorrectionMethodView[p.correction_method] ??
                      p.correction_method}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
