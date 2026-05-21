"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathHousing } from "@/lib/misc";
import { MILK_EC } from "@/lib/derive/production";

type Result = { error?: string; success?: boolean; info?: string };
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

// Full-herd STRATEGY, composed from farm-standard segments + a
// pickable milking-tier system. ONE vocabulary: every pre-calving
// animal is Far-off → Close-up (no "springing"/"bred heifer" jargon),
// qualified by parity. Most-specific first; priority (#) resolves the
// nesting so each animal is assigned to exactly one group. Hospital
// is the only override. Exited and data-gap animals are NOT pens —
// they surface in Reconciliation. Derived items only; editable after.
type Grp = { name: string; when: unknown[][] };
const LACT1 = cmp("LACT", ">=", 1);
const DIM22 = cmp("DIM", ">=", 22);
type Atom = ReturnType<typeof cmp>;
const band = (name: string, extra: Atom[]): Grp => ({
  name,
  when: [[LACT1, DIM22, ...extra]],
});

const OVERRIDES: Grp[] = [
  { name: "Hospital", when: [[cmp("FLAGGED", "=", "YES")]] },
];
// Open / growing youngstock (not yet pregnant). Calf is the specific
// case; Breeding heifer = every other virgin (incl. no birth date) —
// no separate "maiden" term needed since Calf is matched first.
// (Bull calf intentionally omitted — the engine has no path to set
// RPRO=BULLCAF until a sex/identification event exists.)
const YOUNGSTOCK: Grp[] = [
  {
    name: "Calf (pre-breeding)",
    when: [[cmp("RPRO", "=", "VIRGIN"), cmp("AGE", "<=", 12)]],
  },
  { name: "Breeding heifer", when: [[cmp("RPRO", "=", "VIRGIN")]] },
];
// Pre-calving, ONE vocabulary: Close-up (≤21d to due) split by parity,
// then a Far-off catch for every other pregnant animal (heifer = BRED
// & LACT 0; cow = DRY). Same words for heifers and cows.
const PRECALVING: Grp[] = [
  {
    name: "Close-up heifer",
    when: [[cmp("RPRO", "=", "BRED"), cmp("LACT", "=", 0), cmp("DUE", "<=", 21)]],
  },
  {
    name: "Close-up cow",
    when: [[cmp("RPRO", "=", "DRY"), cmp("DUE", "<=", 21)]],
  },
  {
    name: "Far-off (pregnant)",
    when: [[cmp("RPRO", "=", "BRED"), cmp("LACT", "=", 0)], [cmp("RPRO", "=", "DRY")]],
  },
];
const FRESH: Grp = { name: "Fresh", when: [[LACT1, cmp("DIM", "<=", 21)]] };

// Milking-tier systems (extension-standard; DC/BoviSync treat pens as
// farm-defined functions, not a fixed ladder — so these are starting
// points, fully editable).
const MILK_TIERS: Record<string, Grp[]> = {
  "2tier": [
    band("High", [cmp("MILK", ">=", 30)]),
    band("Low", [cmp("MILK", "<", 30)]),
  ],
  "3tier": [
    band("High", [cmp("MILK", ">=", 35)]),
    band("Mid", [cmp("MILK", ">=", 25), cmp("MILK", "<", 35)]),
    band("Low", [cmp("MILK", ">=", 15), cmp("MILK", "<", 25)]),
    band("Late lactation", [cmp("MILK", "<", 15)]),
  ],
  "4tier": [
    {
      name: "1st-lact High",
      when: [[cmp("LACT", "=", 1), DIM22, cmp("MILK", ">=", 30)]],
    },
    {
      name: "1st-lact Low",
      when: [[cmp("LACT", "=", 1), DIM22, cmp("MILK", "<", 30)]],
    },
    {
      name: "Mature High",
      when: [[cmp("LACT", ">=", 2), DIM22, cmp("MILK", ">=", 35)]],
    },
    {
      name: "Mature Low",
      when: [[cmp("LACT", ">=", 2), DIM22, cmp("MILK", "<", 35)]],
    },
  ],
};

const STRATEGY_KEYS = ["2tier", "3tier", "4tier"] as const;
type StrategyKey = (typeof STRATEGY_KEYS)[number];

