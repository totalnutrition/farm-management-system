"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  CancelCircleIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import {
  applyPenMove,
  bulkApplyPenMoves,
  quickAddPen,
  quickAddBarn,
  updateBarnQuick,
  deleteBarnQuick,
  mergeBarnsQuick,
} from "./actions";
import { Input } from "@/components/ui/input";
import { BarnVisualizer } from "../settings/locations/[id]/barn-visualizer";
import type { Barn } from "@/lib/barns";
import type { Pen } from "@/lib/pens";

export type AnimalLite = {
  id: string;
  animal_id: string;
  name: string | null;
  parity: number;
  dim: number | null;
  current_pen_id: string | null;
  current_pen_name: string | null;
  suggested_pen_id: string | null;
  suggested_pen_name: string | null;
};

export type PenLite = {
  id: string;
  name: string;
  capacity_head: number | null;
  current_count: number;
  suggested_count: number;
};

export type BarnLite = {
  id: string;
  name: string;
  length_ft: number | null;
  width_ft: number | null;
  layout: string;
  alley_width_ft: number | null;
};

export type PenForVisualizer = {
  id: string;
  barn_id: string | null;
  group_id: string | null;
  group_label: string | null;
  name: string;
  capacity_head: number | null;
  bunk_running_ft: number | null;
  length_ft: number | null;
  width_ft: number | null;
  position_index: number;
  side: "left" | "right" | null;
};

export type GroupBlock = {
  group_id: string;
  group_label: string;
  pens: PenLite[];
  animals: AnimalLite[];
  /** Engine-driven target pen capacity for this group (head). */
  target_pen_cap: number;
  /** Engine-driven target bunk feet. */
  target_bunk_ft: number;
};

export function PenMovesClient({
  blocks,
  locationId,
  barns,
  pens,
  headcountByPen,
}: {
  blocks: GroupBlock[];
  locationId: string;
  barns: BarnLite[];
  pens: PenForVisualizer[];
  headcountByPen: Record<string, number>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <BarnsSection
        barns={barns}
        pens={pens}
        headcountByPen={headcountByPen}
        locationId={locationId}
      />
      {blocks.length === 0 ? (
        <div className="ring-1 ring-foreground/10 p-3 text-xs text-muted-foreground">
          No groups need pen splits yet. Assign cows to groups first on{" "}
          <Link href="/group-moves" className="underline underline-offset-2">
            Group moves
          </Link>
          , then come back to stripe them across pens.
        </div>
      ) : (
        blocks.map((b) => (
          <GroupBlockCard
            key={b.group_id}
            block={b}
            locationId={locationId}
            barns={barns}
          />
        ))
      )}
    </div>
  );
}

