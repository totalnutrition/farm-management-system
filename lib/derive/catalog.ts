// The single typed catalog of queryable items. Pure (no React, no DB)
// so the Query bar, Grouping editor AND the server-side query guard
// all derive from one source. DairyComp model: every item has a kind,
// and the grammar restricts where each kind may appear —
//   • numeric  → can be summarized / compared / ordered
//   • category → can be grouped (BY) and matched by code
//   • date     → compared as dates
//   • flag     → YES/no
// "Everything in everything" is fixed by filtering each slot to the
// kinds that are actually valid there.

export const ITEM_GROUPS = [
  "Identity & location",
  "Reproduction",
  "Lactation",
  "Milk yield",
  "Components & quality",
  "Health & flags",
  "Feed & intake",
] as const;
export type ItemGroup = (typeof ITEM_GROUPS)[number];

export type FieldKind = "num" | "enum" | "bool" | "date" | "text";

const ENUM_OPTS: Record<string, string[]> = {
  RPRO: [
    "VIRGIN",
    "DNB",
    "FRESH",
    "OPEN",
    "BRED",
    "PREG",
    "DRY",
    "SLD/DIE",
    "BULLCAF",
  ],
  LCTGP: ["H", "1", "2", "3+"],
  ABT: ["ABT?"],
};
const BOOL_ITEMS = new Set(["FLAGGED", "DNSHIP", "DNSELL"]);
const TEXT_ITEMS = new Set([
  "ID",
  "PEN",
  "ATTN",
  "BREED",
  "EID",
  "DAM",
  "SIRE",
  "SSIRE",
  "REG",
  "RSN",
]);
const DATE_ITEMS = new Set([
  "FDAT",
  "DDAT",
  "MWHOLD",
  "BWHOLD",
  "LTDAT",
  "ENTRY",
]);

export function kindOf(item: string): FieldKind {
  if (item in ENUM_OPTS) return "enum";
  if (BOOL_ITEMS.has(item)) return "bool";
  if (DATE_ITEMS.has(item)) return "date";
  if (TEXT_ITEMS.has(item)) return "text";
  return "num";
}

export const optionsOf = (item: string): string[] =>
  BOOL_ITEMS.has(item) ? ["YES", "no"] : (ENUM_OPTS[item] ?? []);

// --- DairyComp slot rules -------------------------------------------
// SUM/ECON only takes numeric items.
export const isAggregatable = (item: string) => kindOf(item) === "num";

// BY (group) only takes category items: coded/flag fields plus the
// low-cardinality categoricals DC groups on (pen, parity, attention).
// Continuous numbers & dates are NOT groupable (they'd shatter into
// one-row buckets) — this is the core "no distinction" fix.
const GROUPABLE_EXTRA = new Set(["PEN", "LACT", "ATTN", "BREED"]);
export const isGroupable = (item: string) =>
  ["enum", "bool"].includes(kindOf(item)) || GROUPABLE_EXTRA.has(item);

// Short type badge shown in the field picker so numeric vs coded vs
// date vs flag is visually obvious.
export const tagOf = (item: string): string =>
  ({ num: "#", enum: "code", bool: "y/n", date: "date", text: "txt" })[
    kindOf(item)
  ];

export type CatalogItem = {
  value: string;
  label: string;
  group: ItemGroup;
  kind: FieldKind;
};

