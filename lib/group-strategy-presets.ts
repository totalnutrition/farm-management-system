import { createAdminClient } from "@/lib/supabase-admin";
import type { StrategyPresetCard } from "@/app/(app)/settings/locations/[id]/group-strategy-picker";

/**
 * Loads strategy presets visible to an organization. Returns global
 * seeds (organization_id IS NULL) plus org-specific clones.
 */
export async function loadStrategyPresetCards(
  orgId: string | null,
): Promise<StrategyPresetCard[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("org_group_strategy_presets")
    .select(
      "id, slug, name, description, recommended_min_lactating, recommended_max_lactating, organization_id, is_seed",
    )
    .or(
      `organization_id.is.null,organization_id.eq.${orgId ?? "00000000-0000-0000-0000-000000000000"}`,
    )
    .order("recommended_min_lactating", { ascending: true, nullsFirst: true });

  if (!rows || rows.length === 0) return [];
  const ids = rows.map((r) => r.id as string);
  const { data: groupRows } = await admin
    .from("org_group_strategy_preset_groups")
    .select("preset_id, group_label, display_order")
    .in("preset_id", ids)
    .order("display_order");

  return rows.map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    description: (r.description as string | null) ?? null,
    recommended_min_lactating: r.recommended_min_lactating as number | null,
    recommended_max_lactating: r.recommended_max_lactating as number | null,
    group_labels: (groupRows ?? [])
      .filter((g) => g.preset_id === r.id)
      .map((g) => g.group_label as string),
    is_org_owned: r.organization_id !== null && !r.is_seed,
  }));
}
