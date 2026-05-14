import Link from "next/link";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import { computeHotList, type HotListCategory } from "@/lib/hot-list";

export const metadata = { title: "Hot list" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const active = await getActiveLocation();
  if (!active) {
    return (
      <NoLocationSelected
        title="No location selected"
        hint="Hot list is scoped to the active location."
      />
    );
  }
  if (!active.manages_livestock) {
    return (
      <NoLocationSelected
        title="Livestock module disabled"
        hint={`${active.name} doesn't have the Livestock module enabled.`}
      />
    );
  }

  const hotList = await computeHotList(active.id);

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Hot list</h1>
        <p className="text-xs text-muted-foreground">
          {active.name} ·{" "}
          {hotList.totalAlerts === 0
            ? "nothing demands attention right now. Cows whose facts change — calvings, DIM, dry-off, pregnancy — surface here automatically on every page load."
            : `${hotList.totalAlerts} item${hotList.totalAlerts === 1 ? "" : "s"} need attention. Click into any card to act on it.`}
        </p>
      </header>

      {hotList.categories.length === 0 ? (
        <div className="ring-1 ring-foreground/10 p-6 text-xs text-muted-foreground text-center">
          <span className="block text-sm text-primary mb-1">All clear.</span>
          The engine sees no pending group moves, no pen restripes, and no
          stocking imbalances on {active.name}.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {hotList.categories.map((c) => (
            <CategoryCard key={c.kind} category={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryCard({ category }: { category: HotListCategory }) {
  const ringTone =
    category.tone === "destructive"
      ? "ring-destructive/40 bg-destructive/5"
      : category.tone === "amber"
        ? "ring-amber-500/40 bg-amber-500/5"
        : "ring-foreground/10";
  const countTone =
    category.tone === "destructive"
      ? "text-destructive"
      : category.tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";

  return (
    <section className={`ring-1 ${ringTone} flex flex-col`}>
      <header className="px-3 py-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{category.title}</h3>
        <span className={`text-base font-medium tabular-nums ${countTone}`}>
          {category.count}
        </span>
      </header>
      <p className="px-3 pb-2 text-[10px] text-muted-foreground">
        {category.description}
      </p>
      <ul className="flex flex-col gap-px bg-foreground/5">
        {category.items.map((item, i) => (
          <li
            key={`${item.kind}-${i}`}
            className="bg-background px-3 py-1.5 flex items-baseline justify-between gap-2 text-xs"
          >
            <span className="font-medium truncate">{item.label}</span>
            {item.detail ? (
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {item.detail}
              </span>
            ) : null}
          </li>
        ))}
        {category.count > category.items.length ? (
          <li className="bg-background px-3 py-1.5 text-[10px] text-muted-foreground">
            + {category.count - category.items.length} more…
          </li>
        ) : null}
      </ul>
      <footer className="px-3 py-2 border-t border-foreground/10">
        <Link
          href={category.href}
          className="text-xs text-primary underline underline-offset-2"
        >
          View on {linkLabel(category.href)} →
        </Link>
      </footer>
    </section>
  );
}

function linkLabel(href: string): string {
  if (href === "/group-moves") return "Group moves";
  if (href === "/pen-moves") return "Pen moves";
  return href;
}
