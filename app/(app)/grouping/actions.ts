"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathGrouping } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

type Admin = ReturnType<typeof createAdminClient>;

// A grouping rule targets a pen; pens are numeric (DC convention).
// Auto-create any referenced pen so authoring a rule is never blocked
// by "no pens yet".
async function ensurePens(
  admin: Admin,
  orgId: string,
  userId: string,
  pens: { no: number; label?: string }[],
): Promise<void> {
  if (!pens.length) return;
  const nums = pens.map((p) => String(p.no));
  const { data: existing } = await admin
    .from("subjects")
    .select("natural_key")
    .eq("organization_id", orgId)
    .eq("subject_type", "pen")
    .in("natural_key", nums);
  const have = new Set((existing ?? []).map((r) => r.natural_key));
  const toCreate = pens.filter((p) => !have.has(String(p.no)));
  if (!toCreate.length) return;
  await admin.from("subjects").insert(
    toCreate.map((p) => ({
      organization_id: orgId,
      subject_type: "pen",
      natural_key: String(p.no),
      name: p.label ?? null,
      attrs: { pen_no: p.no, pen_type: ["USER"], capacity: null, barn: null },
      created_by: userId,
    })),
  );
}

const isPenNo = (s: string) =>
  /^\d+$/.test(s) && Number(s) >= 1 && Number(s) <= 9999;

const ruleSchema = z
  .object({
    name: z.string().trim().min(1, "Rule name is required."),
    predicate: z.array(z.array(z.any())).min(1, "Add at least one condition."),
    targetPen: z.string().trim().optional(),
    splitFirst: z.string().trim().optional(),
    splitMature: z.string().trim().optional(),
  })
  .refine(
    (v) =>
      (v.targetPen && v.targetPen.length > 0) ||
      (v.splitFirst && v.splitMature),
    { message: "Choose a target pen, or both parity-split pens." },
  );

export async function addRule(
  input: z.infer<typeof ruleSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { name, predicate, targetPen, splitFirst, splitMature } =
    parsed.data;

  const split =
    splitFirst && splitMature
      ? { firstLactation: splitFirst, mature: splitMature }
      : null;

  const penRefs = split
    ? [split.firstLactation, split.mature]
    : [targetPen as string];
  for (const p of penRefs)
    if (!isPenNo(p))
      return { error: `Pen "${p}" must be a number (1–9999).` };

  const admin = createAdminClient();
  await ensurePens(
    admin,
    orgId,
    user.id,
    penRefs.map((p) => ({ no: Number(p) })),
  );
  const { data: last } = await admin
    .from("grouping_rules")
    .select("ordinal")
    .eq("organization_id", orgId)
    .order("ordinal", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordinal = (last?.ordinal ?? 0) + 1;

  const { error } = await admin.from("grouping_rules").insert({
    organization_id: orgId,
    ordinal,
    name,
    predicate,
    target_pen: split ? null : (targetPen as string),
    split,
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `A rule named “${name}” already exists.` };
    return { error: error.message };
  }

  revalidatePath(PathGrouping);
  return { success: true };
}

const cmp = (item: string, op: string, value: number | string) => ({
  kind: "cmp" as const,
  item,
  op,
  value,
});

const PRESET_PENS = [
  { no: 1, label: "Fresh" },
  { no: 2, label: "High" },
  { no: 3, label: "Mid" },
  { no: 4, label: "Low" },
  { no: 5, label: "Late" },
  { no: 10, label: "Far-off dry" },
  { no: 11, label: "Close-up" },
  { no: 20, label: "Hospital" },
];

// Standard lactating-herd scheme, derived items only — order matters
// (first match wins).
const PRESET_RULES: { name: string; when: unknown[][]; pen: string }[] = [
  { name: "Hospital", when: [[cmp("FLAGGED", "=", "YES")]], pen: "20" },
  {
    name: "Close-up",
    when: [[cmp("RPRO", "=", "DRY"), cmp("DUE", "<=", 21)]],
    pen: "11",
  },
  { name: "Far-off dry", when: [[cmp("RPRO", "=", "DRY")]], pen: "10" },
  { name: "Fresh", when: [[cmp("DIM", "<=", 21)]], pen: "1" },
  { name: "High group", when: [[cmp("MAVG", ">=", 35)]], pen: "2" },
  { name: "Mid group", when: [[cmp("MAVG", ">=", 25)]], pen: "3" },
  { name: "Low group", when: [[cmp("MAVG", ">=", 15)]], pen: "4" },
  { name: "Late lactation", when: [[cmp("DIM", ">=", 1)]], pen: "5" },
];

export async function installGroupingPresets(): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const admin = createAdminClient();
  await ensurePens(admin, orgId, user.id, PRESET_PENS);

  const { data: existing } = await admin
    .from("grouping_rules")
    .select("name, ordinal")
    .eq("organization_id", orgId);
  const have = new Set((existing ?? []).map((r) => r.name));
  let ordinal = Math.max(0, ...(existing ?? []).map((r) => r.ordinal));

  const rows = PRESET_RULES.filter((r) => !have.has(r.name)).map((r) => ({
    organization_id: orgId,
    ordinal: ++ordinal,
    name: r.name,
    predicate: r.when,
    target_pen: r.pen,
    split: null,
    created_by: user.id,
  }));
  if (rows.length) {
    const { error } = await admin.from("grouping_rules").insert(rows);
    if (error) return { error: error.message };
  }

  revalidatePath(PathGrouping);
  return { success: true };
}

export async function deleteRule(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("grouping_rules")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };

  revalidatePath(PathGrouping);
  return { success: true };
}

const moveSchema = z.object({
  subjectId: z.uuid(),
  toPen: z.string().trim().min(1),
});

export async function moveAnimal(
  input: z.infer<typeof moveSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = moveSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { subjectId, toPen } = parsed.data;

  const admin = createAdminClient();
  const { data: subj, error: sErr } = await admin
    .from("subjects")
    .select("attrs")
    .eq("id", subjectId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (sErr) return { error: sErr.message };
  if (!subj) return { error: "Animal not found." };

  const attrs = {
    ...((subj.attrs ?? {}) as Record<string, unknown>),
    pen: toPen,
  };
  const { error } = await admin
    .from("subjects")
    .update({ attrs })
    .eq("id", subjectId)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };

  revalidatePath(PathGrouping);
  return { success: true };
}
