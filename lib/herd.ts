// Herd domain engine.
// Doctrine: the cow is the only entity; populations and worklists are
// QUERIES over the herd, never hand-maintained folders. These predicates
// run off the animals row's derived caches so Work/List stay chute-fast.

export type AnimalStatus = "active" | "sold" | "dead" | "culled";
export type AnimalSex = "female" | "male";

export type ReproStatus = "open" | "bred" | "pregnant" | "fresh" | "dry";

export type Animal = {
  id: string;
  tag: string;
  name: string | null;
  sex: AnimalSex;
  breed: string | null;
  birth_date: string | null;
  status: AnimalStatus;
  current_pen: string | null;
  lactation_number: number;
  repro_status: ReproStatus;
  last_calving_at: string | null;
  last_bred_at: string | null;
  last_event_at: string | null;
};

export type AnimalEvent = {
  id: string;
  animal_id: string;
  event_type: EventType;
  event_date: string;
  data: Record<string, unknown>;
  corrects_event_id: string | null;
  note: string | null;
  created_at: string;
};

export type HerdSettings = {
  voluntary_wait_days: number;
  gestation_days: number;
  preg_check_days: number;
  dry_off_days_before: number;
  kpi_repro_pr_target: number;
  kpi_max_days_open: number;
  kpi_max_dim_open: number;
};

export const DEFAULT_SETTINGS: HerdSettings = {
  voluntary_wait_days: 50,
  gestation_days: 280,
  preg_check_days: 35,
  dry_off_days_before: 60,
  kpi_repro_pr_target: 22,
  kpi_max_days_open: 130,
  kpi_max_dim_open: 150,
};

