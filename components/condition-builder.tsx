"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldPicker } from "@/components/field-picker";
import { range, type Atom, type CmpOp, type Predicate } from "@/lib/derive/query";

// The single shared catalog of items the engine can compute. Both the
// Query bar and the Grouping rule editor use this — one generator.
// `group` drives the sectioned, searchable field picker.
export const ITEM_GROUPS = [
  "Identity & location",
  "Reproduction",
  "Lactation",
  "Milk yield",
  "Components & quality",
  "Health & flags",
] as const;
export type ItemGroup = (typeof ITEM_GROUPS)[number];

export const ITEMS: { value: string; label: string; group: ItemGroup }[] = [
  { value: "ID", label: "Animal ID", group: "Identity & location" },
  { value: "PEN", label: "Pen (physical)", group: "Identity & location" },
  { value: "AGE", label: "Age (months)", group: "Identity & location" },
  { value: "RPRO", label: "Repro status", group: "Reproduction" },
  { value: "RC", label: "Repro code (#)", group: "Reproduction" },
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
  { value: "MTOT", label: "Milk lactation total (kg)", group: "Milk yield" },
  { value: "PCTF", label: "Fat %", group: "Components & quality" },
  { value: "PCTP", label: "Protein %", group: "Components & quality" },
  { value: "SNF", label: "SNF %", group: "Components & quality" },
  { value: "TS", label: "Total solids %", group: "Components & quality" },
  { value: "SCC", label: "SCC (1000s)", group: "Components & quality" },
  { value: "LS", label: "Linear score", group: "Components & quality" },
  { value: "DNSHIP", label: "Do-not-ship (YES/no)", group: "Health & flags" },
  {
    value: "DNSELL",
    label: "Do-not-sell meat (YES/no)",
    group: "Health & flags",
  },
  { value: "MWHOLD", label: "Milk withhold until", group: "Health & flags" },
  { value: "LTDAT", label: "Last treatment date", group: "Health & flags" },
  { value: "FLAGGED", label: "Flagged (YES/no)", group: "Health & flags" },
  { value: "ATTN", label: "Flagged for", group: "Health & flags" },
];
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

// Field types. The engine only does string-equality for =/<> and
// numeric ordering for >/<; categorical & date fields therefore get a
// constrained operator set and a proper value control instead of a
// free numeric box (which produced nonsense like "Repro status > 3").
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
};
const BOOL_ITEMS = new Set(["FLAGGED", "DNSHIP", "DNSELL"]);
const TEXT_ITEMS = new Set(["ID", "PEN", "ATTN"]);
const DATE_ITEMS = new Set(["FDAT", "DDAT", "MWHOLD", "LTDAT"]);

export function kindOf(item: string): FieldKind {
  if (item in ENUM_OPTS) return "enum";
  if (BOOL_ITEMS.has(item)) return "bool";
  if (DATE_ITEMS.has(item)) return "date";
  if (TEXT_ITEMS.has(item)) return "text";
  return "num";
}
export const optionsOf = (item: string): string[] =>
  BOOL_ITEMS.has(item) ? ["YES", "no"] : (ENUM_OPTS[item] ?? []);

// Only number fields support ordered / between operators; everything
// else is is / is not (string equality the engine can actually do).
export function opsFor(item: string): { value: string; label: string }[] {
  return kindOf(item) === "num"
    ? OPS
    : OPS.filter((o) => o.value === "=" || o.value === "<>");
}

export type Cond = {
  item: string;
  op: string;
  value: string;
  value2: string;
};
export type ConditionValue = { conds: Cond[]; matchAny: boolean };

const num = (s: string) =>
  s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : s;

export function condsToPredicate(
  v: ConditionValue,
): Predicate | undefined {
  const toAtom = (c: Cond): Atom =>
    c.op === "between"
      ? range(c.item, Number(c.value), Number(c.value2))
      : { kind: "cmp", item: c.item, op: c.op as CmpOp, value: num(c.value) };
  const valid = v.conds.filter(
    (c) =>
      c.item && c.value !== "" && (c.op !== "between" || c.value2 !== ""),
  );
  if (valid.length === 0) return undefined;
  return v.matchAny ? valid.map((c) => [toAtom(c)]) : [valid.map(toAtom)];
}

