"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathFeed, PathSupply } from "@/lib/misc";
import { FEED_EC } from "@/lib/derive/feed";
import { computeRation, type Material } from "@/lib/derive/ration";
import { consumeSupply } from "@/lib/supply-usage";

type Result = { error?: string; success?: boolean };

// ---- materials (ingredient) catalog: `feed` subjects ----------------
const materialSchema = z.object({
  name: z.string().trim().min(1, "Material name is required."),
  dmPct: z.coerce.number().min(1).max(100),
  costPerKgAsFed: z.coerce.number().min(0),
  cp: z.coerce.number().min(0).optional(),
  nel: z.coerce.number().min(0).optional(),
  ndf: z.coerce.number().min(0).optional(),
  stockKg: z.coerce.number().min(0).optional(),
});

export async function createMaterial(
  input: z.infer<typeof materialSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const parsed = materialSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const v = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin.from("subjects").insert({
    organization_id: orgId,
    subject_type: "feed",
    natural_key: v.name,
    attrs: {
      dm_pct: v.dmPct,
      cost: v.costPerKgAsFed,
      cp: v.cp ?? null,
      nel: v.nel ?? null,
      ndf: v.ndf ?? null,
      stock_kg: v.stockKg ?? 0,
    },
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `Material “${v.name}” already exists.` };
    return { error: error.message };
  }
  revalidatePath(PathFeed);
  return { success: true };
}

export async function deleteMaterial(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("subject_type", "feed");
  if (error) return { error: error.message };
  revalidatePath(PathFeed);
  return { success: true };
}

// ---- ration = a DM-basis recipe over materials ----------------------
const rationSchema = z.object({
  name: z.string().trim().min(1, "Ration name is required."),
  recipe: z
    .array(
      z.object({
        material: z.string().trim().min(1),
        dmKg: z.coerce.number().positive(),
      }),
    )
    .min(1, "Add at least one ingredient."),
});

