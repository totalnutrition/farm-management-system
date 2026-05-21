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
  const allowed = new Set(["barns", "pens", "groups"]);
  const target = allowed.has(tab ?? "") ? `/records?tab=${tab}` : "/records";
  redirect(target);
}
