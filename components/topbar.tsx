"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  PlusSignIcon,
  TractorIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setCurrentLocation } from "@/app/(app)/locations/actions";
import { LocationKindView, type LocationKind } from "@/lib/types";
import { PathLocations } from "@/lib/misc";

export type TopbarLocation = {
  id: string;
  name: string;
  kind: LocationKind;
};

export function Topbar({
  locations,
  currentLocationId,
  canManageLocations,
}: {
  locations: TopbarLocation[];
  currentLocationId: string | null;
  canManageLocations: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const current =
    locations.find((l) => l.id === currentLocationId) ??
    (locations.length === 1 ? locations[0] : null);

  const switchTo = (id: string) =>
    startTransition(async () => {
      await setCurrentLocation(id);
      router.refresh();
    });

  return (
    <div className="sticky top-0 z-10 flex h-10 items-center justify-between border-b border-foreground/10 bg-background/80 px-2 backdrop-blur">
      <div className="flex items-center gap-1">
        <SidebarTrigger />
        {locations.length === 0 ? (
          <span className="px-2 text-xs text-muted-foreground">
            No location yet
          </span>
        ) : locations.length === 1 ? (
          <span className="flex items-center gap-1 px-2 text-xs">
            <HugeiconsIcon icon={TractorIcon} className="size-3.5" />
            <span className="font-medium">{locations[0].name}</span>
            <span className="text-muted-foreground">
              · {LocationKindView[locations[0].kind]}
            </span>
          </span>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                disabled={isPending}
              >
                <HugeiconsIcon icon={TractorIcon} className="size-3.5" />
                {current ? current.name : "Select location"}
                <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-56">
              <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">
                Locations
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {locations.map((l) => (
                <DropdownMenuItem
                  key={l.id}
                  onSelect={() => switchTo(l.id)}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="font-medium">{l.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {LocationKindView[l.kind]}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {canManageLocations ? (
        <Button
          asChild
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
        >
          <Link href={PathLocations}>
            <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
            {locations.length === 0 ? "Add a location" : "Manage locations"}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
