import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import {
  RecipesClient,
  type RecipeRow,
  type LineRow,
  type FeedOpt,
  type GroupOpt,
} from "./recipes-client";

export const metadata = { title: "Recipes" };
export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const active = await getActiveLocation();
  if (!active) {
    return <NoLocationSelected title="No location selected" hint="Recipes are scoped to the active location." />;
  }

  const admin = createAdminClient();

  type Recipe = {
    id: string;
    name: string;
    description: string | null;
    target_dm_intake_kg: number | null;
    target_cows: number | null;
    is_active: boolean;
  };
  type Line = {
    id: string;
    recipe_id: string;
    feed_material_id: string | null;
    display_name: string;
    as_fed_kg_per_cow: number;
    display_order: number;
  };
  type Assignment = { recipe_id: string; group_id: string };

  let recipeRows: Recipe[] = [];
  let lineRows: Line[] = [];
  let assignmentRows: Assignment[] = [];
  try {
    const [recipes, , groups] = await Promise.all([
      admin
        .from("tmr_recipes")
        .select("id, name, description, target_dm_intake_kg, target_cows, is_active")
        .eq("location_id", active.id)
        .order("is_active", { ascending: false })
        .order("name"),
      admin.from("tmr_recipe_lines").select("id"),
      admin.from("tmr_group_assignments").select("recipe_id, group_id"),
    ]);
    recipeRows = (recipes.data ?? []) as Recipe[];
    if (recipeRows.length > 0) {
      const ids = recipeRows.map((r) => r.id);
      const { data: lines } = await admin
        .from("tmr_recipe_lines")
        .select("id, recipe_id, feed_material_id, display_name, as_fed_kg_per_cow, display_order")
        .in("recipe_id", ids)
        .order("display_order");
      lineRows = (lines ?? []) as Line[];
      const { data: asn } = await admin
        .from("tmr_group_assignments")
        .select("recipe_id, group_id")
        .in("recipe_id", ids);
      assignmentRows = (asn ?? []) as Assignment[];
    }
    void groups;
  } catch {
    // tmr tables may not be migrated yet — fall through with empties.
  }

  const [feedRows, groupRows] = await Promise.all([
    admin
      .from("org_feed_materials")
      .select("id, name, dm_pct, ne_l_mcal_per_kg, cp_pct, ndf_pct, starch_pct")
      .order("name")
      .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
    admin
      .from("location_groups")
      .select("id, label")
      .eq("location_id", active.id)
      .order("display_order")
      .then(({ data }) => (data ?? []) as { id: string; label: string }[]),
  ]);

  const feedById = new Map(
    feedRows.map((f) => [
      f.id as string,
      {
        dm_pct: (f.dm_pct as number | null) ?? null,
        ne_l_mcal_per_kg: (f.ne_l_mcal_per_kg as number | null) ?? null,
        cp_pct: (f.cp_pct as number | null) ?? null,
        ndf_pct: (f.ndf_pct as number | null) ?? null,
        starch_pct: (f.starch_pct as number | null) ?? null,
      },
    ] as const),
  );

  const linesByRecipe = new Map<string, LineRow[]>();
  for (const l of lineRows) {
    const ref = l.feed_material_id ? feedById.get(l.feed_material_id) : null;
    const enriched: LineRow = {
      id: l.id,
      recipe_id: l.recipe_id,
      feed_material_id: l.feed_material_id,
      display_name: l.display_name,
      as_fed_kg_per_cow: Number(l.as_fed_kg_per_cow ?? 0),
      display_order: l.display_order,
      dm_pct: ref?.dm_pct ?? null,
      ne_l_mcal_per_kg: ref?.ne_l_mcal_per_kg ?? null,
      cp_pct: ref?.cp_pct ?? null,
      ndf_pct: ref?.ndf_pct ?? null,
      starch_pct: ref?.starch_pct ?? null,
    };
    (linesByRecipe.get(l.recipe_id) ?? linesByRecipe.set(l.recipe_id, []).get(l.recipe_id))!.push(enriched);
  }

  const groupIdsByRecipe = new Map<string, string[]>();
  for (const a of assignmentRows) {
    const arr = groupIdsByRecipe.get(a.recipe_id) ?? [];
    arr.push(a.group_id);
    groupIdsByRecipe.set(a.recipe_id, arr);
  }

  const recipes: RecipeRow[] = recipeRows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    target_dm_intake_kg: r.target_dm_intake_kg !== null && r.target_dm_intake_kg !== undefined
      ? Number(r.target_dm_intake_kg)
      : null,
    target_cows: r.target_cows,
    is_active: r.is_active,
    lines: linesByRecipe.get(r.id) ?? [],
    group_ids: groupIdsByRecipe.get(r.id) ?? [],
  }));

  const feeds: FeedOpt[] = feedRows.map((f) => ({
    id: f.id as string,
    name: f.name as string,
    dm_pct: (f.dm_pct as number | null) ?? null,
    ne_l_mcal_per_kg: (f.ne_l_mcal_per_kg as number | null) ?? null,
    cp_pct: (f.cp_pct as number | null) ?? null,
    ndf_pct: (f.ndf_pct as number | null) ?? null,
    starch_pct: (f.starch_pct as number | null) ?? null,
  }));
  const groups: GroupOpt[] = groupRows.map((g) => ({ id: g.id, label: g.label }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Recipes</h1>
        <p className="text-xs text-muted-foreground">
          {active.name} · TMR recipes with per-ingredient lines, nutrient
          totals (NEL / CP / NDF / Starch on a DM basis), and group
          assignment. Feeding events can reference a recipe so the
          consumed kg are apportioned across its ingredients.
        </p>
      </header>

      <RecipesClient
        locationId={active.id}
        recipes={recipes}
        feeds={feeds}
        groups={groups}
      />
    </div>
  );
}