function buildStrategy(preset: StrategyKey): Grp[] {
  return [
    ...OVERRIDES,
    ...YOUNGSTOCK,
    ...PRECALVING,
    FRESH,
    ...MILK_TIERS[preset],
  ];
}

// Every name any preset can emit — lets a preset switch clear the
// previous preset's milking groups without touching the farm's own
// custom groups.
const ALL_PRESET_NAMES = new Set<string>(
  STRATEGY_KEYS.flatMap((p) => buildStrategy(p).map((g) => g.name)),
);

// Install / switch the standard strategy to a chosen tier system.
// Existing groups keep their pen mapping (predicate + order corrected
// in place); switching presets removes the OTHER presets' milking
// groups; the farm's own custom groups are never touched.
export async function installGroupingPresets(
  presetInput: string = "3tier",
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = z.enum(STRATEGY_KEYS).safeParse(presetInput);
  if (!parsed.success) return { error: "Unknown strategy." };
  const groups = buildStrategy(parsed.data);
  const chosen = new Set(groups.map((g) => g.name));

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("grouping_rules")
    .select("id, name, ordinal")
    .eq("organization_id", orgId);

  // Drop standard groups that belong to a different preset.
  for (const r of existing ?? []) {
    if (ALL_PRESET_NAMES.has(r.name) && !chosen.has(r.name)) {
      const { error } = await admin
        .from("grouping_rules")
        .delete()
        .eq("id", r.id)
        .eq("organization_id", orgId);
      if (error) return { error: error.message };
    }
  }

  const byName = new Map(
    (existing ?? [])
      .filter((r) => chosen.has(r.name))
      .map((r) => [r.name, r] as const),
  );
  // The farm's own groups keep evaluating after the standard set.
  let tail = groups.length;
  for (const r of existing ?? []) {
    if (!ALL_PRESET_NAMES.has(r.name)) {
      await admin
        .from("grouping_rules")
        .update({ ordinal: ++tail })
        .eq("id", r.id)
        .eq("organization_id", orgId);
    }
  }

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
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

// ── Demo / test data ────────────────────────────────────────────────
// Generate a full synthetic herd that populates EVERY group in the
// default strategy (Hospital, Calf, Breeding heifer, Close-up
// heifer/cow, Far-off, Fresh, High/Mid/Low/Late). All demo subjects
// are tagged attrs.demo=true and all demo events payload.demo=true,
// so clearDemoData removes them cleanly. Never run on a real herd.
// FRESH=1, BRED=5, DRY=11, MILK=201, FLAG=203.
const DAY = 86_400_000;
const isoShift = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
const rnd = (a: number, b: number) =>
  a + Math.floor(Math.random() * (b - a + 1));
type DemoAnimal = {
  natural_key: string;
  attrs: Record<string, unknown>;
  events: { code: number; date: string; payload?: Record<string, unknown> }[];
};

// Group → count for a 500-animal herd. Hits every default-strategy
// group. Adjust counts; total = sum.
const DEFAULT_MIX: Record<string, number> = {
  hospital: 10,
  calf: 60, // VIRGIN, AGE<=12mo
  breedingHeifer: 60, // VIRGIN, older
  closeupHeifer: 10, // BRED, LACT=0, DUE<=21
  farOffHeifer: 30, // BRED, LACT=0, DUE>21
  closeupCow: 15, // DRY, DUE<=21
  farOffCow: 30, // DRY, DUE>21
  fresh: 25, // LACT>=1, DIM<=21
  high: 60, // MILK >= 35
  mid: 80, // MILK 25-34
  low: 70, // MILK 15-24
  late: 50, // MILK < 15
};

function gen(
  kind: keyof typeof DEFAULT_MIX,
  key: string,
  today: string,
): DemoAnimal {
  const a: Record<string, unknown> = { demo: true, entry_date: today };
  const events: DemoAnimal["events"] = [];
  switch (kind) {
    case "calf": {
      a.cohort = "calf";
      a.base_lactation = 0;
      a.birth_date = isoShift(-rnd(60, 360));
      break;
    }
    case "breedingHeifer": {
      a.cohort = "open_heifer";
      a.base_lactation = 0;
      a.birth_date = isoShift(-rnd(395, 730));
      break;
    }
    case "closeupHeifer": {
      a.cohort = "bred_heifer";
      a.base_lactation = 0;
      a.birth_date = isoShift(-rnd(750, 900));
      a.due_date = isoShift(rnd(2, 21));
      events.push({ code: 5, date: isoShift(-rnd(259, 278)) });
      break;
    }
    case "farOffHeifer": {
      a.cohort = "bred_heifer";
      a.base_lactation = 0;
      a.birth_date = isoShift(-rnd(700, 900));
      a.due_date = isoShift(rnd(60, 240));
      events.push({ code: 5, date: isoShift(-rnd(40, 220)) });
      break;
    }
    case "closeupCow": {
      a.cohort = "dry";
      a.base_lactation = rnd(1, 5);
      a.birth_date = isoShift(-rnd(900, 2200));
      a.due_date = isoShift(rnd(2, 21));
      events.push({ code: 1, date: isoShift(-rnd(310, 420)) });
      events.push({ code: 11, date: isoShift(-rnd(40, 60)) });
      break;
    }
    case "farOffCow": {
      a.cohort = "dry";
      a.base_lactation = rnd(1, 5);
      a.birth_date = isoShift(-rnd(900, 2200));
      a.due_date = isoShift(rnd(30, 60));
      events.push({ code: 1, date: isoShift(-rnd(280, 380)) });
      events.push({ code: 11, date: isoShift(-rnd(20, 40)) });
      break;
    }
    case "fresh": {
      a.cohort = "lactating";
      a.base_lactation = rnd(1, 5);
      a.birth_date = isoShift(-rnd(750, 2200));
      events.push({ code: 1, date: isoShift(-rnd(1, 21)) });
      break;
    }
    case "high":
    case "mid":
    case "low":
    case "late":
    case "hospital": {
      a.cohort = "lactating";
      a.base_lactation = rnd(1, 5);
      a.birth_date = isoShift(-rnd(750, 2200));
      const dimRange: Record<string, [number, number]> = {
        high: [40, 120],
        mid: [120, 220],
        low: [220, 320],
        late: [320, 450],
        hospital: [30, 250],
      };
      const [lo, hi] = dimRange[kind];
      const dim = rnd(lo, hi);
      events.push({ code: 1, date: isoShift(-dim) });
      // Force MILK into the right band for the chosen kind.
      const milkRange: Record<string, [number, number]> = {
        high: [35, 48],
        mid: [25, 34],
        low: [15, 24],
        late: [6, 14],
        hospital: [20, 38],
      };
      const [my, mY] = milkRange[kind];
      events.push({
        code: MILK_EC,
        date: today,
        payload: { yield: rnd(my, mY) },
      });
      if (kind === "hospital") {
        events.push({
          code: 203,
          date: today,
          payload: { kind: "HEAT", note: "demo" },
        });
      }
      break;
    }
  }
  return { natural_key: key, attrs: a, events };
}

export async function seedDemoData(): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const admin = createAdminClient();
  const today = isoShift(0);
  // Per-run prefix so re-seeding never collides with a previous run.
  const runId = Date.now().toString(36).slice(-5).toUpperCase();
  const pad = (n: number) => String(n).padStart(4, "0");

  const animals: DemoAnimal[] = [];
  let i = 0;
  for (const [kind, count] of Object.entries(DEFAULT_MIX)) {
    for (let k = 0; k < count; k++) {
      i++;
      animals.push(
        gen(kind as keyof typeof DEFAULT_MIX, `DEMO-${runId}-${pad(i)}`, today),
      );
    }
  }

  // Insert subjects, then events, in chunks.
  const subjectRows = animals.map((a) => ({
    organization_id: orgId,
    subject_type: "animal",
    natural_key: a.natural_key,
    name: null,
    attrs: a.attrs,
    created_by: user.id,
  }));
  const inserted: { id: string; natural_key: string }[] = [];
  for (let off = 0; off < subjectRows.length; off += 500) {
    const chunk = subjectRows.slice(off, off + 500);
    const { data, error } = await admin
      .from("subjects")
      .insert(chunk)
      .select("id, natural_key");
    if (error) return { error: error.message };
    inserted.push(...((data ?? []) as { id: string; natural_key: string }[]));
  }
  const idOf = new Map(inserted.map((r) => [r.natural_key, r.id] as const));

  const eventRows: Record<string, unknown>[] = [];
  for (const a of animals) {
    const sid = idOf.get(a.natural_key);
    if (!sid) continue;
    for (const e of a.events) {
      eventRows.push({
        organization_id: orgId,
        subject_id: sid,
        event_code: e.code,
        event_date: e.date,
        payload: { ...(e.payload ?? {}), demo: true },
        source: "system",
        created_by: user.id,
      });
    }
  }
  for (let off = 0; off < eventRows.length; off += 1000) {
    const chunk = eventRows.slice(off, off + 1000);
    const { error } = await admin.from("events").insert(chunk);
    if (error) return { error: error.message };
  }

  revalidatePath(PathHousing);
  revalidatePath("/records");
  return {
    success: true,
    info: `${animals.length} demo animals + ${eventRows.length} events seeded.`,
  };
}

