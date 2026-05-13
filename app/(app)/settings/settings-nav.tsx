"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import type { SettingsGroup } from "@/lib/settings-registry";

export function SettingsNav({ groups }: { groups: SettingsGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-1">
          <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {group.label}
          </div>
          <ul className="flex flex-col">
            {group.items.map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(item.href + "/");
              return (
                <li key={item.slug}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-accent/60",
                    )}
                  >
                    {item.icon ? (
                      <HugeiconsIcon
                        icon={item.icon}
                        className="size-4 shrink-0"
                      />
                    ) : null}
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
