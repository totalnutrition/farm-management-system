"use client";

import { useMemo, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  Tick02Icon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

type Item = { value: string; label: string; group: string };

// One shared field picker for the whole query/grouping surface: typed
// search + grouped, scrollable sections so the catalog stays usable as
// it grows. Single-select (value/onChange) or multi (values/onToggle).
export function FieldPicker({
  items,
  groups,
  value,
  onChange,
  values,
  onToggle,
  multiple = false,
  exclude,
  clearLabel,
  placeholder = "field",
  triggerClassName,
  align = "start",
}: {
  items: Item[];
  groups: readonly string[];
  value?: string;
  onChange?: (v: string) => void;
  values?: string[];
  onToggle?: (v: string) => void;
  multiple?: boolean;
  exclude?: (i: Item) => boolean;
  clearLabel?: string;
  placeholder?: string;
  triggerClassName?: string;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const pool = useMemo(
    () => (exclude ? items.filter((i) => !exclude(i)) : items),
    [items, exclude],
  );

  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (i: Item) =>
      !needle ||
      i.label.toLowerCase().includes(needle) ||
      i.value.toLowerCase().includes(needle);
    return groups
      .map((g) => ({
        group: g,
        items: pool.filter((i) => i.group === g && match(i)),
      }))
      .filter((s) => s.items.length > 0);
  }, [pool, groups, q]);

  const labelOf = (v: string) =>
    items.find((i) => i.value === v)?.label ?? v;

  const triggerText = multiple
    ? `${placeholder}${values && values.length ? ` · ${values.length}` : ""}`
    : value
      ? labelOf(value)
      : (clearLabel ?? placeholder);

  const choose = (v: string) => {
    if (multiple) {
      onToggle?.(v);
    } else {
      onChange?.(v);
      setOpen(false);
      setQ("");
    }
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
        if (o) setTimeout(() => inputRef.current?.focus(), 0);
      }}
    >
      <Popover.Trigger
        className={cn(
          "flex h-7 items-center justify-between gap-1 whitespace-nowrap rounded-md border border-input bg-transparent px-2 text-xs shadow-sm hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring",
          !multiple && !value && "text-muted-foreground",
          triggerClassName,
        )}
      >
        <span className="line-clamp-1">{triggerText}</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className="h-3.5 w-3.5 shrink-0 opacity-50"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={4}
          className="z-50 w-64 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          <div className="flex items-center gap-2 border-b px-2.5 py-2">
            <HugeiconsIcon
              icon={Search01Icon}
              className="h-3.5 w-3.5 shrink-0 opacity-50"
            />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type to filter…"
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              spellCheck={false}
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {clearLabel && !multiple && (
              <button
                type="button"
                onClick={() => choose("")}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-muted",
                  !value && "font-medium",
                )}
              >
                {clearLabel}
                {!value && (
                  <HugeiconsIcon icon={Tick02Icon} className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            {sections.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                No matching field.
              </p>
            )}
            {sections.map((s) => (
              <div key={s.group}>
                <p className="sticky top-0 bg-popover px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {s.group}
                </p>
                {s.items.map((i) => {
                  const active = multiple
                    ? !!values?.includes(i.value)
                    : value === i.value;
                  return (
                    <button
                      key={i.value}
                      type="button"
                      onClick={() => choose(i.value)}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-muted",
                        active && "font-medium",
                      )}
                    >
                      {i.label}
                      {active && (
                        <HugeiconsIcon
                          icon={Tick02Icon}
                          className="h-3.5 w-3.5 shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
