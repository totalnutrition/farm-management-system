"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { range, type Atom, type CmpOp, type Predicate } from "@/lib/derive/query";

// The single shared catalog of items the engine can compute. Both the
// Query bar and the Grouping rule editor use this — one generator.
export const ITEMS: { value: string; label: string }[] = [
  { value: "ID", label: "Animal ID" },
  { value: "PEN", label: "Pen (physical)" },
  { value: "RPRO", label: "Repro status" },
  { value: "RC", label: "Repro code (#)" },
  { value: "LACT", label: "Lactation #" },
  { value: "DIM", label: "Days in milk" },
  { value: "DDRY", label: "Days dry" },
  { value: "AGE", label: "Age (months)" },
  { value: "DCC", label: "Days carrying calf" },
  { value: "DUE", label: "Days to due" },
  { value: "DSLH", label: "Days since last heat" },
  { value: "DOPN", label: "Days open" },
  { value: "FDAT", label: "Fresh date" },
  { value: "DDAT", label: "Dry date" },
  { value: "MILK", label: "Milk today (kg)" },
  { value: "MAVG", label: "Milk avg 7d (kg)" },
  { value: "PMILK", label: "Milk prev day (kg)" },
  { value: "PEAK", label: "Peak milk (kg)" },
  { value: "MTOT", label: "Milk lactation total (kg)" },
  { value: "PCTF", label: "Fat %" },
  { value: "PCTP", label: "Protein %" },
  { value: "SCC", label: "SCC (1000s)" },
  { value: "LS", label: "Linear score" },
  { value: "LCTGP", label: "Lactation group" },
  { value: "DNSHIP", label: "Do-not-ship (YES/no)" },
  { value: "DNSELL", label: "Do-not-sell meat (YES/no)" },
  { value: "MWHOLD", label: "Milk withhold until" },
  { value: "LTDAT", label: "Last treatment date" },
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
          <Select
            value={c.item}
            onValueChange={(v) =>
              setConds(
                conds.map((x, i) => (i === idx ? { ...x, item: v } : x)),
              )
            }
          >
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue placeholder="field" />
            </SelectTrigger>
            <SelectContent>
              {ITEMS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              {OPS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-7 w-16 text-xs"
            placeholder="value"
            value={c.value}
            onChange={(e) =>
              setConds(
                conds.map((x, i) =>
                  i === idx ? { ...x, value: e.target.value } : x,
                ),
              )
            }
          />
          {c.op === "between" && (
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
