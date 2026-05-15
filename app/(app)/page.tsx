import Link from "next/link";
import { requireUser } from "@/lib/supabase-auth";
import { loadHerd } from "@/lib/herd-data";
import { WORKLISTS, countWorklists } from "@/lib/herd";
import { listPath } from "@/lib/misc";

export const dynamic = "force-dynamic";
export const metadata = { title: "Work" };

// Doctrine #5: you log in and see the WORK, not a dashboard. Each card is a
// generated population (#2/#4) you open and act on in bulk (#3).
export default async function WorkPage() {
  await requireUser();
  const { animals, settings } = await loadHerd();
  const counts = countWorklists(animals, settings);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Today&apos;s work</h1>
        <p className="text-xs text-muted-foreground">{today}</p>
      </header>

      {animals.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No animals yet. Run migration{" "}
          <code className="font-mono">0003_herd_core.sql</code> and add cows to
          start the daily loop.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {WORKLISTS.map((w) => {
            const n = counts[w.key];
            return (
              <Link
                key={w.key}
                href={listPath(w.key)}
                className="flex flex-col gap-2 p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-heading text-sm font-medium">
                    {w.name}
                  </span>
                  <span
                    className={
                      n > 0
                        ? "font-mono text-2xl"
                        : "font-mono text-2xl text-muted-foreground"
                    }
                  >
                    {n}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{w.hint}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