export async function clearDemoData(): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const admin = createAdminClient();

  // Events are append-only (DB trigger) and subjects with events
  // can't be deleted (FK). So "clear" = ARCHIVE the demo subjects;
  // their history stays as immutable record. Active-only queries
  // filter them out and the herd looks clean.
  const { data: demoSubs, error: dErr } = await admin
    .from("subjects")
    .select("id")
    .eq("organization_id", orgId)
    .eq("subject_type", "animal")
    .eq("attrs->>demo", "true");
  if (dErr) return { error: dErr.message };
  const ids = (demoSubs ?? []).map((s) => s.id);
  if (ids.length) {
    for (let off = 0; off < ids.length; off += 500) {
      const chunk = ids.slice(off, off + 500);
      const { error } = await admin
        .from("subjects")
        .update({ status: "archived" })
        .eq("organization_id", orgId)
        .in("id", chunk);
      if (error) return { error: error.message };
    }
  }

  // Strip the demo_due attr that the older lightweight backfill
  // wrote onto REAL subjects (subject attrs are mutable; events the
  // backfill also wrote stay as history per append-only).
  const { data: dued } = await admin
    .from("subjects")
    .select("id, attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "animal")
    .eq("attrs->>demo_due", "true");
  for (const s of dued ?? []) {
    const a = (s.attrs ?? {}) as Record<string, unknown>;
    delete a.due_date;
    delete a.demo_due;
    await admin
      .from("subjects")
      .update({ attrs: a })
      .eq("id", s.id)
      .eq("organization_id", orgId);
  }

  revalidatePath(PathHousing);
  revalidatePath("/records");
  return {
    success: true,
    info: `Archived ${ids.length} demo animals (event history kept).`,
  };
}

