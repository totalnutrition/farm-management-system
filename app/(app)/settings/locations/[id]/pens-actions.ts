"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";
import { PenTypes, type Pen } from "@/lib/pens";

type Result = { error?: string; success?: boolean };

const baseSchema = z.object({
  location_id: z.uuid(),
  barn_id: z.uuid().nullable(),
  group_id: z.uuid().nullable(),
  name: z.string().trim().min(1, "Name is required."),
  pen_code: z.string().trim().nullable(),
  type: z.enum(PenTypes.map((p) => p.value) as [string, ...string[]]),
  capacity_head: z.number().int().min(0).max(1_000_000).nullable(),
  bunk_running_ft: z.number().min(0).max(10_000).nullable(),
  stocking_target_pct: z.number().min(0).max(300).nullable(),
  length_ft: z.number().min(0).max(10_000).nullable(),
  width_ft: z.number().min(0).max(10_000).nullable(),
  position_index: z.number().int().min(0).max(1000),
  side: z.enum(["left", "right"]).nullable(),
  is_AI_pen: z.boolean(),
  is_BULL_pen: z.boolean(),
  is_DRY_pen: z.boolean(),
  is_HOSP_pen: z.boolean(),
  is_FRESH_pen: z.boolean(),
  notes: z.string().trim().nullable(),
});

const updateSchema = baseSchema.extend({ id: z.uuid() });

async function authorize(locationId: string) {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);
  const admin = createAdminClient();
  const { data } = await admin
    .from("locations")
    .select("id, organization_id")
    .eq("id", locationId)
    .single();
  if (!data) return { error: "Location not found." as const };
  if (role !== RoleSuperAdmin && data.organization_id !== orgId) {
    return { error: "Cross-org access denied." as const };
  }
  return { admin };
}

export async function listPens(locationId: string): Promise<Pen[]> {
  const authz = await authorize(locationId);
  if ("error" in authz) return [];
  const { data } = await authz.admin
    .from("pens")
    .select(
      "id, location_id, barn_id, group_id, name, pen_code, type, capacity_head, bunk_running_ft, stocking_target_pct, length_ft, width_ft, position_index, side, is_AI_pen, is_BULL_pen, is_DRY_pen, is_HOSP_pen, is_FRESH_pen, is_placeholder, notes",
    )
    .eq("location_id", locationId)
    .order("name");
  return (data ?? []) as Pen[];
}

function validate(input: z.infer<typeof baseSchema>): string | null {
  if (input.is_AI_pen && input.is_BULL_pen) {
    return "AI and Bull pens are mutually exclusive.";
  }
  return null;
}

