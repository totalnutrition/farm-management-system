"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole } from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";

type Result = { error?: string; success?: boolean; applied?: number };

const moveSchema = z.object({
  animal_id: z.string().uuid(),
  from_pen_id: z.string().uuid().nullable(),
  to_pen_id: z.string().uuid(),
  reason: z.string().max(500).nullable().optional(),
});
export type MoveInput = z.infer<typeof moveSchema>;

export async function applyPenMove(input: MoveInput): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  if (parsed.data.from_pen_id === parsed.data.to_pen_id) return { success: true };

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { error: mvErr } = await admin.from("pen_moves").insert({
    animal_id: parsed.data.animal_id,
    move_date: today,
    from_pen_id: parsed.data.from_pen_id,
    to_pen_id: parsed.data.to_pen_id,
    reason: parsed.data.reason ?? null,
  });
  if (mvErr) return { error: mvErr.message };

  const { error: aErr } = await admin
    .from("animals")
    .update({ current_pen_id: parsed.data.to_pen_id })
    .eq("id", parsed.data.animal_id);
  if (aErr) return { error: aErr.message };

  revalidatePath("/pen-moves");
  revalidatePath("/animals");
  return { success: true };
}

const bulkSchema = z.object({
  moves: z
    .array(
      z.object({
        animal_id: z.string().uuid(),
        from_pen_id: z.string().uuid().nullable(),
        to_pen_id: z.string().uuid(),
        reason: z.string().max(500).nullable().optional(),
      }),
    )
    .max(2000),
});
export type BulkInput = z.infer<typeof bulkSchema>;

export async function bulkApplyPenMoves(input: BulkInput): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const real = parsed.data.moves.filter((m) => m.from_pen_id !== m.to_pen_id);
  if (real.length === 0) return { success: true, applied: 0 };

  const moveRows = real.map((m) => ({
    animal_id: m.animal_id,
    move_date: today,
    from_pen_id: m.from_pen_id,
    to_pen_id: m.to_pen_id,
    reason: m.reason ?? null,
  }));
  const { error: mvErr } = await admin.from("pen_moves").insert(moveRows);
  if (mvErr) return { error: mvErr.message };

  for (const m of real) {
    await admin
      .from("animals")
      .update({ current_pen_id: m.to_pen_id })
      .eq("id", m.animal_id);
  }

  revalidatePath("/pen-moves");
  revalidatePath("/animals");
  return { success: true, applied: real.length };
}

// ---------------------------------------------------------------------
// Inline pen creation from /pen-moves — bypasses Settings → Infra so
// users can stand pens up without leaving the assignment workflow.
// ---------------------------------------------------------------------
const newPenSchema = z.object({
  location_id: z.string().uuid(),
  group_id: z.string().uuid(),
  name: z.string().trim().min(1, "Name required.").max(120),
  capacity_head: z.number().int().min(0).max(100_000).nullable().optional(),
  length_ft: z.number().min(0).max(10_000).nullable().optional(),
  width_ft: z.number().min(0).max(10_000).nullable().optional(),
  bunk_running_ft: z.number().min(0).max(10_000).nullable().optional(),
  side: z.enum(["left", "right"]).nullable().optional(),
  barn_id: z.string().uuid().nullable().optional(),
});
export type NewPenInput = z.infer<typeof newPenSchema>;

