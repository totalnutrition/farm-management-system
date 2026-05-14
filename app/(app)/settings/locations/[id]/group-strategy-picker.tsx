"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  CopyIcon,
  Delete02Icon,
  Sparkles,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  applyGroupStrategy,
  applyGroupStrategyAndAdvance,
  duplicateStrategyPreset,
  saveCurrentAsNewStrategy,
  deleteOrgStrategyPreset,
} from "./groups-actions";

export type StrategyPresetCard = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  recommended_min_lactating: number | null;
  recommended_max_lactating: number | null;
  group_labels: string[];
  /** True if this preset is org-owned (cloned / saved); false for seeds. */
  is_org_owned?: boolean;
};

export function GroupStrategyPicker({
  locationId,
  presets,
  currentSlug,
  mode,
  nextStep,
}: {
  locationId: string;
  presets: StrategyPresetCard[];
  /** Suggested-for-this-herd-size slug — accepted but no longer displayed. */
  suggestedSlug?: string;
  currentSlug: string | null;
  mode: "standalone" | "wizard";
  nextStep?: string;
}) {
  const [selected, setSelected] = useState<string>(currentSlug ?? presets[0]?.slug ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [dupSource, setDupSource] = useState<StrategyPresetCard | null>(null);
  const [dupName, setDupName] = useState("");
  const [saveCurrentOpen, setSaveCurrentOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  const apply = () => {
    if (!selected) return;
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
      toast.success("Strategy applied. Cows will be regrouped on the next review.");
      router.refresh();
    });
  };

  const onDuplicate = (p: StrategyPresetCard) => {
    setDupSource(p);
    setDupName(`${p.name} — copy`);
  };
  const confirmDuplicate = () => {
    if (!dupSource) return;
    startTransition(async () => {
      const r = await duplicateStrategyPreset({
        source_preset_id: dupSource.id,
        new_name: dupName,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Strategy "${dupName}" created. Edit its rules in the table below after applying.`);
      setDupSource(null);
      setDupName("");
      router.refresh();
    });
  };

  const onSaveCurrent = () => {
    setSaveCurrentOpen(true);
    setSaveName("My custom strategy");
  };
  const confirmSaveCurrent = () => {
    startTransition(async () => {
      const r = await saveCurrentAsNewStrategy({
        location_id: locationId,
        new_name: saveName,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Strategy "${saveName}" saved.`);
      setSaveCurrentOpen(false);
      setSaveName("");
      router.refresh();
    });
  };

  const onDelete = (p: StrategyPresetCard) => {
    if (!confirm(`Delete strategy "${p.name}"? Locations still using it keep their groups; only the template goes.`)) return;
    startTransition(async () => {
      const r = await deleteOrgStrategyPreset({ preset_id: p.id });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Strategy deleted.");
      router.refresh();
    });
  };

  const seedPresets = presets.filter((p) => !p.is_org_owned);
  const orgPresets = presets.filter((p) => p.is_org_owned);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Pick any strategy. Click <span className="font-medium">Duplicate</span>{" "}
          on a card to clone it into an editable one. Or save the location&apos;s
          current groups as a new strategy to reuse elsewhere.
        </p>
        {mode === "standalone" && currentSlug ? (
          <Button type="button" size="sm" variant="outline" onClick={onSaveCurrent}>
            <HugeiconsIcon icon={Sparkles} />
            Save current as new strategy
          </Button>
        ) : null}
      </div>

      {orgPresets.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Your strategies
          </h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {orgPresets.map((p) => (
              <PresetCard
                key={p.id}
                p={p}
                active={selected === p.slug}
                onSelect={() => setSelected(p.slug)}
                onDuplicate={() => onDuplicate(p)}
                onDelete={() => onDelete(p)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Built-in strategies
        </h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {seedPresets.map((p) => (
            <PresetCard
              key={p.id}
              p={p}
              active={selected === p.slug}
              onSelect={() => setSelected(p.slug)}
              onDuplicate={() => onDuplicate(p)}
            />
          ))}
        </div>
      </section>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" onClick={apply} disabled={isPending || !selected}>
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
        with the preset&apos;s groups and default rules. Existing
        location-level rule customizations on those groups are overwritten.
      </p>

      <Dialog open={!!dupSource} onOpenChange={(o) => !o && setDupSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate strategy</DialogTitle>
            <DialogDescription>
              Creates an editable copy of{" "}
              <span className="font-medium text-foreground">
                {dupSource?.name}
              </span>{" "}
              under your organization. Rules can be edited after the new
              strategy is applied to a location.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={dupName}
            onChange={(e) => setDupName(e.target.value)}
            placeholder="Name"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDupSource(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmDuplicate} disabled={isPending || !dupName.trim()}>
              {isPending ? "Creating…" : "Create copy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveCurrentOpen} onOpenChange={setSaveCurrentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save current groups as strategy</DialogTitle>
            <DialogDescription>
              Snapshots this location&apos;s current groups + rules into a new
              strategy you can apply elsewhere.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Name"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveCurrentOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmSaveCurrent} disabled={isPending || !saveName.trim()}>
              {isPending ? "Saving…" : "Save strategy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PresetCard({
  p,
  active,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  p: StrategyPresetCard;
  active: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={`text-left ring-1 p-3 flex flex-col gap-1.5 transition-colors cursor-pointer ${
        active
          ? "ring-primary bg-primary/5"
          : "ring-foreground/10 hover:ring-foreground/20 bg-background"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{p.name}</h3>
          {active ? (
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              className="size-3.5 text-primary"
            />
          ) : null}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {herdRange(p.recommended_min_lactating, p.recommended_max_lactating)}
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
      <div
        className="flex items-center gap-1 mt-1"
        onClick={(e) => e.stopPropagation()}
      >
        <Button type="button" size="sm" variant="ghost" onClick={onDuplicate}>
          <HugeiconsIcon icon={CopyIcon} />
          Duplicate
        </Button>
        {onDelete ? (
          <Button type="button" size="sm" variant="ghost" onClick={onDelete}>
            <HugeiconsIcon icon={Delete02Icon} />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function herdRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return "Any size";
  if (max === null) return `${min}+ cows`;
  if (min === null || min === 0) return `< ${max + 1} cows`;
  return `${min}–${max} cows`;
}