export async function createPen(input: z.infer<typeof baseSchema>): Promise<Result> {
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const err = validate(parsed.data);
  if (err) return { error: err };
  const authz = await authorize(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin.from("pens").insert({
    ...parsed.data,
    pen_code: parsed.data.pen_code || null,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/infrastructure`);
  return { success: true };
}

export async function updatePen(input: z.infer<typeof updateSchema>): Promise<Result> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const err = validate(parsed.data);
  if (err) return { error: err };
  const authz = await authorize(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { id, ...rest } = parsed.data;
  const { error } = await authz.admin
    .from("pens")
    .update({
      ...rest,
      pen_code: rest.pen_code || null,
      notes: rest.notes || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/infrastructure`);
  return { success: true };
}

export async function deletePen(input: {
  id: string;
  location_id: string;
}): Promise<Result> {
  const authz = await authorize(input.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin.from("pens").delete().eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${input.location_id}/infrastructure`);
  return { success: true };
}

// ---------------------------------------------------------------------
// Merge / split
// ---------------------------------------------------------------------

/**
 * Merge two pens (must be in the same barn) into the primary. The
 * secondary's cows are reassigned, its capacity / bunk / length are
 * added to the primary, and the secondary row is deleted. position_index
 * of remaining pens in the barn is re-packed.
 */
export async function mergePens(input: {
  primary_pen_id: string;
  secondary_pen_id: string;
  new_name?: string;
}): Promise<Result> {
  const parsed = z
    .object({
      primary_pen_id: z.uuid(),
      secondary_pen_id: z.uuid(),
      new_name: z.string().trim().max(120).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };
  if (parsed.data.primary_pen_id === parsed.data.secondary_pen_id) {
    return { error: "Pick two different pens." };
  }

  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const orgId = getOrganizationIdFromUser(user);
  const role = getRoleFromUser(user);
  const admin = createAdminClient();

  const { data: pair } = await admin
    .from("pens")
    .select(
      "id, location_id, barn_id, capacity_head, bunk_running_ft, length_ft, name, position_index, locations:locations!inner(organization_id)",
    )
    .in("id", [parsed.data.primary_pen_id, parsed.data.secondary_pen_id]);
  if (!pair || pair.length !== 2) return { error: "Pens not found." };
  if (pair[0].location_id !== pair[1].location_id)
    return { error: "Pens belong to different locations." };
  if (pair[0].barn_id !== pair[1].barn_id || pair[0].barn_id === null)
    return { error: "Pens must be in the same barn." };
  const locOrg = (pair[0].locations as unknown as { organization_id: string })
    .organization_id;
  if (role !== RoleSuperAdmin && locOrg !== orgId)
    return { error: "Cross-org access denied." };

  const primary = pair.find((p) => p.id === parsed.data.primary_pen_id)!;
  const secondary = pair.find((p) => p.id === parsed.data.secondary_pen_id)!;

  const mergedCap =
    (primary.capacity_head ?? 0) + (secondary.capacity_head ?? 0) || null;
  const mergedBunk =
    Number(primary.bunk_running_ft ?? 0) + Number(secondary.bunk_running_ft ?? 0) ||
    null;
  const mergedLen =
    Number(primary.length_ft ?? 0) + Number(secondary.length_ft ?? 0) || null;

  // Move secondary's animals to primary.
  await admin
    .from("animals")
    .update({ current_pen_id: primary.id })
    .eq("current_pen_id", secondary.id);

  // Update primary with merged numbers.
  const { error: updErr } = await admin
    .from("pens")
    .update({
      name: parsed.data.new_name ?? primary.name,
      capacity_head: mergedCap,
      bunk_running_ft: mergedBunk,
      length_ft: mergedLen,
    })
    .eq("id", primary.id);
  if (updErr) return { error: updErr.message };

  // Drop secondary.
  const { error: delErr } = await admin
    .from("pens")
    .delete()
    .eq("id", secondary.id);
  if (delErr) return { error: delErr.message };

  // Re-pack position_index for the barn.
  const { data: remaining } = await admin
    .from("pens")
    .select("id, position_index, side")
    .eq("barn_id", primary.barn_id)
    .order("position_index");
  if (remaining) {
    // Re-pack within each side so left and right keep their ordering
    // independent.
    const bySide = new Map<string, typeof remaining>();
    for (const r of remaining) {
      const k = (r as { side: string | null }).side ?? "__none";
      if (!bySide.has(k)) bySide.set(k, []);
      bySide.get(k)!.push(r);
    }
    for (const list of bySide.values()) {
      for (let i = 0; i < list.length; i++) {
        if ((list[i] as { position_index: number }).position_index !== i) {
          await admin
            .from("pens")
            .update({ position_index: i })
            .eq("id", (list[i] as { id: string }).id);
        }
      }
    }
  }

  revalidatePath(`/settings/locations/${primary.location_id}/infrastructure`);
  return { success: true };
}

/**
 * Split a pen into two by length. The original keeps its name + the
 * first split_at_ft of its length, capacity and bunk-feet (allocated
 * proportionally). A new pen inherits the rest. position_index is
 * inserted right after the original on the same side.
 */
export async function splitPen(input: {
  pen_id: string;
  split_at_ft: number;
  new_name: string;
}): Promise<Result> {
  const parsed = z
    .object({
      pen_id: z.uuid(),
      split_at_ft: z.number().positive(),
      new_name: z.string().trim().min(1).max(120),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const orgId = getOrganizationIdFromUser(user);
  const role = getRoleFromUser(user);
  const admin = createAdminClient();

  const { data: pen } = await admin
    .from("pens")
    .select(
      "id, location_id, barn_id, group_id, side, position_index, name, type, capacity_head, bunk_running_ft, stocking_target_pct, length_ft, width_ft, locations:locations!inner(organization_id)",
    )
    .eq("id", parsed.data.pen_id)
    .single();
  if (!pen) return { error: "Pen not found." };
  const locOrg = (pen.locations as unknown as { organization_id: string })
    .organization_id;
  if (role !== RoleSuperAdmin && locOrg !== orgId)
    return { error: "Cross-org access denied." };

  if (!pen.length_ft || Number(pen.length_ft) <= parsed.data.split_at_ft) {
    return {
      error:
        "Pen length_ft must be set and greater than the split point. Set it on the pen first.",
    };
  }

  const totalLen = Number(pen.length_ft);
  const firstFrac = parsed.data.split_at_ft / totalLen;
  const remainingLen = totalLen - parsed.data.split_at_ft;
  const newCap =
    pen.capacity_head !== null
      ? Math.max(0, Math.round((pen.capacity_head as number) * (1 - firstFrac)))
      : null;
  const keptCap =
    pen.capacity_head !== null
      ? (pen.capacity_head as number) - (newCap ?? 0)
      : null;
  const newBunk =
    pen.bunk_running_ft !== null
      ? Number(((pen.bunk_running_ft as number) * (1 - firstFrac)).toFixed(2))
      : null;
  const keptBunk =
    pen.bunk_running_ft !== null
      ? Number(((pen.bunk_running_ft as number) - (newBunk ?? 0)).toFixed(2))
      : null;

  // Shift subsequent pens on the same side / barn by +1.
  const { data: subsequent } = await admin
    .from("pens")
    .select("id, position_index")
    .eq("barn_id", pen.barn_id)
    .gt("position_index", pen.position_index)
    .order("position_index");
  for (const s of subsequent ?? []) {
    await admin
      .from("pens")
      .update({
        position_index: ((s as { position_index: number }).position_index ?? 0) + 1,
      })
      .eq("id", (s as { id: string }).id);
  }

  // Insert the new pen.
  const { error: insErr } = await admin.from("pens").insert({
    location_id: pen.location_id,
    barn_id: pen.barn_id,
    group_id: pen.group_id,
    side: pen.side,
    position_index: ((pen.position_index as number) ?? 0) + 1,
    name: parsed.data.new_name,
    type: pen.type,
    capacity_head: newCap,
    bunk_running_ft: newBunk,
    stocking_target_pct: pen.stocking_target_pct,
    length_ft: Number(remainingLen.toFixed(2)),
    width_ft: pen.width_ft,
  });
  if (insErr) return { error: insErr.message };

  // Trim the original.
  const { error: updErr } = await admin
    .from("pens")
    .update({
      capacity_head: keptCap,
      bunk_running_ft: keptBunk,
      length_ft: parsed.data.split_at_ft,
    })
    .eq("id", pen.id);
  if (updErr) return { error: updErr.message };

  revalidatePath(`/settings/locations/${pen.location_id}/infrastructure`);
  return { success: true };
}
