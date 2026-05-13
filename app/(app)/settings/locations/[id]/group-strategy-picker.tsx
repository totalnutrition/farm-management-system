"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  applyGroupStrategy,
  applyGroupStrategyAndAdvance,
} from "./groups-actions";

export type StrategyPresetCard = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  recommended_min_lactating: number | null;
  recommended_max_lactating: number | null;
  group_labels: string[];
};

export function GroupStrategyPicker({
  locationId,
  presets,
  suggestedSlug,
  currentSlug,
  mode,
  nextStep,
}: {
  locationId: string;
  presets: StrategyPresetCard[];
  suggestedSlug: string;
  currentSlug: string | null;
  mode: "standalone" | "wizard";
  nextStep?: string;
}) {
  const [selected, setSelected] = useState<string>(currentSlug ?? suggestedSlug);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const apply = () => {
    startTransition(async () => {
      if (mode === "wizard" && nextStep) {
        try {
          await applyGroupStrategyAndAdvance({
            location_id: locationId,
            preset_slug: selected,
            nextStep,
          });
        } catch (err) {
          if (err instanceof Error && err.message.includes("NEXT_REDIRECT"))
            return;
          toast.error(err instanceof Error ? err.message : "Apply failed.");
        }
        return;
      }
      const result = await applyGroupStrategy({
        location_id: locationId,
        preset_slug: selected,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Group strategy applied.");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {presets.map((p) => {
          const active = selected === p.slug;
          const suggested = suggestedSlug === p.slug;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.slug)}
              className={`text-left ring-1 p-3 flex flex-col gap-1.5 transition-colors ${
                active
                  ? "ring-primary bg-primary/5"
                  : "ring-foreground/10 hover:ring-foreground/20 bg-background"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">{p.name}</h3>
                  {suggested ? (
                    <span className="text-[10px] font-medium text-primary">
                      Suggested
                    </span>
                  ) : null}
                  {active ? (
                    <HugeiconsIcon
                      icon={CheckmarkCircle02Icon}
                      className="size-3.5 text-primary"
                    />
                  ) : null}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {herdRange(
                    p.recommended_min_lactating,
                    p.recommended_max_lactating,
                  )}
                </span>
              </div>
              {p.description ? (
                <p className="text-xs text-muted-foreground">{p.description}</p>
              ) : null}
              {p.group_labels.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.group_labels.map((l) => (
                    <span
                      key={l}
                      className="text-[10px] font-mono px-1.5 py-0.5 bg-foreground/5 ring-1 ring-foreground/10"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" onClick={apply} disabled={isPending}>
          {mode === "wizard" ? (
            <>
              {isPending ? "Applying..." : "Apply & continue"}
              <HugeiconsIcon icon={ArrowRight01Icon} />
            </>
          ) : isPending ? (
            "Applying..."
          ) : (
            "Apply strategy"
          )}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Applying a strategy replaces this location&apos;s non-custom groups
        with the preset&apos;s groups and default rules.
      </p>
    </div>
  );
}

function herdRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return "Any size";
  if (max === null) return `${min}+ cows`;
  if (min === null || min === 0) return `< ${max + 1} cows`;
  return `${min}–${max} cows`;
}
