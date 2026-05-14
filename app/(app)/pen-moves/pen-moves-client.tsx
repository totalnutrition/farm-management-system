"use client";

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

import { applyPenMove, bulkApplyPenMoves } from "./actions";

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

export type GroupBlock = {
  group_id: string;
  group_label: string;
  pens: PenLite[];
  animals: AnimalLite[];
};

export function PenMovesClient({ blocks }: { blocks: GroupBlock[] }) {
  if (blocks.length === 0) {
    return (
      <div className="ring-1 ring-foreground/10 p-3 text-xs text-muted-foreground">
        Nothing to assign. Every grouped animal already sits in a pen, or no
        groups have multiple pens yet. Add pens under each group in
        Settings → Location → Infrastructure.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((b) => (
        <GroupBlockCard key={b.group_id} block={b} />
      ))}
    </div>
  );
}

function GroupBlockCard({ block }: { block: GroupBlock }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<AnimalLite | null>(null);
  const [overrideTo, setOverrideTo] = useState<string>("");

  const pendingMoves = block.animals.filter(
    (a) => a.suggested_pen_id && a.suggested_pen_id !== a.current_pen_id,
  );

  const onAccept = (a: AnimalLite) => {
    if (!a.suggested_pen_id) return;
    setBusy(a.id);
    startTransition(async () => {
      const r = await applyPenMove({
        animal_id: a.id,
        from_pen_id: a.current_pen_id,
        to_pen_id: a.suggested_pen_id!,
        reason: "auto: pen-split by parity / DIM",
      });
      setBusy(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`${a.animal_id} → ${a.suggested_pen_name}`);
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
        moves: pendingMoves.map((m) => ({
          animal_id: m.id,
          from_pen_id: m.current_pen_id,
          to_pen_id: m.suggested_pen_id!,
          reason: "auto: pen-split by parity / DIM",
        })),
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

  return (
    <section className="ring-1 ring-foreground/10 flex flex-col">
      <header className="px-3 py-2 bg-foreground/5 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-medium">
            {block.group_label}
            <span className="ml-2 text-[10px] font-normal text-muted-foreground">
              {block.animals.length} cow{block.animals.length === 1 ? "" : "s"} · {block.pens.length} pen{block.pens.length === 1 ? "" : "s"}
            </span>
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Suggested by parity, then DIM ascending. Pens fill proportionally
            to declared capacity.
          </p>
        </div>
        {pendingMoves.length > 0 ? (
          <Button type="button" size="sm" variant="outline" onClick={onAcceptAll}>
            <HugeiconsIcon icon={CheckmarkCircle02Icon} />
            Accept {pendingMoves.length} move{pendingMoves.length === 1 ? "" : "s"}
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

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-foreground/[0.025]">
            <tr className="text-left">
              <th className="px-3 py-1.5 font-medium">Cow</th>
              <th className="px-3 py-1.5 font-medium text-right">Parity</th>
              <th className="px-3 py-1.5 font-medium text-right">DIM</th>
              <th className="px-3 py-1.5 font-medium">Current pen</th>
              <th className="px-3 py-1.5 font-medium">Suggested pen</th>
              <th className="px-3 py-1.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {block.animals.map((a) => {
              const change = a.suggested_pen_id && a.suggested_pen_id !== a.current_pen_id;
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
                  <td className={`px-3 py-1.5 ${change ? "font-medium" : "text-muted-foreground"}`}>
                    {a.suggested_pen_name ?? "—"}
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
                          title="Accept"
                        >
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => openOverride(a)}
                          title="Override pen"
                        >
                          <HugeiconsIcon icon={CancelCircleIcon} />
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
