"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  seedDemoData,
  clearDemoData,
  wipeAllAnimals,
} from "../grouping/actions";

// Herd-level admin actions: they create / archive ANIMALS, so they
// live next to "Add animal" and "Bulk import" — not on the Groups
// tab (which is just rules). Events are append-only; "Archive all"
// hides every animal from active views, history is kept.
export function AnimalsAdmin() {
  const router = useRouter();
  const [pending, start] = useTransition();

  const seed = () =>
    start(async () => {
      if (
        !window.confirm(
          "Seed a 500-animal demo herd that populates every group? All demo subjects/events are tagged and removable with 'Clear demo'.",
        )
      )
        return;
      const res = await seedDemoData();
      if (res.error) return void toast.error(res.error);
      toast.success(res.info ?? "Demo herd seeded.");
      router.refresh();
    });

  const clearDemo = () =>
    start(async () => {
      if (
        !window.confirm(
          "Archive all demo animals? Their event history is kept (events are append-only).",
        )
      )
        return;
      const res = await clearDemoData();
      if (res.error) return void toast.error(res.error);
      toast.success(res.info ?? "Demo data cleared.");
      router.refresh();
    });

  const archiveAll = () =>
    start(async () => {
      const typed = window.prompt(
        "ARCHIVE every animal in this org (imported, demo and hand-entered). Events are append-only history and are kept; archived animals are hidden from active views but remain in the ledger. Pens, supply, settings, audit log are untouched.\n\nType ARCHIVE to confirm:",
      );
      if (typed == null) return;
      const res = await wipeAllAnimals(typed);
      if (res.error) return void toast.error(res.error);
      toast.success(res.info ?? "Animals archived.");
      router.refresh();
    });

  return (
    <div className="flex items-center gap-1 text-xs">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={seed}
        title="Seed a 500-animal demo herd populating every group (tagged, reversible)"
      >
        Seed demo herd
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={clearDemo}>
        Clear demo
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={archiveAll}
        className="text-destructive hover:text-destructive"
        title="Archive every animal (events are append-only and kept as history)"
      >
        Archive all
      </Button>
    </div>
  );
}