export async function quickAddPen(input: NewPenInput): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = newPenSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  // Default barn: if the location has exactly one barn, attach the
  // new pen to it. Otherwise leave barn_id null and let the user
  // re-home the pen on Infrastructure later.
  let barnId = parsed.data.barn_id ?? null;
  if (barnId === null) {
    const { data: barns } = await admin
      .from("barns")
      .select("id")
      .eq("location_id", parsed.data.location_id);
    if (barns && barns.length === 1) barnId = barns[0].id as string;
  }

  // Pick a sensible position_index — append to whatever side the user
  // chose (default 0 if the side is empty).
  const { data: existing } = await admin
    .from("pens")
    .select("position_index, side")
    .eq("location_id", parsed.data.location_id)
    .eq("group_id", parsed.data.group_id);
  const sameSide = (existing ?? []).filter(
    (r) => (r as { side: string | null }).side === (parsed.data.side ?? null),
  );
  const nextPos = sameSide.length;

  const { error } = await admin.from("pens").insert({
    location_id: parsed.data.location_id,
    group_id: parsed.data.group_id,
    barn_id: barnId,
    name: parsed.data.name,
    type: "milking",
    capacity_head: parsed.data.capacity_head ?? null,
    bunk_running_ft: parsed.data.bunk_running_ft ?? null,
    length_ft: parsed.data.length_ft ?? null,
    width_ft: parsed.data.width_ft ?? null,
    position_index: nextPos,
    side: parsed.data.side ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/pen-moves");
  revalidatePath(`/settings/locations/${parsed.data.location_id}/infrastructure`);
  return { success: true };
}

// ---------------------------------------------------------------------
// Inline pen edit / delete / reorder — focused server actions that
// only accept the fields a /pen-moves user can touch.
// ---------------------------------------------------------------------

const updatePenInlineSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Name required.").max(120),
  capacity_head: z.number().int().min(0).max(100_000).nullable().optional(),
  bunk_running_ft: z.number().min(0).max(10_000).nullable().optional(),
  length_ft: z.number().min(0).max(10_000).nullable().optional(),
  width_ft: z.number().min(0).max(10_000).nullable().optional(),
  barn_id: z.string().uuid().nullable().optional(),
  side: z.enum(["left", "right"]).nullable().optional(),
});
export type UpdatePenInlineInput = z.infer<typeof updatePenInlineSchema>;

export async function updatePenInline(
  input: UpdatePenInlineInput,
): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = updatePenInlineSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const { id, ...rest } = parsed.data;
  const update: Record<string, unknown> = { name: rest.name };
  if (rest.capacity_head !== undefined) update.capacity_head = rest.capacity_head;
  if (rest.bunk_running_ft !== undefined) update.bunk_running_ft = rest.bunk_running_ft;
  if (rest.length_ft !== undefined) update.length_ft = rest.length_ft;
  if (rest.width_ft !== undefined) update.width_ft = rest.width_ft;
  if (rest.barn_id !== undefined) update.barn_id = rest.barn_id;
  if (rest.side !== undefined) update.side = rest.side;

  const { error } = await admin.from("pens").update(update).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/pen-moves");
  return { success: true };
}

