"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon } from "@hugeicons/core-free-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setActiveLocation } from "@/app/(app)/settings/locations/actions";

export type SwitcherLocation = {
  id: string;
  name: string;
  short_code: string;
};

export function LocationSwitcher({
  locations,
  activeId,
}: {
  locations: SwitcherLocation[];
  activeId: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (locations.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground">
        <HugeiconsIcon icon={Location01Icon} className="size-4" />
        <span>No locations yet</span>
      </div>
    );
  }

  if (locations.length === 1) {
    const only = locations[0];
    return (
      <div className="flex items-center gap-2 px-3 py-1 text-sm">
        <HugeiconsIcon icon={Location01Icon} className="size-4" />
        <span className="font-medium">{only.name}</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {only.short_code}
        </span>
      </div>
    );
  }

  const onChange = (next: string) => {
    if (next === activeId) return;
    startTransition(async () => {
      await setActiveLocation(next);
      router.refresh();
    });
  };

  return (
    <Select
      value={activeId ?? undefined}
      onValueChange={onChange}
      disabled={isPending}
    >
      <SelectTrigger className="h-8 min-w-[12rem] gap-2">
        <HugeiconsIcon icon={Location01Icon} className="size-4" />
        <SelectValue placeholder="Choose location" />
      </SelectTrigger>
      <SelectContent>
        {locations.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            <span className="font-medium">{l.name}</span>
            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
              {l.short_code}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
