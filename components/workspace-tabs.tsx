"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { workspaceForPath } from "@/lib/workspaces";
import { cn } from "@/lib/utils";

/**
 * In-page tab bar for the active workspace. Rendered once in the app
 * layout under the top bar. If the current route's workspace has no
 * tabs (or we're in Settings, which has its own subnav), renders
 * nothing.
 */
export function WorkspaceTabs() {
  const pathname = usePathname();
  const ws = workspaceForPath(pathname);
  if (!ws || ws.tabs.length === 0) return null;
  if (ws.key === "settings") return null;

  return (
    <nav
      aria-label={`${ws.label} sections`}
      className="flex items-center gap-1 overflow-x-auto border-b px-2 py-1"
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground pr-2 shrink-0">
        {ws.label}
      </span>
      {ws.tabs.map((t) => {
        const active =
          pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.slug}
            href={t.href}
            className={cn(
              "shrink-0 px-2.5 py-1 text-xs rounded",
              active
                ? "bg-foreground/10 font-medium"
                : "text-muted-foreground hover:bg-foreground/5",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
