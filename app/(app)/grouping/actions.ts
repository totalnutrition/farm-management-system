"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathHousing } from "@/lib/misc";

type Result = { error?: string; success?: boolean };
type Admin = ReturnType<typeof createAdminClient>;

// Pens are now the farm's REAL pens (any name). A pen referenced by a
// placement is auto-created so mapping is never blocked, but nothing
// is fabricated until the farmer maps a group to a pen.
async function ensurePens(
  admin: Admin,
  orgId: string,
  userId: string,
  names: string[],
): Promise<void> {
  const want = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!want.length) return;
  const { data: existing } = await admin
    .from("subjects")
    .select("natural_key")
    .eq("organization_id", orgId)
    .eq("subject_type", "pen")
    .in("natural_key", want);
  const have = new Set((existing ?? []).map((r) => r.natural_key));
  const toCreate = want.filter((n) => !have.has(n));
  if (!toCreate.length) return;
  await admin.from("subjects").insert(
    toCreate.map((n) => ({
      organization_id: orgId,
      subject_type: "pen",
      natural_key: n,
      name: null,
      attrs: {
        pen_no: /^\d+$/.test(n) ? Number(n) : null,
        pen_type: ["USER"],
        capacity: null,
        barn: null,
      },
      created_by: userId,
    })),
  );
}

const placementSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("single"), pen: z.string().trim().min(1) }),
  z.object({
    kind: z.literal("parity"),
    buckets: z
      .array(
        z.object({
          lacts: z.array(z.number().int()).min(1),
          pen: z.string().trim().min(1),
        }),
      )
      .min(2),
  }),
  z.object({
    kind: z.literal("item"),
    item: z.string().trim().min(1),
    cuts: z
      .array(z.object({ lt: z.number(), pen: z.string().trim().min(1) }))
      .min(1),
    elsePen: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal("capacity"),
    pens: z.array(z.string().trim().min(1)).min(2),
    orderBy: z
      .object({
        item: z.string().trim().min(1),
        dir: z.enum(["asc", "desc"]),
      })
      .optional(),
  }),
]);
type Placement = z.infer<typeof placementSchema>;

function pensOf(p: Placement): string[] {
  if (p.kind === "single") return [p.pen];
  if (p.kind === "parity") return p.buckets.map((b) => b.pen);
  if (p.kind === "item") return [...p.cuts.map((c) => c.pen), p.elsePen];
  if (p.kind === "capacity") return p.pens;
  return [];
}

const groupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required."),
  predicate: z
    .array(z.array(z.any()))
    .min(1, "Add at least one condition."),
  placement: placementSchema.optional(),
});

export async function addRule(
  input: z.infer<typeof groupSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = groupSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { name, predicate } = parsed.data;
  const placement: Placement = parsed.data.placement ?? { kind: "none" };

  const admin = createAdminClient();
  await ensurePens(admin, orgId, user.id, pensOf(placement));

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
    target_pen: null,
    split: null,
    placement,
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `A group named “${name}” already exists.` };
    return { error: error.message };
  }

  revalidatePath(PathHousing);
  return { success: true };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Group name is required."),
  predicate: z
    .array(z.array(z.any()))
    .min(1, "Add at least one condition."),
});

// Edit an existing group's name and rule in place (previously the
// only path was delete + re-create, which lost the group's ordinal
// and pen mapping). Placement is untouched here — it has its own
// editor.
export async function updateRule(
  input: z.infer<typeof updateSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { id, name, predicate } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .from("grouping_rules")
    .update({ name, predicate })
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) {
    if (error.code === "23505")
      return { error: `A group named “${name}” already exists.` };
    return { error: error.message };
  }

  revalidatePath(PathHousing);
  return { success: true };
}

const placeSchema = z.object({
  id: z.string().uuid(),
  placement: placementSchema,
});

export async function setGroupPlacement(
  input: z.infer<typeof placeSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = placeSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { id, placement } = parsed.data;

  const admin = createAdminClient();
  await ensurePens(admin, orgId, user.id, pensOf(placement));
  const { error } = await admin
    .from("grouping_rules")
    .update({ placement, target_pen: null, split: null })
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };

  revalidatePath(PathHousing);
  return { success: true };
}

const cmp = (item: string, op: string, value: number | string) => ({
  kind: "cmp" as const,
  item,
  op,
  value,
});