export async function createRation(
  input: z.infer<typeof rationSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = rationSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { name, recipe } = parsed.data;

  const admin = createAdminClient();
  const { data: mats } = await admin
    .from("subjects")
    .select("natural_key, attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "feed");
  const catalog: Record<string, Material> = {};
  for (const m of mats ?? []) {
    const a = (m.attrs ?? {}) as Record<string, unknown>;
    catalog[m.natural_key] = {
      dmPct: typeof a.dm_pct === "number" ? a.dm_pct : 100,
      costPerKgAsFed: typeof a.cost === "number" ? a.cost : 0,
      cp: typeof a.cp === "number" ? a.cp : undefined,
      nel: typeof a.nel === "number" ? a.nel : undefined,
      ndf: typeof a.ndf === "number" ? a.ndf : undefined,
    };
  }
  const res = computeRation(recipe, catalog);
  if (res.missing.length)
    return { error: `Unknown material(s): ${res.missing.join(", ")}` };

  // store the recipe + the as-fed cost/kg so recordFeeding stays valid
  const { error } = await admin.from("subjects").insert({
    organization_id: orgId,
    subject_type: "ration",
    natural_key: name,
    attrs: {
      recipe,
      cost_per_kg: res.costPerKgAsFed,
      dm_kg: res.totalDmKg,
      cp_pct: res.cpPct,
      nel: res.nel,
      ndf_pct: res.ndfPct,
    },
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `Ration “${name}” already exists.` };
    return { error: error.message };
  }
  revalidatePath(PathFeed);
  return { success: true };
}

export async function deleteRation(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("subject_type", "ration");
  if (error) return { error: error.message };
  revalidatePath(PathFeed);
  return { success: true };
}

const feedSchema = z.object({
  penNo: z.string().trim().min(1, "Pen is required."),
  ration: z.string().trim().min(1, "Ration is required."),
  kg: z.coerce.number().positive(),
  refusedKg: z.coerce.number().min(0).optional(),
  date: z.string().trim().min(1),
});

export async function recordFeeding(
  input: z.infer<typeof feedSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = feedSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { penNo, ration, kg, refusedKg, date } = parsed.data;

  const admin = createAdminClient();
  const { data: pen } = await admin
    .from("subjects")
    .select("id")
    .eq("organization_id", orgId)
    .eq("subject_type", "pen")
    .eq("natural_key", penNo)
    .maybeSingle();
  if (!pen) return { error: `Pen ${penNo} not found. Add it in Pens.` };

  const { data: rn } = await admin
    .from("subjects")
    .select("attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "ration")
    .eq("natural_key", ration)
    .maybeSingle();
  if (!rn) return { error: `Ration “${ration}” not found.` };
  const costPerKg =
    typeof (rn.attrs as Record<string, unknown>)?.cost_per_kg === "number"
      ? ((rn.attrs as Record<string, unknown>).cost_per_kg as number)
      : 0;

  // Expand the ration to per-ingredient as-fed kg BEFORE writing
  // anything, so a stock shortage blocks the whole feeding. The
  // recipe is DM-basis; convert to as-fed proportions and split the
  // delivered kg. Name-matched and best-effort — ingredients with
  // no Supply item are untracked (and never block).
  const recipe = ((rn.attrs as Record<string, unknown>)?.recipe ??
    []) as Array<{ material: string; dmKg: number }>;
  let deductions: Array<{ material: string; qty: number }> = [];
  if (recipe.length) {
    const names = recipe.map((r) => r.material);
    const { data: matRows } = await admin
      .from("subjects")
      .select("natural_key, attrs")
      .eq("organization_id", orgId)
      .eq("subject_type", "feed")
      .in("natural_key", names);
    const dmPctOf = new Map<string, number>();
    for (const mm of matRows ?? []) {
      const a = (mm.attrs ?? {}) as Record<string, unknown>;
      dmPctOf.set(
        mm.natural_key,
        typeof a.dm_pct === "number" && a.dm_pct > 0 ? a.dm_pct : 100,
      );
    }
    const asFed = recipe.map((r) => ({
      material: r.material,
      w: r.dmKg / ((dmPctOf.get(r.material) ?? 100) / 100),
    }));
    const total = asFed.reduce((s, x) => s + x.w, 0);
    if (total > 0)
      deductions = asFed.map((x) => ({
        material: x.material,
        qty: (kg * x.w) / total,
      }));
  }

  // Resolve ingredients to Supply items by name. Feeding is NOT
  // gated on inventory (DairyComp doesn't), so unresolved or
  // ambiguous ingredients are skipped, not blocked — only resolved
  // ones are consumed (atomically, with rollback on shortage).
  const needs: Array<{ itemId: string; itemName: string; qty: number }> =
    [];
  if (deductions.length) {
    const { data: items } = await admin
      .from("subjects")
      .select("id, natural_key")
      .eq("organization_id", orgId)
      .eq("subject_type", "supply_item")
      .in(
        "natural_key",
        deductions.map((d) => d.material),
      );
    const byName = new Map<string, string | null>();
    for (const it of items ?? []) {
      byName.set(
        it.natural_key,
        byName.has(it.natural_key) ? null : it.id, // null = ambiguous
      );
    }
    for (const d of deductions) {
      const id = byName.get(d.material);
      if (id) needs.push({ itemId: id, itemName: d.material, qty: d.qty });
    }
  }

  const { data: ev, error } = await admin
    .from("events")
    .insert({
      organization_id: orgId,
      subject_id: pen.id,
      event_code: FEED_EC,
      event_date: date,
      payload: {
        ration,
        kg,
        refused: refusedKg ?? 0,
        cost: Math.round(kg * costPerKg * 100) / 100,
      },
      source: "user",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (needs.length) {
    const consumed = await consumeSupply(admin, orgId, needs, date, {
      feed_pen: penNo,
      ration,
      src_event: ev.id,
    });
    if (!consumed.ok) {
      await admin.from("events").delete().eq("id", ev.id);
      return { error: consumed.message };
    }
    revalidatePath(PathSupply);
  }

  revalidatePath(PathFeed);
  return { success: true };
}

// Delete a pen feeding and reverse any stock its ingredients
// consumed, in one locked transaction (same RPC as animal events).
// Org-scoped and restricted to FEED events on pen subjects.
export async function deleteFeedingEvent(
  eventId: string,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const admin = createAdminClient();
  const { data: ev } = await admin
    .from("events")
    .select("id, event_code, subjects!inner(subject_type)")
    .eq("id", eventId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!ev) return { error: "Feeding not found." };
  const stype = (
    ev as unknown as { subjects: { subject_type: string } }
  ).subjects?.subject_type;
  if (ev.event_code !== FEED_EC || stype !== "pen")
    return { error: "Not a pen feeding event." };

  const { data, error } = await admin.rpc(
    "delete_event_with_reversal",
    { p_org: orgId, p_event_id: eventId },
  );
  if (error) return { error: error.message };
  const res = (data ?? {}) as { ok?: boolean };
  if (!res.ok) return { error: "Feeding no longer exists." };

  revalidatePath(PathFeed);
  revalidatePath(PathSupply);
  return { success: true };
}
