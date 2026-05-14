"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  Delete02Icon,
  PencilEdit02Icon,
  CookBookIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  upsertRecipe,
  deleteRecipe,
  upsertLine,
  deleteLine,
  assignRecipeToGroup,
  unassignRecipeFromGroup,
} from "./actions";

// =============================================================================
// Types
// =============================================================================
export type FeedOpt = {
  id: string;
  name: string;
  dm_pct: number | null;
  ne_l_mcal_per_kg: number | null;
  cp_pct: number | null;
  ndf_pct: number | null;
  starch_pct: number | null;
};

export type GroupOpt = { id: string; label: string };

export type LineRow = {
  id: string;
  recipe_id: string;
  feed_material_id: string | null;
  display_name: string;
  as_fed_kg_per_cow: number;
  display_order: number;
  // Looked up from feed_material when present
  dm_pct: number | null;
  ne_l_mcal_per_kg: number | null;
  cp_pct: number | null;
  ndf_pct: number | null;
  starch_pct: number | null;
};

export type RecipeRow = {
  id: string;
  name: string;
  description: string | null;
  target_dm_intake_kg: number | null;
  target_cows: number | null;
  is_active: boolean;
  lines: LineRow[];
  group_ids: string[];
};

export function RecipesClient({
  locationId,
  recipes,
  feeds,
  groups,
}: {
  locationId: string;
  recipes: RecipeRow[];
  feeds: FeedOpt[];
  groups: GroupOpt[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const initialId = params.get("id") ?? recipes[0]?.id ?? null;
  const [openId, setOpenId] = useState<string | null>(initialId);
  const [openHeader, setOpenHeader] = useState<null | { initial: RecipeRow | null }>(null);

  const setRecipe = (id: string) => {
    setOpenId(id);
    const q = new URLSearchParams(params.toString());
    q.set("id", id);
    router.replace(`/recipes?${q.toString()}`);
  };

  const active = recipes.find((r) => r.id === openId) ?? null;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {recipes.length} recipe{recipes.length === 1 ? "" : "s"} on file.
          Assign one to a group; feeding events can reference the recipe.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpenHeader({ initial: null })}>
          <HugeiconsIcon icon={PlusSignIcon} />
          New recipe
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
        <aside className="ring-1 ring-foreground/10 flex flex-col">
          <header className="px-3 py-2 bg-foreground/5 text-xs font-medium">Recipes</header>
          {recipes.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No recipes yet.
            </div>
          ) : (
            <ul className="flex flex-col">
              {recipes.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setRecipe(r.id)}
                    className={`w-full text-left px-3 py-2 text-xs border-t border-foreground/10 hover:bg-foreground/5 ${
                      openId === r.id ? "bg-foreground/5" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{r.name}</span>
                      {!r.is_active ? (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          inactive
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {r.lines.length} line{r.lines.length === 1 ? "" : "s"}
                      {r.target_cows ? ` · ${r.target_cows} cows` : ""}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="flex flex-col">
          {active ? (
            <RecipeDetail
              recipe={active}
              feeds={feeds}
              groups={groups}
              onEditHeader={() => setOpenHeader({ initial: active })}
            />
          ) : (
            <div className="ring-1 ring-foreground/10 p-4 text-center text-xs text-muted-foreground">
              Pick a recipe on the left or add a new one.
            </div>
          )}
        </div>
      </div>

      <RecipeHeaderDialog
        open={!!openHeader}
        onOpenChange={(o) => !o && setOpenHeader(null)}
        locationId={locationId}
        initial={openHeader?.initial ?? null}
      />
    </>
  );
}

// =============================================================================
// Recipe detail (lines editor + nutrient totals + group assignment)
// =============================================================================
function RecipeDetail({
  recipe,
  feeds,
  groups,
  onEditHeader,
}: {
  recipe: RecipeRow;
  feeds: FeedOpt[];
  groups: GroupOpt[];
  onEditHeader: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [openLine, setOpenLine] = useState<null | { initial: LineRow | null }>(null);

  const totals = recipe.lines.reduce(
    (acc, l) => {
      acc.as_fed_kg += l.as_fed_kg_per_cow;
      const dmKg = l.dm_pct !== null ? (l.as_fed_kg_per_cow * l.dm_pct) / 100 : 0;
      acc.dm_kg += dmKg;
      if (l.ne_l_mcal_per_kg !== null) acc.nel_mcal += dmKg * l.ne_l_mcal_per_kg;
      if (l.cp_pct !== null) acc.cp_kg += (dmKg * l.cp_pct) / 100;
      if (l.ndf_pct !== null) acc.ndf_kg += (dmKg * l.ndf_pct) / 100;
      if (l.starch_pct !== null) acc.starch_kg += (dmKg * l.starch_pct) / 100;
      return acc;
    },
    { as_fed_kg: 0, dm_kg: 0, nel_mcal: 0, cp_kg: 0, ndf_kg: 0, starch_kg: 0 },
  );
  const cpPct = totals.dm_kg > 0 ? (totals.cp_kg / totals.dm_kg) * 100 : 0;
  const ndfPct = totals.dm_kg > 0 ? (totals.ndf_kg / totals.dm_kg) * 100 : 0;
  const starchPct = totals.dm_kg > 0 ? (totals.starch_kg / totals.dm_kg) * 100 : 0;
  const nelPerKg = totals.dm_kg > 0 ? totals.nel_mcal / totals.dm_kg : 0;
  const dmShortfall = recipe.target_dm_intake_kg
    ? recipe.target_dm_intake_kg - totals.dm_kg
    : null;

  const onDeleteRecipe = () => {
    if (!confirm(`Delete recipe "${recipe.name}"? Lines and group assignments go with it.`)) return;
    startTransition(async () => {
      const r = await deleteRecipe(recipe.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Recipe deleted.");
      router.refresh();
    });
  };

  const onDeleteLine = (id: string) => {
    if (!confirm("Delete this ingredient line?")) return;
    startTransition(async () => {
      const r = await deleteLine(id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <section className="ring-1 ring-foreground/10 flex flex-col">
        <header className="px-3 py-2 bg-foreground/5 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-medium">
              {recipe.name}
              {!recipe.is_active ? (
                <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  inactive
                </span>
              ) : null}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              {recipe.description ?? "—"}
              {recipe.target_cows ? ` · target ${recipe.target_cows} cows` : ""}
              {recipe.target_dm_intake_kg ? ` · target DM ${recipe.target_dm_intake_kg} kg/cow/day` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={onEditHeader}>
              <HugeiconsIcon icon={PencilEdit02Icon} />
              Edit
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onDeleteRecipe}>
              <HugeiconsIcon icon={Delete02Icon} />
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-foreground/10">
          <NutrientTile label="As-fed kg/cow" value={totals.as_fed_kg.toFixed(2)} />
          <NutrientTile
            label="DM kg/cow"
            value={totals.dm_kg.toFixed(2)}
            sub={
              dmShortfall === null
                ? undefined
                : dmShortfall > 0
                  ? `short ${dmShortfall.toFixed(1)}`
                  : `over ${Math.abs(dmShortfall).toFixed(1)}`
            }
            tone={dmShortfall === null ? undefined : dmShortfall > 0 ? "warn" : undefined}
          />
          <NutrientTile label="NEL Mcal/kg DM" value={nelPerKg.toFixed(2)} />
          <NutrientTile label="CP %" value={cpPct.toFixed(1)} />
          <NutrientTile label="NDF %" value={ndfPct.toFixed(1)} />
          <NutrientTile label="Starch %" value={starchPct.toFixed(1)} />
        </div>
      </section>

      <section className="ring-1 ring-foreground/10 flex flex-col">
        <header className="px-3 py-2 bg-foreground/5 flex items-start justify-between gap-3">
          <h3 className="text-sm font-medium">
            Ingredients
            <span className="ml-2 text-[10px] font-normal text-muted-foreground">
              {recipe.lines.length} line{recipe.lines.length === 1 ? "" : "s"}
            </span>
          </h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setOpenLine({ initial: null })}
          >
            <HugeiconsIcon icon={PlusSignIcon} />
            Add ingredient
          </Button>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-foreground/[0.025]">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Feed</th>
                <th className="px-3 py-2 font-medium text-right">As-fed kg/cow</th>
                <th className="px-3 py-2 font-medium text-right">DM %</th>
                <th className="px-3 py-2 font-medium text-right">DM kg/cow</th>
                <th className="px-3 py-2 font-medium text-right">CP %</th>
                <th className="px-3 py-2 font-medium text-right">NDF %</th>
                <th className="px-3 py-2 font-medium text-right">Starch %</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recipe.lines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">
                    No ingredients yet.
                  </td>
                </tr>
              ) : (
                recipe.lines.map((l) => {
                  const dmKg = l.dm_pct !== null ? (l.as_fed_kg_per_cow * l.dm_pct) / 100 : null;
                  return (
                    <tr key={l.id} className="border-t border-foreground/10">
                      <td className="px-3 py-2 font-medium inline-flex items-center gap-1.5">
                        <HugeiconsIcon icon={CookBookIcon} className="size-3" />
                        {l.display_name}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {l.as_fed_kg_per_cow.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {l.dm_pct ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {dmKg === null ? "—" : dmKg.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {l.cp_pct ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {l.ndf_pct ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {l.starch_pct ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setOpenLine({ initial: l })}
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onDeleteLine(l.id)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <GroupAssignmentCard recipe={recipe} groups={groups} />

      <LineDialog
        open={!!openLine}
        onOpenChange={(o) => !o && setOpenLine(null)}
        recipeId={recipe.id}
        feeds={feeds}
        initial={openLine?.initial ?? null}
      />
    </div>
  );
}

function NutrientTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warn";
}) {
  return (
    <div className="bg-background p-3 flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
      {sub ? (
        <span
          className={`text-[10px] ${tone === "warn" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {sub}
        </span>
      ) : null}
    </div>
  );
}

function GroupAssignmentCard({
  recipe,
  groups,
}: {
  recipe: RecipeRow;
  groups: GroupOpt[];
}) {
  const router = useRouter();
  const [pickGroupId, setPickGroupId] = useState<string>("");
  const [, startTransition] = useTransition();

  const onAssign = () => {
    if (!pickGroupId) return;
    startTransition(async () => {
      const r = await assignRecipeToGroup({
        recipe_id: recipe.id,
        group_id: pickGroupId,
        is_primary: true,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Group assigned.");
      setPickGroupId("");
      router.refresh();
    });
  };
  const onUnassign = (groupId: string) => {
    startTransition(async () => {
      const r = await unassignRecipeFromGroup(recipe.id, groupId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  };

  const assigned = groups.filter((g) => recipe.group_ids.includes(g.id));
  const available = groups.filter((g) => !recipe.group_ids.includes(g.id));

  return (
    <section className="ring-1 ring-foreground/10 flex flex-col">
      <header className="px-3 py-2 bg-foreground/5">
        <h3 className="text-sm font-medium">
          Assigned groups
          <span className="ml-2 text-[10px] font-normal text-muted-foreground">
            {assigned.length}
          </span>
        </h3>
      </header>
      <div className="px-3 py-2 flex flex-wrap items-center gap-2">
        {assigned.length === 0 ? (
          <span className="text-xs text-muted-foreground">Not assigned to any group yet.</span>
        ) : (
          assigned.map((g) => (
            <span
              key={g.id}
              className="inline-flex items-center gap-1 px-2 py-1 ring-1 ring-foreground/10 text-xs"
            >
              {g.label}
              <button
                type="button"
                onClick={() => onUnassign(g.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Unassign"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      {available.length > 0 ? (
        <div className="px-3 pb-3 flex items-center gap-2">
          <select
            className="text-xs border border-foreground/10 px-2 py-1 bg-background"
            value={pickGroupId}
            onChange={(e) => setPickGroupId(e.target.value)}
          >
            <option value="">— pick a group —</option>
            {available.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" variant="outline" onClick={onAssign}>
            Assign
          </Button>
        </div>
      ) : null}
    </section>
  );
}

// =============================================================================
// Dialogs
// =============================================================================
const recipeFormSchema = z.object({
  name: z.string().min(1, "Required."),
  description: z.string().optional(),
  target_dm_intake_kg: z.number().nullable().optional(),
  target_cows: z.number().int().nullable().optional(),
  is_active: z.boolean(),
});
type RecipeFormValues = z.infer<typeof recipeFormSchema>;

function RecipeHeaderDialog({
  open,
  onOpenChange,
  locationId,
  initial,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  locationId: string;
  initial: RecipeRow | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeFormSchema),
    values: {
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      target_dm_intake_kg: initial?.target_dm_intake_kg ?? null,
      target_cows: initial?.target_cows ?? null,
      is_active: initial?.is_active ?? true,
    },
  });

  const onSubmit = (v: RecipeFormValues) =>
    startTransition(async () => {
      const r = await upsertRecipe({
        id: initial?.id,
        location_id: locationId,
        name: v.name,
        description: v.description || null,
        target_dm_intake_kg: v.target_dm_intake_kg ?? null,
        target_cows: v.target_cows ?? null,
        is_active: v.is_active,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(initial ? "Recipe updated." : "Recipe added.");
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit recipe" : "New recipe"}</DialogTitle>
          <DialogDescription>
            Header only. Add ingredients on the recipe detail page.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="High-group lactating TMR" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="target_dm_intake_kg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target DM intake (kg/cow/day)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        max={60}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="target_cows"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target cows</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Active</FormLabel>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const lineFormSchema = z.object({
  feed_material_id: z.string(),
  display_name: z.string().min(1, "Required."),
  as_fed_kg_per_cow: z.number().min(0),
});
type LineFormValues = z.infer<typeof lineFormSchema>;

const NEW_FREE = "__free__";

function LineDialog({
  open,
  onOpenChange,
  recipeId,
  feeds,
  initial,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  recipeId: string;
  feeds: FeedOpt[];
  initial: LineRow | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<LineFormValues>({
    resolver: zodResolver(lineFormSchema),
    values: {
      feed_material_id: initial?.feed_material_id ?? (feeds[0]?.id ?? NEW_FREE),
      display_name: initial?.display_name ?? feeds[0]?.name ?? "",
      as_fed_kg_per_cow: initial?.as_fed_kg_per_cow ?? 0,
    },
  });

  const onSubmit = (v: LineFormValues) =>
    startTransition(async () => {
      const feedRef = v.feed_material_id === NEW_FREE ? null : v.feed_material_id;
      // If a catalog feed is picked and display_name wasn't customised, use catalog name.
      const feed = feeds.find((f) => f.id === feedRef);
      const displayName =
        v.display_name && v.display_name.trim().length > 0
          ? v.display_name
          : feed?.name ?? "Ingredient";
      const r = await upsertLine({
        id: initial?.id,
        recipe_id: recipeId,
        feed_material_id: feedRef,
        display_name: displayName,
        as_fed_kg_per_cow: v.as_fed_kg_per_cow,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(initial ? "Ingredient updated." : "Ingredient added.");
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit ingredient" : "Add ingredient"}</DialogTitle>
          <DialogDescription>
            Pick a feed material from the catalog (preferred — gives the
            nutrient totals data) or enter a free-form name.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormField
              control={form.control}
              name="feed_material_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Feed material</FormLabel>
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      const feed = feeds.find((f) => f.id === val);
                      if (feed) form.setValue("display_name", feed.name);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NEW_FREE}>— free-form (no nutrients) —</SelectItem>
                      {feeds.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                          {f.dm_pct !== null ? ` · ${f.dm_pct}% DM` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="as_fed_kg_per_cow"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>As-fed kg per cow per day</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="any"
                      min={0}
                      value={field.value || ""}
                      onChange={(e) => field.onChange(Number(e.target.value || 0))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
