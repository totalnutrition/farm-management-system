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
};

export function SectionSubnav({
  items,
  ariaLabel,
}: {
  items: SectionNavItem[];
  ariaLabel: string;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={ariaLabel} className="flex flex-col gap-0.5">
      {items.map((item) => {
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
      })}
    </nav>
  );
}