// Full-herd STRATEGY. Groups are listed MOST-SPECIFIC FIRST; priority
// (#) resolves the intentional nesting (triage-style), so each animal
// is assigned to exactly one group. Two genuine overrides lead (Sold/
// dead, Hospital). Every tier ends in a broad catch so no animal is
// lost for want of a secondary date — the catch groups also NAME the
// data gap (no due date / no fresh date) so it's actionable instead
// of "ungrouped". Derived items only; nothing moves until mapped.
const STANDARD_GROUPS: { name: string; when: unknown[][] }[] = [
  // — overrides —
  { name: "Sold / dead", when: [[cmp("RPRO", "=", "SLD/DIE")]] },
  { name: "Hospital", when: [[cmp("FLAGGED", "=", "YES")]] },
  // — youngstock (specific → catch) —
  { name: "Bull calf", when: [[cmp("RPRO", "=", "BULLCAF")]] },
  {
    name: "Calf (pre-breeding)",
    when: [[cmp("RPRO", "=", "VIRGIN"), cmp("AGE", "<=", 12)]],
  },
  {
    name: "Breeding heifer",
    when: [[cmp("RPRO", "=", "VIRGIN"), cmp("AGE", ">=", 13)]],
  },
  // catches virgins with no birth date (AGE null)
  { name: "Heifer (maiden)", when: [[cmp("RPRO", "=", "VIRGIN")]] },
  {
    name: "Bred heifer",
    when: [[cmp("RPRO", "=", "BRED"), cmp("LACT", "=", 0)]],
  },
  {
    name: "Springing heifer",
    when: [[cmp("RPRO", "=", "PREG"), cmp("LACT", "=", 0)]],
  },
  // — dry cows: close-up first, then ALL remaining dry —
  {
    name: "Close-up",
    when: [[cmp("RPRO", "=", "DRY"), cmp("DUE", "<=", 21)]],
  },
  { name: "Far-off dry", when: [[cmp("RPRO", "=", "DRY")]] },
  // — milking string: DIM band + non-overlapping MILK bands —
  {
    name: "Fresh",
    when: [[cmp("LACT", ">=", 1), cmp("DIM", "<=", 21)]],
  },
  {
    name: "High",
    when: [[cmp("LACT", ">=", 1), cmp("DIM", ">=", 22), cmp("MILK", ">=", 35)]],
  },
  {
    name: "Mid",
    when: [
      [
        cmp("LACT", ">=", 1),
        cmp("DIM", ">=", 22),
        cmp("MILK", ">=", 25),
        cmp("MILK", "<", 35),
      ],
    ],
  },
  {
    name: "Low",
    when: [
      [
        cmp("LACT", ">=", 1),
        cmp("DIM", ">=", 22),
        cmp("MILK", ">=", 15),
        cmp("MILK", "<", 25),
      ],
    ],
  },
  {
    name: "Late lactation",
    when: [
      [cmp("LACT", ">=", 1), cmp("DIM", ">=", 22), cmp("MILK", "<", 15)],
    ],
  },
  // final catch: lactating but missing a fresh date / milk reading —
  // grouped and NAMED so the data gap is actionable, not dropped.
  {
    name: "Lactating — needs fresh/milk date",
    when: [[cmp("LACT", ">=", 1)]],
  },
];

// Install OR refresh the standard strategy. Groups that already exist
// by name have their rule + order corrected to the canonical
// definition (their pen mapping is preserved); missing ones are
// added. User-created non-standard groups are left untouched. This
// is how corrections to the strategy actually reach an org that
// installed an earlier version.
export async function installGroupingPresets(): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("grouping_rules")
    .select("id, name, ordinal")
    .eq("organization_id", orgId);
  const byName = new Map(
    (existing ?? []).map((r) => [r.name, r] as const),
  );
  const stdNames = new Set(STANDARD_GROUPS.map((r) => r.name));
  // Non-standard user groups keep evaluating after the standard set.
  let tail = STANDARD_GROUPS.length;
  for (const r of existing ?? []) {
    if (!stdNames.has(r.name)) {
      await admin
        .from("grouping_rules")
        .update({ ordinal: ++tail })
        .eq("id", r.id)
        .eq("organization_id", orgId);
    }
  }

  for (let i = 0; i < STANDARD_GROUPS.length; i++) {
    const g = STANDARD_GROUPS[i];
    const cur = byName.get(g.name);
    if (cur) {
      const { error } = await admin
        .from("grouping_rules")
        .update({ predicate: g.when, ordinal: i + 1 })
        .eq("id", cur.id)
        .eq("organization_id", orgId);
      if (error) return { error: error.message };
    } else {
      const { error } = await admin.from("grouping_rules").insert({
        organization_id: orgId,
        ordinal: i + 1,
        name: g.name,
        predicate: g.when,
        target_pen: null,
        split: null,
        placement: { kind: "none" },
        created_by: user.id,
      });
      if (error) return { error: error.message };
    }
  }

  revalidatePath(PathHousing);
  return { success: true };
}

const capsSchema = z.object({
  caps: z
    .array(
      z.object({
        pen: z.string().trim().min(1),
        capacity: z.number().int().positive().nullable(),
      }),
    )
    .min(1),
});

// Declare each pen's capacity (counts-first sizing → capacity fill).
export async function savePenCapacities(
  input: z.infer<typeof capsSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = capsSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  await ensurePens(
    admin,
    orgId,
    user.id,
    parsed.data.caps.map((c) => c.pen),
  );
  const { data: rows } = await admin
    .from("subjects")
    .select("id, natural_key, attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "pen")
    .in(
      "natural_key",
      parsed.data.caps.map((c) => c.pen),
    );
  for (const r of rows ?? []) {
    const c = parsed.data.caps.find((x) => x.pen === r.natural_key);
    if (!c) continue;
    const attrs = {
      ...((r.attrs ?? {}) as Record<string, unknown>),
      capacity: c.capacity,
    };
    await admin
      .from("subjects")
      .update({ attrs })
      .eq("id", r.id)
      .eq("organization_id", orgId);
  }

  revalidatePath(PathHousing);
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

  revalidatePath(PathHousing);
  return { success: true };
}

const moveSchema = z.object({
  subjectId: z.string().uuid(),
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

  revalidatePath(PathHousing);
  return { success: true };
}