function GroupBlockCard({
  block,
  locationId,
  barns,
}: {
  block: GroupBlock;
  locationId: string;
  barns: BarnLite[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<AnimalLite | null>(null);
  const [overrideTo, setOverrideTo] = useState<string>("");

  // Per-row destination override (defaults to engine suggestion).
  const [destByAnimal, setDestByAnimal] = useState<Record<string, string>>({});
  const destinationFor = (a: AnimalLite) =>
    destByAnimal[a.id] ?? a.suggested_pen_id ?? a.current_pen_id ?? "";

  const pendingMoves = block.animals.filter((a) => {
    const dest = destinationFor(a);
    return dest && dest !== a.current_pen_id;
  });

  const onAccept = (a: AnimalLite) => {
    const dest = destinationFor(a);
    if (!dest || dest === a.current_pen_id) return;
    setBusy(a.id);
    const overridden = dest !== a.suggested_pen_id;
    const destName =
      block.pens.find((p) => p.id === dest)?.name ?? "selected pen";
    startTransition(async () => {
      const r = await applyPenMove({
        animal_id: a.id,
        from_pen_id: a.current_pen_id,
        to_pen_id: dest,
        reason: overridden
          ? `manual override → ${destName}`
          : "auto: pen-split by parity / DIM",
      });
      setBusy(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`${a.animal_id} → ${destName}`);
      router.refresh();
    });
  };

  const onAcceptAll = () => {
    if (pendingMoves.length === 0) {
      toast.error("Nothing to accept.");
      return;
    }
    if (!confirm(`Apply ${pendingMoves.length} pen move(s) in ${block.group_label}?`)) return;
    startTransition(async () => {
      const r = await bulkApplyPenMoves({
        moves: pendingMoves.map((m) => {
          const dest = destinationFor(m);
          const overridden = dest !== m.suggested_pen_id;
          const destName =
            block.pens.find((p) => p.id === dest)?.name ?? "selected pen";
          return {
            animal_id: m.id,
            from_pen_id: m.current_pen_id,
            to_pen_id: dest,
            reason: overridden
              ? `manual override → ${destName}`
              : "auto: pen-split by parity / DIM",
          };
        }),
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Applied ${r.applied} move(s).`);
      router.refresh();
    });
  };

  const openOverride = (a: AnimalLite) => {
    setOverrideTarget(a);
    setOverrideTo(a.current_pen_id ?? "");
  };

  // ZERO-pen path: inline form to create the first pen(s) here, no
  // need to bounce to Infrastructure. Suggests an N-pens-of-~50 split
  // based on the engine-driven target capacity.
  if (block.pens.length === 0) {
    return (
      <section id={`group-${block.group_id}`} className="ring-1 ring-amber-500/40 bg-amber-500/5 flex flex-col">
        <header className="px-3 py-2 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-medium">
              {block.group_label}
              <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                {block.animals.length} cow
                {block.animals.length === 1 ? "" : "s"} · no pens declared
              </span>
            </h3>
            <p className="text-[10px] text-muted-foreground">
              {block.target_pen_cap > 0
                ? `Target capacity ~${block.target_pen_cap} head${block.target_bunk_ft > 0 ? ` · ${block.target_bunk_ft.toFixed(0)} ft bunk` : ""}. Common pen size ≈ 50 cows → ${Math.max(1, Math.ceil(block.target_pen_cap / 50))} pen(s).`
                : "Add at least one pen so cows in this group can be assigned."}
            </p>
          </div>
        </header>
        <div className="px-3 pb-3">
          <AddPenInline
            locationId={locationId}
            groupId={block.group_id}
            barns={barns}
            suggestedCap={
              block.target_pen_cap > 0
                ? Math.min(80, Math.max(20, Math.round(block.target_pen_cap / Math.max(1, Math.ceil(block.target_pen_cap / 50)))))
                : null
            }
            defaultName={`${block.group_label} pen 1`}
          />
        </div>
      </section>
    );
  }

  return (
    <section id={`group-${block.group_id}`} className="ring-1 ring-foreground/10 flex flex-col">
      <header className="px-3 py-2 bg-foreground/5 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-medium">
            {block.group_label}
            <span className="ml-2 text-[10px] font-normal text-muted-foreground">
              {block.animals.length} cow{block.animals.length === 1 ? "" : "s"} · {block.pens.length} pen{block.pens.length === 1 ? "" : "s"}
            </span>
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {block.pens.length === 1
              ? "Single pen — all cows in this group go here."
              : "Suggested by parity, then DIM ascending. Pens fill proportionally to declared capacity."}
          </p>
        </div>
        {pendingMoves.length > 0 ? (
          <Button type="button" size="sm" variant="outline" onClick={onAcceptAll}>
            <HugeiconsIcon icon={CheckmarkCircle02Icon} />
            {block.pens.length === 1
              ? `Move ${pendingMoves.length} cow${pendingMoves.length === 1 ? "" : "s"} here`
              : `Accept ${pendingMoves.length} move${pendingMoves.length === 1 ? "" : "s"}`}
          </Button>
        ) : (
          <span className="text-[10px] uppercase tracking-wide text-primary">
            in sync
          </span>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-foreground/10">
        {block.pens.map((p) => (
          <PenTile key={p.id} pen={p} />
        ))}
      </div>
      <div className="px-3 py-2 border-t border-foreground/10">
        <AddPenInline
          locationId={locationId}
          groupId={block.group_id}
          barns={barns}
          suggestedCap={null}
          defaultName={`${block.group_label} pen ${block.pens.length + 1}`}
          compact
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-foreground/[0.025]">
            <tr className="text-left">
              <th className="px-3 py-1.5 font-medium">Cow</th>
              <th className="px-3 py-1.5 font-medium text-right">Parity</th>
              <th className="px-3 py-1.5 font-medium text-right">DIM</th>
              <th className="px-3 py-1.5 font-medium">Current pen</th>
              <th className="px-3 py-1.5 font-medium">Move to</th>
              <th className="px-3 py-1.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {block.animals.map((a) => {
              const dest = destinationFor(a);
              const change = dest && dest !== a.current_pen_id;
              const isOverride = change && dest !== a.suggested_pen_id;
              return (
                <tr key={a.id} className="border-t border-foreground/10 hover:bg-foreground/[0.025]">
                  <td className="px-3 py-1.5 font-medium">
                    {a.animal_id}
                    {a.name ? <span className="text-muted-foreground"> · {a.name}</span> : null}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{a.parity}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {a.dim ?? "—"}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {a.current_pen_name ?? <em>—</em>}
                  </td>
                  <td className="px-3 py-1.5">
                    <Select
                      value={dest || a.current_pen_id || ""}
                      onValueChange={(v) =>
                        setDestByAnimal((prev) => ({ ...prev, [a.id]: v }))
                      }
                    >
                      <SelectTrigger
                        className={`h-7 ${isOverride ? "ring-2 ring-amber-500/60" : ""}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {block.pens.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                            {p.id === a.suggested_pen_id ? " (suggested)" : ""}
                            {p.id === a.current_pen_id ? " (current)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    {change ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onAccept(a)}
                          disabled={busy === a.id}
                          title={`Move ${a.animal_id} to ${block.pens.find((p) => p.id === dest)?.name ?? "selected pen"}`}
                        >
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} />
                          {isOverride ? "Apply override" : "Accept"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => openOverride(a)}
                          title="Keep cow in current pen with a reason"
                        >
                          <HugeiconsIcon icon={CancelCircleIcon} />
                          Override…
                        </Button>
                      </>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wide text-primary">
                        ok
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <OverrideDialog
        target={overrideTarget}
        pens={block.pens}
        overrideTo={overrideTo}
        setOverrideTo={setOverrideTo}
        onClose={() => setOverrideTarget(null)}
      />
    </section>
  );
}

function AddPenInline({
  locationId,
  groupId,
  barns,
  suggestedCap,
  defaultName,
  compact = false,
}: {
  locationId: string;
  groupId: string;
  barns: BarnLite[];
  suggestedCap: number | null;
  defaultName: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [cap, setCap] = useState<string>(suggestedCap ? String(suggestedCap) : "");
  const [lengthFt, setLengthFt] = useState<string>("");
  const [widthFt, setWidthFt] = useState<string>("");
  const [barnId, setBarnId] = useState<string>(
    barns.length === 1 ? barns[0].id : "",
  );
  const [side, setSide] = useState<"left" | "right" | "none">("none");
  const [busy, startTransition] = useTransition();

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        + Add pen here
      </Button>
    );
  }

  const onCreate = () => {
    if (!name.trim()) {
      toast.error("Name the pen.");
      return;
    }
    if (barns.length > 1 && !barnId) {
      toast.error("Pick a barn.");
      return;
    }
    startTransition(async () => {
      const r = await quickAddPen({
        location_id: locationId,
        group_id: groupId,
        name: name.trim(),
        capacity_head: cap ? Number(cap) : null,
        length_ft: lengthFt ? Number(lengthFt) : null,
        width_ft: widthFt ? Number(widthFt) : null,
        barn_id: barnId || null,
        side: side === "none" ? null : side,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Pen "${name.trim()}" added.`);
      setOpen(false);
      setName(defaultName);
      setCap(suggestedCap ? String(suggestedCap) : "");
      setLengthFt("");
      setWidthFt("");
      setSide("none");
      router.refresh();
    });
  };

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 ${compact ? "" : "py-2"}`}>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-muted-foreground">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {barns.length > 1 ? (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground">Barn</label>
          <Select value={barnId} onValueChange={setBarnId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Pick a barn" />
            </SelectTrigger>
            <SelectContent>
              {barns.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-muted-foreground">
          Capacity (head){suggestedCap ? ` — suggested ${suggestedCap}` : ""}
        </label>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={cap}
          onChange={(e) => setCap(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-muted-foreground">Length (ft)</label>
        <Input
          type="number"
          step="any"
          inputMode="decimal"
          min={0}
          value={lengthFt}
          onChange={(e) => setLengthFt(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-muted-foreground">Width (ft)</label>
        <Input
          type="number"
          step="any"
          inputMode="decimal"
          min={0}
          value={widthFt}
          onChange={(e) => setWidthFt(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-muted-foreground">Side (double-side barn)</label>
        <Select value={side} onValueChange={(v) => setSide(v as "left" | "right" | "none")}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— unspecified —</SelectItem>
            <SelectItem value="left">Left of feed alley</SelectItem>
            <SelectItem value="right">Right of feed alley</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 sm:col-span-4 flex gap-2">
        <Button type="button" size="sm" onClick={onCreate} disabled={busy}>
          {busy ? "Creating…" : "Create pen"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function PenTile({ pen }: { pen: PenLite }) {
  const cap = pen.capacity_head;
  const sugg = pen.suggested_count;
  let tone = "text-muted-foreground";
  let badge = "";
  if (cap && cap > 0) {
    const pct = (sugg / cap) * 100;
    if (pct > 115) {
      tone = "text-destructive";
      badge = `${Math.round(pct)}% over`;
    } else if (pct < 70) {
      tone = "text-amber-600 dark:text-amber-400";
      badge = `${Math.round(pct)}%`;
    } else {
      tone = "text-primary";
      badge = `${Math.round(pct)}%`;
    }
  }
  return (
    <div className="bg-background p-3 flex flex-col gap-0.5">
      <span className="text-xs font-medium">{pen.name}</span>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        cap {cap ?? "—"} · current {pen.current_count}
      </span>
      <span className={`text-[10px] tabular-nums ${tone}`}>
        suggested {sugg}
        {badge ? ` · ${badge}` : ""}
      </span>
    </div>
  );
}

function OverrideDialog({
  target,
  pens,
  overrideTo,
  setOverrideTo,
  onClose,
}: {
  target: AnimalLite | null;
  pens: PenLite[];
  overrideTo: string;
  setOverrideTo: (s: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const onSubmit = () => {
    if (!target) return;
    if (!overrideTo) {
      toast.error("Pick a pen.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason required.");
      return;
    }
    startTransition(async () => {
      const r = await applyPenMove({
        animal_id: target.id,
        from_pen_id: target.current_pen_id,
        to_pen_id: overrideTo,
        reason: `override: ${reason.trim()}`,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`${target.animal_id} moved with override reason.`);
      setReason("");
      onClose();
      router.refresh();
    });
  };
  // Memoised noop to keep React happy about unused vars.
  void useMemo;

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override pen suggestion</DialogTitle>
          <DialogDescription>
            {target ? `${target.animal_id}${target.name ? ` · ${target.name}` : ""}: pick the pen and record why.` : null}
          </DialogDescription>
        </DialogHeader>
        <Select value={overrideTo} onValueChange={setOverrideTo}>
          <SelectTrigger>
            <SelectValue placeholder="Pick a pen" />
          </SelectTrigger>
          <SelectContent>
            {pens.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
                {p.capacity_head !== null ? ` · cap ${p.capacity_head}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          rows={3}
          placeholder="Why override? e.g. compromised cow kept in low-stress pen, hospital observation…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={isPending}>
            {isPending ? "Saving…" : "Apply override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Barns section — top-down visual of every barn at the active location,
// with inline create / edit / delete / merge so users don't bounce to
// Infrastructure to set up the physical envelope.
// ---------------------------------------------------------------------

type BarnLayoutValue = "single_side" | "double_side" | "free";

function toVisualizerBarn(b: BarnLite): Barn {
  // BarnVisualizer expects the full lib/barns Barn shape but only reads
  // a handful of fields. Fill the rest with sensible nulls so we don't
  // have to hydrate them from the database.
  return {
    id: b.id,
    location_id: "",
    name: b.name,
    barn_code: null,
    type: "freestall",
    row_configuration: null,
    length_ft: b.length_ft,
    width_ft: b.width_ft,
    layout: b.layout,
    alley_width_ft: b.alley_width_ft,
    freestall_count: null,
    headlock_count: null,
    loafing_area_sqft: null,
    holding_pen_capacity: null,
    stall_surface: null,
    bedding_type: null,
    stall_length_ft: null,
    stall_width_in: null,
    neck_rail_height_in: null,
    bunk_type: null,
    bunk_total_linear_ft: null,
    floor_type: null,
    manure_handling: null,
    ventilation_type: null,
    fan_count: null,
    fan_diameter_in: null,
    soaker_lines_present: false,
    soaker_nozzle_height_in: null,
    sprinklers: false,
    fans_over_stalls: false,
    brushes_count: null,
    footbath_present: false,
    parlor_type: null,
    parlor_stalls: null,
    robot_count: null,
    notes: null,
  };
}

function toVisualizerPen(p: PenForVisualizer): Pen {
  return {
    id: p.id,
    location_id: "",
    barn_id: p.barn_id,
    group_id: p.group_id,
    name: p.name,
    pen_code: null,
    type: "milking",
    capacity_head: p.capacity_head,
    bunk_running_ft: p.bunk_running_ft,
    stocking_target_pct: null,
    length_ft: p.length_ft,
    width_ft: p.width_ft,
    position_index: p.position_index,
    side: p.side,
    is_AI_pen: false,
    is_BULL_pen: false,
    is_DRY_pen: false,
    is_HOSP_pen: false,
    is_FRESH_pen: false,
    is_placeholder: false,
    notes: null,
  };
}

function BarnsSection({
  barns,
  pens,
  headcountByPen,
  locationId,
}: {
  barns: BarnLite[];
  pens: PenForVisualizer[];
  headcountByPen: Record<string, number>;
  locationId: string;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BarnLite | null>(null);
  const [deleting, setDeleting] = useState<BarnLite | null>(null);
  const [merging, setMerging] = useState<BarnLite | null>(null);

  const groupLabelByPen = new Map(pens.map((p) => [p.id, p.group_label] as const));
  const labelFor = (groupId: string | null): string => {
    if (!groupId) return "— no group —";
    // walk pens to find a label for this group_id
    for (const p of pens) {
      if (p.group_id === groupId) return p.group_label ?? "— no label —";
    }
    return "— no label —";
  };
  void groupLabelByPen;

  const detached = pens.filter((p) => !p.barn_id);

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Barns</h2>
          <p className="text-[10px] text-muted-foreground">
            Top-down sketch per barn. Pens are shaded by group, click any
            pen to jump to its group below. Edit barn dimensions on the
            header buttons.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setCreating(true)}>
          + Add barn
        </Button>
      </header>

      {barns.length === 0 ? (
        <div className="ring-1 ring-foreground/10 p-4 text-xs text-muted-foreground">
          No barns yet. Add one with <span className="font-medium">+ Add barn</span>{" "}
          above — sketch its length, width and layout, then declare pens
          inside it.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {barns.map((b) => (
            <div key={b.id} className="flex flex-col gap-1">
              <div className="flex justify-end gap-2 -mb-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(b)}>
                  Edit
                </Button>
                {barns.length > 1 ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setMerging(b)}>
                    Merge into…
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setDeleting(b)}
                >
                  Delete
                </Button>
              </div>
              <BarnVisualizer
                barn={toVisualizerBarn(b)}
                pens={pens.filter((p) => p.barn_id === b.id).map(toVisualizerPen)}
                groupLabel={labelFor}
                headcountByPen={headcountByPen}
                onPenClick={(p) => {
                  // Scroll to the group section for this pen, if it has one.
                  if (!p.group_id) return;
                  const el = document.getElementById(`group-${p.group_id}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
            </div>
          ))}
        </div>
      )}

      {detached.length > 0 ? (
        <div className="ring-1 ring-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {detached.length} pen{detached.length === 1 ? "" : "s"} not in a barn:
          </span>{" "}
          {detached.map((p) => p.name).join(", ")}. Open Settings →
          Infrastructure to re-home them, or merge / delete the orphan
          barn that used to hold them.
        </div>
      ) : null}

      <BarnFormDialog
        open={creating}
        onOpenChange={(o) => setCreating(o)}
        mode="create"
        locationId={locationId}
      />
      <BarnFormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        mode="edit"
        barn={editing}
        locationId={locationId}
      />
      <DeleteBarnDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        barn={deleting}
        otherBarns={barns.filter((b) => b.id !== deleting?.id)}
        penCount={
          deleting ? pens.filter((p) => p.barn_id === deleting.id).length : 0
        }
      />
      <MergeBarnDialog
        open={!!merging}
        onOpenChange={(o) => !o && setMerging(null)}
        primary={merging}
        otherBarns={barns.filter((b) => b.id !== merging?.id)}
      />
    </section>
  );
}

function BarnFormDialog({
  open,
  onOpenChange,
  mode,
  barn,
  locationId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "create" | "edit";
  barn?: BarnLite | null;
  locationId: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <BarnFormBody
            mode={mode}
            barn={barn ?? null}
            locationId={locationId}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function BarnFormBody({
  mode,
  barn,
  locationId,
  onClose,
}: {
  mode: "create" | "edit";
  barn: BarnLite | null;
  locationId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const editing = mode === "edit" && barn;
  const [name, setName] = useState(editing ? barn.name : "");
  const [lengthFt, setLengthFt] = useState<string>(
    editing && barn.length_ft !== null ? String(barn.length_ft) : "",
  );
  const [widthFt, setWidthFt] = useState<string>(
    editing && barn.width_ft !== null ? String(barn.width_ft) : "",
  );
  const [layout, setLayout] = useState<BarnLayoutValue>(
    editing ? ((barn.layout as BarnLayoutValue) ?? "double_side") : "double_side",
  );
  const [alleyFt, setAlleyFt] = useState<string>(
    editing && barn.alley_width_ft !== null ? String(barn.alley_width_ft) : "",
  );
  const [busy, startTransition] = useTransition();

  const onSubmit = () => {
    if (!name.trim()) {
      toast.error("Name the barn.");
      return;
    }
    startTransition(async () => {
      const payload = {
        location_id: locationId,
        name: name.trim(),
        length_ft: lengthFt ? Number(lengthFt) : null,
        width_ft: widthFt ? Number(widthFt) : null,
        layout,
        alley_width_ft: alleyFt ? Number(alleyFt) : null,
      };
      const r =
        mode === "create"
          ? await quickAddBarn(payload)
          : await updateBarnQuick({ ...payload, id: barn!.id });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(mode === "create" ? "Barn added." : "Barn updated.");
      onClose();
      router.refresh();
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "Add barn" : "Edit barn"}</DialogTitle>
        <DialogDescription>
          Dimensions drive the top-down sketch. Layout decides whether
          pens flank one side of the feed alley or both.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground">Length (ft, long axis)</label>
          <Input
            type="number"
            step="any"
            min={0}
            value={lengthFt}
            onChange={(e) => setLengthFt(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground">Width (ft, short axis)</label>
          <Input
            type="number"
            step="any"
            min={0}
            value={widthFt}
            onChange={(e) => setWidthFt(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground">Layout</label>
          <Select value={layout} onValueChange={(v) => setLayout(v as BarnLayoutValue)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single_side">Single-side</SelectItem>
              <SelectItem value="double_side">Double-side</SelectItem>
              <SelectItem value="free">Free / custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground">Feed alley (ft)</label>
          <Input
            type="number"
            step="any"
            min={0}
            value={alleyFt}
            onChange={(e) => setAlleyFt(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={onSubmit} disabled={busy}>
          {busy ? "Saving…" : mode === "create" ? "Add barn" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

function DeleteBarnDialog({
  open,
  onOpenChange,
  barn,
  otherBarns,
  penCount,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  barn: BarnLite | null;
  otherBarns: BarnLite[];
  penCount: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && barn ? (
          <DeleteBarnBody
            barn={barn}
            otherBarns={otherBarns}
            penCount={penCount}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DeleteBarnBody({
  barn,
  otherBarns,
  penCount,
  onClose,
}: {
  barn: BarnLite;
  otherBarns: BarnLite[];
  penCount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reattachTo, setReattachTo] = useState<string>("");
  const [busy, startTransition] = useTransition();

  const onSubmit = () => {
    startTransition(async () => {
      const r = await deleteBarnQuick({
        barn_id: barn.id,
        reattach_to_barn_id: reattachTo || null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`${barn.name} deleted.`);
      onClose();
      router.refresh();
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Delete {barn.name}?</DialogTitle>
        <DialogDescription>
          {penCount === 0
            ? "No pens are attached to this barn — it will be removed."
            : `${penCount} pen${penCount === 1 ? "" : "s"} live in this barn. Pick where they should move, or leave them detached and re-home them later from Infrastructure.`}
        </DialogDescription>
      </DialogHeader>
      {penCount > 0 ? (
        <Select value={reattachTo} onValueChange={setReattachTo}>
          <SelectTrigger>
            <SelectValue placeholder="Detach pens (re-home later)" />
          </SelectTrigger>
          <SelectContent>
            {otherBarns.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                Move pens to {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" variant="destructive" onClick={onSubmit} disabled={busy}>
          {busy ? "Deleting…" : "Delete barn"}
        </Button>
      </DialogFooter>
    </>
  );
}

function MergeBarnDialog({
  open,
  onOpenChange,
  primary,
  otherBarns,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  primary: BarnLite | null;
  otherBarns: BarnLite[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && primary ? (
          <MergeBarnBody
            primary={primary}
            otherBarns={otherBarns}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MergeBarnBody({
  primary,
  otherBarns,
  onClose,
}: {
  primary: BarnLite;
  otherBarns: BarnLite[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [secondaryId, setSecondaryId] = useState<string>("");
  const [newName, setNewName] = useState<string>(primary.name);
  const [busy, startTransition] = useTransition();

  const onSubmit = () => {
    if (!secondaryId) {
      toast.error("Pick the barn to merge in.");
      return;
    }
    startTransition(async () => {
      const r = await mergeBarnsQuick({
        primary_barn_id: primary.id,
        secondary_barn_id: secondaryId,
        new_name: newName.trim() || undefined,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Barns merged.");
      onClose();
      router.refresh();
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Merge into {primary.name}</DialogTitle>
        <DialogDescription>
          Pens from the second barn move into <span className="font-medium">{primary.name}</span>;
          lengths sum along the long axis. The second barn is deleted.
        </DialogDescription>
      </DialogHeader>
      <Select value={secondaryId} onValueChange={setSecondaryId}>
        <SelectTrigger>
          <SelectValue placeholder="Pick the barn to merge in" />
        </SelectTrigger>
        <SelectContent>
          {otherBarns.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-muted-foreground">Merged barn name</label>
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={onSubmit} disabled={busy}>
          {busy ? "Merging…" : "Merge"}
        </Button>
      </DialogFooter>
    </>
  );
}