// Event vocabulary. Categories are LENSES over one stream (#1), not modules.
export const EVENT_TYPES = [
  "calving",
  "breeding",
  "heat",
  "preg_check",
  "dry_off",
  "move",
  "treatment",
  "vaccination",
  "health",
  "milk_test",
  "weight",
  "sale",
  "death",
  "cull",
  "note",
  "correction",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_LABEL: Record<EventType, string> = {
  calving: "Calving",
  breeding: "Breeding",
  heat: "Heat",
  preg_check: "Preg check",
  dry_off: "Dry off",
  move: "Move",
  treatment: "Treatment",
  vaccination: "Vaccination",
  health: "Health",
  milk_test: "Milk test",
  weight: "Weight",
  sale: "Sale",
  death: "Death",
  cull: "Cull",
  note: "Note",
  correction: "Correction",
};

export type EventCategory = "repro" | "health" | "milk" | "lifecycle";

export const EVENT_CATEGORY: Record<EventType, EventCategory> = {
  calving: "repro",
  breeding: "repro",
  heat: "repro",
  preg_check: "repro",
  dry_off: "repro",
  treatment: "health",
  vaccination: "health",
  health: "health",
  milk_test: "milk",
  weight: "milk",
  move: "lifecycle",
  sale: "lifecycle",
  death: "lifecycle",
  cull: "lifecycle",
  note: "lifecycle",
  correction: "lifecycle",
};

const MS_DAY = 86_400_000;

export function daysBetween(from: string | null, to = new Date()): number | null {
  if (!from) return null;
  const d = new Date(from + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((to.getTime() - d.getTime()) / MS_DAY);
}

export function daysInMilk(a: Animal): number | null {
  return daysBetween(a.last_calving_at);
}

// ---- Populations as queries (#2). A worklist = a predicate, not a table. ----

export type WorklistKey =
  | "fresh-check"
  | "breeding-eligible"
  | "preg-check-due"
  | "dry-off-due"
  | "open-over-target"
  | "all-active";

export type Worklist = {
  key: WorklistKey;
  name: string;
  hint: string;
  // The bulk action this list exists to drive (#3).
  primaryAction: EventType | null;
};

export const WORKLISTS: Worklist[] = [
  {
    key: "fresh-check",
    name: "Fresh cows to check",
    hint: "Calved in the last 10 days",
    primaryAction: "health",
  },
  {
    key: "breeding-eligible",
    name: "Breeding eligible",
    hint: "Open and past the voluntary wait",
    primaryAction: "breeding",
  },
  {
    key: "preg-check-due",
    name: "Preg checks due",
    hint: "Bred long enough to confirm",
    primaryAction: "preg_check",
  },
  {
    key: "dry-off-due",
    name: "Dry-off due",
    hint: "Pregnant and close to calving",
    primaryAction: "dry_off",
  },
  {
    key: "open-over-target",
    name: "Open over target",
    hint: "Monitor: open well past target DIM",
    primaryAction: "breeding",
  },
  {
    key: "all-active",
    name: "All active animals",
    hint: "The whole active herd",
    primaryAction: null,
  },
];

export function worklist(key: string): Worklist | null {
  return WORKLISTS.find((w) => w.key === key) ?? null;
}

export function matchesWorklist(
  a: Animal,
  key: WorklistKey,
  s: HerdSettings,
): boolean {
  if (a.status !== "active") return false;
  const dim = daysInMilk(a);
  const daysBred = daysBetween(a.last_bred_at);

  switch (key) {
    case "all-active":
      return true;
    case "fresh-check":
      return a.repro_status === "fresh" || (dim !== null && dim <= 10);
    case "breeding-eligible":
      return (
        a.repro_status === "open" &&
        dim !== null &&
        dim >= s.voluntary_wait_days
      );
    case "preg-check-due":
      return (
        a.repro_status === "bred" &&
        daysBred !== null &&
        daysBred >= s.preg_check_days
      );
    case "dry-off-due":
      return (
        a.repro_status === "pregnant" &&
        daysBred !== null &&
        daysBred >= s.gestation_days - s.dry_off_days_before
      );
    case "open-over-target":
      return (
        (a.repro_status === "open" || a.repro_status === "bred") &&
        dim !== null &&
        dim > s.kpi_max_dim_open
      );
    default:
      return false;
  }
}

export function countWorklists(
  animals: Animal[],
  s: HerdSettings,
): Record<WorklistKey, number> {
  const out = Object.fromEntries(
    WORKLISTS.map((w) => [w.key, 0]),
  ) as Record<WorklistKey, number>;
  for (const a of animals) {
    for (const w of WORKLISTS) {
      if (matchesWorklist(a, w.key, s)) out[w.key] += 1;
    }
  }
  return out;
}

// ---- Analyze: herd KPIs computed from the same rows (#7) ----

export type HerdKpis = {
  activeCount: number;
  inMilkCount: number;
  pregnantCount: number;
  openCount: number;
  avgDim: number | null;
  pctPregnant: number | null;
  openOverTarget: number;
};

export function herdKpis(animals: Animal[], s: HerdSettings): HerdKpis {
  const active = animals.filter((a) => a.status === "active");
  const inMilk = active.filter((a) => a.repro_status !== "dry");
  const pregnant = active.filter((a) => a.repro_status === "pregnant");
  const open = active.filter((a) => a.repro_status === "open");
  const dims = active
    .map((a) => daysInMilk(a))
    .filter((d): d is number => d !== null);
  const avgDim = dims.length
    ? Math.round(dims.reduce((x, y) => x + y, 0) / dims.length)
    : null;
  const breedable = active.filter(
    (a) => a.repro_status !== "dry" && a.repro_status !== "fresh",
  ).length;
  return {
    activeCount: active.length,
    inMilkCount: inMilk.length,
    pregnantCount: pregnant.length,
    openCount: open.length,
    avgDim,
    pctPregnant: breedable
      ? Math.round((pregnant.length / breedable) * 100)
      : null,
    openOverTarget: active.filter((a) =>
      matchesWorklist(a, "open-over-target", s),
    ).length,
  };
}