export async function deletePenInline(input: {
  pen_id: string;
}): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = z.object({ pen_id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const admin = createAdminClient();

  // Refuse if cows still live in this pen — user must move them first.
  const { count } = await admin
    .from("animals")
    .select("id", { count: "exact", head: true })
    .eq("current_pen_id", parsed.data.pen_id);
  if ((count ?? 0) > 0) {
    return {
      error: `${count} cow(s) still in this pen. Move them first.`,
    };
  }

  const { error } = await admin
    .from("pens")
    .delete()
    .eq("id", parsed.data.pen_id);
  if (error) return { error: error.message };

  revalidatePath("/pen-moves");
  return { success: true };
}

/**
 * Swap a pen's position_index with its neighbour on the same barn + side.
 * 'up' means swap with the previous sibling, 'down' with the next.
 */
export async function reorderPen(input: {
  pen_id: string;
  direction: "up" | "down";
}): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = z
    .object({
      pen_id: z.string().uuid(),
      direction: z.enum(["up", "down"]),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("pens")
    .select("id, barn_id, side, position_index")
    .eq("id", parsed.data.pen_id)
    .maybeSingle();
  if (!target) return { error: "Pen not found." };

  type Row = { id: string; position_index: number };
  const ascending = parsed.data.direction === "down";

  let q = admin
    .from("pens")
    .select("id, position_index")
    .eq("barn_id", target.barn_id as string)
    .order("position_index", { ascending })
    .limit(1);
  q = ascending
    ? q.gt("position_index", target.position_index)
    : q.lt("position_index", target.position_index);
  q = target.side === null
    ? q.is("side", null)
    : q.eq("side", target.side as string);

  const { data: neighbour } = (await q.maybeSingle()) as { data: Row | null };
  if (!neighbour) return { success: true }; // already at boundary

  await admin
    .from("pens")
    .update({ position_index: neighbour.position_index })
    .eq("id", target.id);
  await admin
    .from("pens")
    .update({ position_index: target.position_index })
    .eq("id", neighbour.id);

  revalidatePath("/pen-moves");
  return { success: true };
}

// ---------------------------------------------------------------------
// Inline barn delete / merge — declared on /pen-moves alongside Settings →
// Infrastructure. Create / update are handled by the canonical
// createBarn / updateBarn in settings/locations/[id]/barns-actions.ts
// so both surfaces collect the same structure + facilities fields.
// ---------------------------------------------------------------------

export async function deleteBarnQuick(input: {
  barn_id: string;
  reattach_to_barn_id?: string | null;
}): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = z
    .object({
      barn_id: z.string().uuid(),
      reattach_to_barn_id: z.string().uuid().nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const admin = createAdminClient();

  const { data: barn } = await admin
    .from("barns")
    .select("id, location_id")
    .eq("id", parsed.data.barn_id)
    .maybeSingle();
  if (!barn) return { error: "Barn not found." };

  // Move pens to the reattach target (or detach if null).
  await admin
    .from("pens")
    .update({ barn_id: parsed.data.reattach_to_barn_id ?? null })
    .eq("barn_id", parsed.data.barn_id);

  const { error } = await admin
    .from("barns")
    .delete()
    .eq("id", parsed.data.barn_id);
  if (error) return { error: error.message };

  revalidatePath("/pen-moves");
  revalidatePath(`/settings/locations/${barn.location_id}/infrastructure`);
  return { success: true };
}

export async function mergeBarnsQuick(input: {
  primary_barn_id: string;
  secondary_barn_id: string;
  new_name?: string;
}): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = z
    .object({
      primary_barn_id: z.string().uuid(),
      secondary_barn_id: z.string().uuid(),
      new_name: z.string().trim().max(120).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };
  if (parsed.data.primary_barn_id === parsed.data.secondary_barn_id) {
    return { error: "Pick two different barns." };
  }

  const admin = createAdminClient();
  const { data: pair } = await admin
    .from("barns")
    .select("id, location_id, name, length_ft, width_ft")
    .in("id", [parsed.data.primary_barn_id, parsed.data.secondary_barn_id]);
  if (!pair || pair.length !== 2) return { error: "Barns not found." };
  if (pair[0].location_id !== pair[1].location_id)
    return { error: "Barns belong to different locations." };

  const primary = pair.find((b) => b.id === parsed.data.primary_barn_id)!;
  const secondary = pair.find((b) => b.id === parsed.data.secondary_barn_id)!;

  // Move pens.
  await admin
    .from("pens")
    .update({ barn_id: primary.id })
    .eq("barn_id", secondary.id);

  // Sum lengths (along the long axis); keep primary's width.
  const mergedLen =
    primary.length_ft || secondary.length_ft
      ? Number(primary.length_ft ?? 0) + Number(secondary.length_ft ?? 0) || null
      : null;

  const { error: updErr } = await admin
    .from("barns")
    .update({
      name: parsed.data.new_name ?? primary.name,
      length_ft: mergedLen,
    })
    .eq("id", primary.id);
  if (updErr) return { error: updErr.message };

  const { error: delErr } = await admin
    .from("barns")
    .delete()
    .eq("id", secondary.id);
  if (delErr) return { error: delErr.message };

  revalidatePath("/pen-moves");
  revalidatePath(`/settings/locations/${primary.location_id}/infrastructure`);
  return { success: true };
}
