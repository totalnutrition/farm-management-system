import { redirect } from "next/navigation";

// Housing was merged into the Herd hub at /records (Animals · Groups
// · Pens · Barns). This redirect keeps existing links/bookmarks
// working.
export default async function HousingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  // Barns folded into the Pens tab; old "?tab=barns" links land there.
  const map: Record<string, string> = {
    groups: "/records?tab=groups",
    pens: "/records?tab=pens",
    barns: "/records?tab=pens",
  };
  redirect(map[tab ?? ""] ?? "/records");
}