// ARCHIVE every animal (imported, demo, or hand-entered) in this org.
// Events are append-only (DB trigger) so we never delete history —
// archived subjects are filtered out of active queries instead. Org-
// scoped, gated on a literal "ARCHIVE" confirm string. Pens, supply,
// strategy, settings, audit log are NOT touched.
export async function wipeAllAnimals(confirm: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  if (confirm !== "ARCHIVE")
    return { error: "Type ARCHIVE (exactly) to confirm." };

  const admin = createAdminClient();
  const { data: subs, error: sErr } = await admin
    .from("subjects")
    .select("id")
    .eq("organization_id", orgId)
    .eq("subject_type", "animal")
    .neq("status", "archived");
  if (sErr) return { error: sErr.message };
  const ids = (subs ?? []).map((s) => s.id);
  if (!ids.length)
    return { success: true, info: "No active animals to archive." };

  for (let off = 0; off < ids.length; off += 500) {
    const chunk = ids.slice(off, off + 500);
    const { error } = await admin
      .from("subjects")
      .update({ status: "archived" })
      .eq("organization_id", orgId)
      .in("id", chunk);
    if (error) return { error: error.message };
  }

  revalidatePath(PathHousing);
  revalidatePath("/records");
  return { success: true, info: `Archived ${ids.length} animals.` };
}
