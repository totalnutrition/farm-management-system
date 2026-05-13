import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import { ComingSoon } from "@/components/coming-soon";

/**
 * Renders a per-event-type operational page placeholder, gated by:
 *  - no active location → NoLocationSelected
 *  - location doesn't manage livestock → module-disabled hint
 *  - otherwise → ComingSoon card with a short description
 *
 * This keeps every left-sidebar entry navigable while the real entry
 * UIs are built out. Each placeholder also surfaces a link back to
 * the Animals roster so users can do per-animal logging in the
 * meantime.
 */
export async function OperationalPlaceholder({
  title,
  description,
  note,
  livestockOnly = true,
}: {
  title: string;
  description: string;
  note?: string;
  livestockOnly?: boolean;
}) {
  const active = await getActiveLocation();
  if (!active) {
    return <NoLocationSelected title={`${title} — no location selected`} />;
  }
  if (livestockOnly && !active.manages_livestock) {
    return (
      <NoLocationSelected
        title={`${title} — livestock module disabled`}
        hint={`${active.name} doesn't have the Livestock module enabled. Turn it on in Settings → Locations.`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <ComingSoon title={title} description={description} note={note} />
      {livestockOnly ? (
        <>
          <p className="text-xs text-muted-foreground text-center">
            For now, log per-animal from the{" "}
            <Link href="/animals" className="underline underline-offset-2">
              Animals roster
            </Link>{" "}
            — open a cow and use her detail page&apos;s event log.
          </p>
          <div className="flex justify-center">
            <Button asChild size="sm" variant="outline">
              <Link href="/animals">Open Animals</Link>
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
