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

// One typed catalog for the whole query/grouping surface. Definitions
// live in the pure lib module (shared with the server-side guard);
// re-exported here so existing import sites keep working.
export {
  ITEM_GROUPS,
  ITEMS,
  labelOf,
  OPS,
  opLabel,
  kindOf,
  optionsOf,
  opsFor,
  isAggregatable,
  isGroupable,
  tagOf,
  type ItemGroup,
  type FieldKind,
} from "@/lib/derive/catalog";

import {
  labelOf,
  opLabel,
  kindOf,
  optionsOf,
  OPS,
  ITEMS,
  ITEM_GROUPS,
  type FieldKind,
} from "@/lib/derive/catalog";

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

export type ExtraItem = {
  value: string;
  label: string;
  group: string;
  kind: FieldKind;
};

export function ConditionBuilder({
  value,
  onChange,
  extraItems = [],
  extraGroups = [],
}: {
  value: ConditionValue;
  onChange: (v: ConditionValue) => void;
  extraItems?: ExtraItem[];
  extraGroups?: readonly string[];
}) {
  const { conds, matchAny } = value;
  const setConds = (next: Cond[]) => onChange({ conds: next, matchAny });

  const allItems = extraItems.length ? [...ITEMS, ...extraItems] : ITEMS;
  const allGroups = extraGroups.length
    ? [...ITEM_GROUPS, ...extraGroups]
    : ITEM_GROUPS;
  const extraKind = new Map(extraItems.map((i) => [i.value, i.kind]));
  const kindAt = (item: string): FieldKind =>
    extraKind.get(item) ?? kindOf(item);
  const opsAt = (item: string) =>
    kindAt(item) === "num"
      ? OPS
      : OPS.filter((o) => o.value === "=" || o.value === "<>");
  const optionsAt = (item: string): string[] => {
    if (extraKind.has(item))
      return kindAt(item) === "bool" ? ["YES", "no"] : [];
    return optionsOf(item);
  };

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
            items={allItems}
            groups={allGroups}
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
              {opsAt(c.item).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(() => {
            const k = kindAt(c.item);
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
                    {optionsAt(c.item).map((o) => (
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
          {c.op === "between" && kindAt(c.item) === "num" && (
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
