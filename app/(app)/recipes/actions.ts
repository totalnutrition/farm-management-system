"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole } from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";

type Result = { error?: string; success?: boolean; id?: string };

const recipeSchema = z.object({
  id: z.string().uuid().optional(),
  location_id: z.string().uuid(),
  name: z.string().min(1, "Name required.").max(120),
  description: z.string().max(500).nullable().optional(),
  target_dm_intake_kg: z.number().min(0).max(60).nullable().optional(),
  target_cows: z.number().int().min(0).max(50000).nullable().optional(),
  is_active: z.boolean().optional(),
});
export type RecipeInput = z.infer<typeof recipeSchema>;

export async function upsertRecipe(input: RecipeInput): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const row = {
    location_id: parsed.data.location_id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    target_dm_intake_kg: parsed.data.target_dm_intake_kg ?? null,
    target_cows: parsed.data.target_cows ?? null,
    is_active: parsed.data.is_active ?? true,
  };
  const { data, error } = parsed.data.id
    ? await admin.from("tmr_recipes").update(row).eq("id", parsed.data.id).select("id").single()
    : await admin.from("tmr_recipes").insert(row).select("id").single();
  if (error) return { error: error.message };

  revalidatePath("/recipes");
  return { success: true, id: data?.id as string };
}

export async function deleteRecipe(id: string): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const admin = createAdminClient();
  const { error } = await admin.from("tmr_recipes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/recipes");
  return { success: true };
}

const lineSchema = z.object({
  id: z.string().uuid().optional(),
  recipe_id: z.string().uuid(),
  feed_material_id: z.string().uuid().nullable().optional(),
  display_name: z.string().min(1, "Name required.").max(120),
  as_fed_kg_per_cow: z.number().min(0),
  display_order: z.number().int().min(0).optional(),
});
export type LineInput = z.infer<typeof lineSchema>;

export async function upsertLine(input: LineInput): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = lineSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const row = {
    recipe_id: parsed.data.recipe_id,
    feed_material_id: parsed.data.feed_material_id ?? null,
    display_name: parsed.data.display_name,
    as_fed_kg_per_cow: parsed.data.as_fed_kg_per_cow,
    display_order: parsed.data.display_order ?? 0,
  };
  const { error } = parsed.data.id
    ? await admin.from("tmr_recipe_lines").update(row).eq("id", parsed.data.id)
    : await admin.from("tmr_recipe_lines").insert(row);
  if (error) return { error: error.message };

  revalidatePath("/recipes");
  return { success: true };
}

export async function deleteLine(id: string): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const admin = createAdminClient();
  const { error } = await admin.from("tmr_recipe_lines").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/recipes");
  return { success: true };
}

const assignSchema = z.object({
  recipe_id: z.string().uuid(),
  group_id: z.string().uuid(),
  is_primary: z.boolean().optional(),
});

export async function assignRecipeToGroup(input: z.infer<typeof assignSchema>): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const admin = createAdminClient();
  const { error } = await admin.from("tmr_group_assignments").upsert(
    {
      recipe_id: parsed.data.recipe_id,
      group_id: parsed.data.group_id,
      is_primary: parsed.data.is_primary ?? true,
    },
    { onConflict: "recipe_id,group_id" },
  );
  if (error) return { error: error.message };
  revalidatePath("/recipes");
  return { success: true };
}

export async function unassignRecipeFromGroup(recipeId: string, groupId: string): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const admin = createAdminClient();
  const { error } = await admin
    .from("tmr_group_assignments")
    .delete()
    .eq("recipe_id", recipeId)
    .eq("group_id", groupId);
  if (error) return { error: error.message };
  revalidatePath("/recipes");
  return { success: true };
}