export function describeConds(v: ConditionValue): string {
  const valid = v.conds.filter((c) => c.item && c.value !== "");
  if (!valid.length) return "";
  const join = v.matchAny ? " or " : " and ";
  return (
    " where " +
    valid
      .map((c) =>
        c.op === "between"
          ? `${labelOf(c.item)} is between ${c.value} and ${c.value2}`
          : `${labelOf(c.item)} ${opLabel(c.op)} ${c.value}`,
      )
      .join(join)
  );
}

export function ConditionBuilder({
  value,
  onChange,
}: {
  value: ConditionValue;
  onChange: (v: ConditionValue) => void;
}) {
  const { conds, matchAny } = value;
  const setConds = (next: Cond[]) => onChange({ conds: next, matchAny });

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
      <span className="text-xs text-muted-foreground">where</span>
      {conds.length === 0 && (
        <span className="text-xs text-muted-foreground/70">all</span>
      )}
      {conds.map((c, idx) => (
        <div key={idx} className="flex items-center gap-1">
          {idx > 0 && (
            <button
              type="button"
              onClick={() => onChange({ conds, matchAny: !matchAny })}
              className="px-0.5 text-[11px] font-medium text-muted-foreground hover:underline"
            >
              {matchAny ? "or" : "and"}
            </button>
          )}
          <FieldPicker
            items={ITEMS}
            groups={ITEM_GROUPS}
            value={c.item}
            onChange={(v) =>
              setConds(
                conds.map((x, i) =>
                  // changing the field resets op/value so a stale
                  // numeric operator can't linger on a categorical field
                  i === idx
                    ? { item: v, op: "=", value: "", value2: "" }
                    : x,
                ),
              )
            }
            placeholder="field"
            triggerClassName="w-[140px]"
          />
          <Select
            value={c.op}
            onValueChange={(v) =>
              setConds(
                conds.map((x, i) => (i === idx ? { ...x, op: v } : x)),
              )
            }
          >
            <SelectTrigger className="h-7 w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opsFor(c.item).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(() => {
            const k = kindOf(c.item);
            const set = (val: string) =>
              setConds(
                conds.map((x, i) =>
                  i === idx ? { ...x, value: val } : x,
                ),
              );
            if (k === "enum" || k === "bool")
              return (
                <Select
                  value={c.value || undefined}
                  onValueChange={set}
                >
                  <SelectTrigger className="h-7 w-[110px] text-xs">
                    <SelectValue placeholder="value" />
                  </SelectTrigger>
                  <SelectContent>
                    {optionsOf(c.item).map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            if (k === "date")
              return (
                <Input
                  type="date"
                  className="h-7 w-[140px] text-xs"
                  value={c.value}
                  onChange={(e) => set(e.target.value)}
                />
              );
            return (
              <Input
                className={
                  "h-7 text-xs " + (k === "text" ? "w-28" : "w-16")
                }
                placeholder="value"
                value={c.value}
                onChange={(e) => set(e.target.value)}
              />
            );
          })()}
          {c.op === "between" && kindOf(c.item) === "num" && (
            <Input
              className="h-7 w-16 text-xs"
              placeholder="and"
              value={c.value2}
              onChange={(e) =>
                setConds(
                  conds.map((x, i) =>
                    i === idx ? { ...x, value2: e.target.value } : x,
                  ),
                )
              }
            />
          )}
          <button
            type="button"
            aria-label="remove condition"
            onClick={() => setConds(conds.filter((_, i) => i !== idx))}
            className="px-0.5 text-muted-foreground hover:text-destructive"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setConds([
            ...conds,
            { item: "", op: "=", value: "", value2: "" },
          ])
        }
        className="rounded border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
      >
        + condition
      </button>
    </div>
  );
}
