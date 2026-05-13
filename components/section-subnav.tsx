"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

type HugeIcon = Parameters<typeof HugeiconsIcon>[0]["icon"];

export type SectionNavItem = {
  href: string;
  label: string;
  description?: string;
  icon?: HugeIcon;
  shipped: boolean;
  group?: string;
};

export type SectionNavGroup = {
  key: string;
  label: string | null;
};

export function SectionSubnav({
  items,
  ariaLabel,
  groups,
}: {
  items: SectionNavItem[];
  ariaLabel: string;
  /**
   * If provided, items are bucketed into groups in the given order, each
   * group rendering its label as a small uppercase heading. Items not
   * matching any group fall to the end.
   */
  groups?: SectionNavGroup[];
}) {
  const pathname = usePathname();

  const renderItem = (item: SectionNavItem) => {
    const active = pathname === item.href;
    const className = cn(
      "flex items-start gap-2 px-2 py-1.5 text-xs",
      active && "bg-foreground/5 ring-1 ring-foreground/15",
      !active && "hover:bg-foreground/5",
      !item.shipped && "opacity-60",
    );
    return (
      <Link key={item.href} href={item.href} className={className}>
        {item.icon ? (
          <HugeiconsIcon
            icon={item.icon}
            className="size-3.5 shrink-0 mt-0.5"
          />
        ) : null}
        <span className="flex flex-col">
          <span className={active ? "font-medium" : ""}>{item.label}</span>
          {!item.shipped ? (
            <span className="text-[10px] text-muted-foreground">
              coming soon
            </span>
          ) : null}
        </span>
      </Link>
    );
  };

  if (!groups || groups.length === 0) {
    return (
      <nav aria-label={ariaLabel} className="flex flex-col gap-0.5">
        {items.map(renderItem)}
      </nav>
    );
  }

  const byGroup = new Map<string, SectionNavItem[]>();
  for (const g of groups) byGroup.set(g.key, []);
  for (const it of items) {
    const key = it.group ?? "__ungrouped";
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(it);
  }

  return (
    <nav aria-label={ariaLabel} className="flex flex-col gap-3">
      {groups.map((g) => {
        const groupItems = byGroup.get(g.key) ?? [];
        if (groupItems.length === 0) return null;
        return (
          <div key={g.key} className="flex flex-col gap-0.5">
            {g.label ? (
              <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {g.label}
              </div>
            ) : null}
            {groupItems.map(renderItem)}
          </div>
        );
      })}
    </nav>
  );
}