const RAW: { value: string; label: string; group: ItemGroup }[] = [
  { value: "ID", label: "Animal ID", group: "Identity & location" },
  { value: "PEN", label: "Pen (physical)", group: "Identity & location" },
  { value: "BREED", label: "Breed", group: "Identity & location" },
  { value: "EID", label: "Electronic ID", group: "Identity & location" },
  { value: "DAM", label: "Dam ID", group: "Identity & location" },
  { value: "SIRE", label: "Sire ID", group: "Identity & location" },
  { value: "REG", label: "Registration", group: "Identity & location" },
  { value: "RSN", label: "Entry reason", group: "Identity & location" },
  { value: "ENTRY", label: "Entry date", group: "Identity & location" },
  { value: "AGE", label: "Age (months)", group: "Identity & location" },
  { value: "AGED", label: "Age (days)", group: "Identity & location" },
  { value: "WT", label: "Weight (kg)", group: "Identity & location" },
  { value: "RPRO", label: "Repro status", group: "Reproduction" },
  { value: "SSIRE", label: "Service sire", group: "Reproduction" },
  { value: "ABT", label: "Abortion vet flag", group: "Reproduction" },
  { value: "DCC", label: "Days carrying calf", group: "Reproduction" },
  { value: "DUE", label: "Days to due", group: "Reproduction" },
  { value: "DSLH", label: "Days since last heat", group: "Reproduction" },
  { value: "DOPN", label: "Days open", group: "Reproduction" },
  { value: "LACT", label: "Lactation #", group: "Lactation" },
  { value: "DIM", label: "Days in milk", group: "Lactation" },
  { value: "DDRY", label: "Days dry", group: "Lactation" },
  { value: "FDAT", label: "Fresh date", group: "Lactation" },
  { value: "DDAT", label: "Dry date", group: "Lactation" },
  { value: "LCTGP", label: "Lactation group", group: "Lactation" },
  { value: "MILK", label: "Milk today (kg)", group: "Milk yield" },
  { value: "MAVG", label: "Milk avg 7d (kg)", group: "Milk yield" },
  { value: "PMILK", label: "Milk prev day (kg)", group: "Milk yield" },
  { value: "PEAK", label: "Peak milk (kg)", group: "Milk yield" },
  {
    value: "MTOT",
    label: "Milk lactation total (kg)",
    group: "Milk yield",
  },
  { value: "PCTF", label: "Fat %", group: "Components & quality" },
  { value: "PCTP", label: "Protein %", group: "Components & quality" },
  { value: "SNF", label: "SNF %", group: "Components & quality" },
  { value: "TS", label: "Total solids %", group: "Components & quality" },
  { value: "SCC", label: "SCC (1000s)", group: "Components & quality" },
  { value: "LS", label: "Linear score", group: "Components & quality" },
  {
    value: "DNSHIP",
    label: "Do-not-ship (YES/no)",
    group: "Health & flags",
  },
  {
    value: "DNSELL",
    label: "Do-not-sell meat (YES/no)",
    group: "Health & flags",
  },
  { value: "MWHOLD", label: "Milk withhold until", group: "Health & flags" },
  { value: "BWHOLD", label: "Meat withhold until", group: "Health & flags" },
  { value: "LTDAT", label: "Last treatment date", group: "Health & flags" },
  { value: "FLAGGED", label: "Flagged (YES/no)", group: "Health & flags" },
  { value: "ATTN", label: "Flagged for", group: "Health & flags" },
  { value: "FEEDKG", label: "Feed delivered (kg)", group: "Feed & intake" },
  { value: "REFKG", label: "Feed refused (kg)", group: "Feed & intake" },
  { value: "FEEDCOST", label: "Feed cost", group: "Feed & intake" },
  { value: "SHRINK", label: "Feed shrink %", group: "Feed & intake" },
];

export const ITEMS: CatalogItem[] = RAW.map((i) => ({
  ...i,
  kind: kindOf(i.value),
}));

export const labelOf = (v: string) =>
  ITEMS.find((i) => i.value === v)?.label ?? v;

export const OPS: { value: string; label: string }[] = [
  { value: "=", label: "is" },
  { value: "<>", label: "is not" },
  { value: ">", label: "more than" },
  { value: ">=", label: "at least" },
  { value: "<", label: "less than" },
  { value: "<=", label: "at most" },
  { value: "between", label: "between" },
];
export const opLabel = (v: string) =>
  OPS.find((o) => o.value === v)?.label ?? v;

// Only numeric fields support ordered / between operators; everything
// else is is / is not (string equality the engine can actually do).
export function opsFor(item: string): { value: string; label: string }[] {
  return kindOf(item) === "num"
    ? OPS
    : OPS.filter((o) => o.value === "=" || o.value === "<>");
}
