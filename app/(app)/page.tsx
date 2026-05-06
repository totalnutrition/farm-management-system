import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, TractorIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireUser,
} from "@/lib/supabase-auth";
import { getCurrentLocationId } from "@/lib/current-location";
import { PathLocations, RoleSuperAdmin } from "@/lib/misc";
import { LocationKindView, type LocationKind } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser();
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);
  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "there";

  if (role !== RoleSuperAdmin && !orgId) {
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization. Contact your super admin.
      </p>
    );
  }

  const admin = createAdminClient();
  let q = admin
    .from("locations")
    .select("id, name, kind")
    .order("created_at", { ascending: true });
  if (role !== RoleSuperAdmin && orgId) q = q.eq("organization_id", orgId);
  const { data } = await q;
  const locations = (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as LocationKind,
  }));

  if (locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <HugeiconsIcon
          icon={TractorIcon}
          className="size-10 text-muted-foreground"
        />
        <h2 className="font-heading text-xl">Welcome, {name}</h2>
        <p className="max-w-md text-xs text-muted-foreground">
          Get started by creating your first location. A location is a farm
          site &mdash; it can be a Dairy or a Mixed operation today; Beef,
          Poultry, and Small Ruminants will unlock as their modules ship.
        </p>
        <Button asChild>
          <Link href={PathLocations}>
            <HugeiconsIcon icon={PlusSignIcon} />
            Add your first location
          </Link>
        </Button>
      </div>
    );
  }

  const currentId = await getCurrentLocationId();
  const current =
    locations.find((l) => l.id === currentId) ?? locations[0] ?? null;

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-0.5">
        <p className="text-xs text-muted-foreground">Welcome, {name}</p>
        <h1 className="font-heading text-2xl font-semibold">
          {current?.name ?? "Insight"}
        </h1>
        {current ? (
          <p className="text-xs text-muted-foreground">
            {LocationKindView[current.kind]}
          </p>
        ) : null}
      </header>
      <div className="rounded border border-dashed border-foreground/10 p-6 text-center text-xs text-muted-foreground">
        Resource modules &mdash; Land, Barns, Pens, Animals, Inventory &mdash;
        will appear here as they ship.
      </div>
    </div>
  );
}
