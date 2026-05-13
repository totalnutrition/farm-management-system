"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SettingsNav } from "./settings-nav";
import type { SettingsGroup } from "@/lib/settings-registry";

const UUID_RE = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const DRILLED_IN_PATTERNS: RegExp[] = [
  new RegExp(`^/settings/organization/[^/]+(/|$)`),
  new RegExp(`^/settings/locations/${UUID_RE}(/|$)`),
];

function isDrilledIn(pathname: string): boolean {
  return DRILLED_IN_PATTERNS.some((p) => p.test(pathname));
}

export function SettingsShell({
  groups,
  children,
}: {
  groups: SettingsGroup[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const drilledIn = isDrilledIn(pathname);

  if (drilledIn) {
    // Inner layout (Organization or Location sections) provides its own
    // sidebar. Render the children full-width so we don't stack two
    // sidebars side by side.
    return <div className="py-4">{children}</div>;
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:flex-row md:gap-8">
      <aside className="w-full shrink-0 md:w-56">
        <h1 className="px-2 pb-3 font-heading text-lg font-semibold">
          Settings
        </h1>
        <SettingsNav groups={groups} />
      </aside>
      <section className="min-w-0 flex-1">{children}</section>
    </div>
  );
}

/**
 * Small back-to-Settings link rendered by drilled-in inner layouts at
 * the top of their sidebar so the user always has a one-click escape.
 */
export function BackToSettingsLink() {
  return (
    <Link
      href="/settings"
      className="text-[10px] uppercase tracking-wide text-muted-foreground hover:underline"
    >
      ← Settings
    </Link>
  );
}
