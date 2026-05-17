"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ConditionBuilder,
  condsToPredicate,
  type ConditionValue,
} from "@/components/condition-builder";
import type { Placement } from "@/lib/derive/grouping";
import {
  addRule,
  deleteRule,
  moveAnimal,
  installGroupingPresets,
  setGroupPlacement,
} from "./actions";

export type RuleRow = {
  id: string;
  ordinal: number;
  name: string;
  cond: string;
  placement: Placement;
  placementText: string;
  mapped: boolean;
};
export type Move = {
  id: string;
  subjectId: string;
  from: string | null;
  to: string;
  rule: string;
  overCapacity: boolean;
};
export type PenOption = { value: string };

type PMode = "none" | "single" | "parity" | "item" | "capacity";

export function GroupingClient({
  rules,
  worklist,
  pens,
  unmapped,
}: {
  rules: RuleRow[];
  worklist: Move[];
  pens: PenOption[];
  unmapped: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [cond, setCond] = useState<ConditionValue>({
    conds: [],
    matchAny: false,
  });
  const [mapId, setMapId] = useState<string | null>(null);

  const penList = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
  ) => (
    <Input
      list="pen-options"
      className="h-7 w-[120px] text-xs"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );

  const submit = () =>
    start(async () => {
      const predicate = condsToPredicate(cond);
      if (!predicate)
        return void toast.error("Add at least one condition.");
      const res = await addRule({ name, predicate });
      if (res.error) return void toast.error(res.error);
      toast.success(`Group “${name}” added. Now map it to your pens.`);
      setName("");
      setCond({ conds: [], matchAny: false });
      router.refresh();
    });

  const remove = (r: RuleRow) =>
    start(async () => {
      const res = await deleteRule(r.id);
      if (res.error) return void toast.error(res.error);
      toast.success(`Deleted “${r.name}”.`);
      router.refresh();
    });

  const move = (m: Move) =>
    start(async () => {
      const res = await moveAnimal({ subjectId: m.subjectId, toPen: m.to });
      if (res.error) return void toast.error(res.error);
      toast.success(`${m.id} → ${m.to}.`);
      router.refresh();
    });

  const installPresets = () =>
    start(async () => {
      const res = await installGroupingPresets();
      if (res.error) return void toast.error(res.error);
      toast.success("Standard strategy installed — now map each group.");
      router.refresh();
    });

  const target = rules.find((r) => r.id === mapId) ?? null;

  return (
    <div className="space-y-8">
      <datalist id="pen-options">
        {pens.map((p) => (
          <option key={p.value} value={p.value} />
        ))}
      </datalist>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">
            Groups (first match wins)
          </h2>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={installPresets}
          >
            Install standard strategy
          </Button>
        </div>

        {unmapped.length > 0 && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            {unmapped.length} group{unmapped.length === 1 ? "" : "s"} not
            mapped to pens yet ({unmapped.join(", ")}). They won’t move
            any animals until you map them.
          </p>
        )}

        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No groups yet. Install the standard strategy or add one
            below.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-auto border-collapse font-mono text-[11px] leading-tight tabular-nums">
              <thead className="border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
                <tr>
                  <th className="px-2 text-left">#</th>
                  <th className="px-2 text-left">Group</th>
                  <th className="px-2 text-left">When</th>
                  <th className="px-2 text-left">Pens</th>
                  <th className="px-2" />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border/40 hover:bg-muted/30"
                  >
                    <td className="px-2 text-muted-foreground">
                      {r.ordinal}
                    </td>
                    <td className="px-2 font-medium">{r.name}</td>
                    <td className="px-2">{r.cond}</td>
                    <td className="px-2">
                      {r.mapped ? (
                        <span>{r.placementText}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setMapId(r.id)}
                          className="rounded border border-dashed px-1.5 text-amber-600 hover:bg-muted dark:text-amber-400"
                        >
                          Map pens…
                        </button>
                      )}
                    </td>
                    <td className="px-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setMapId(r.id)}
                        className="text-muted-foreground underline-offset-2 hover:underline"
                      >
                        {r.mapped ? "edit" : "map"}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(r)}
                        disabled={pending}
                        className="ml-2 text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                      >
                        delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">New group name</Label>
                <Input
                  className="h-7 w-44 text-xs"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Close-up"
                />
              </div>
            </div>
            <ConditionBuilder value={cond} onChange={setCond} />
            <Button
              size="sm"
              disabled={pending || !name}
              onClick={submit}
            >
              Add group
            </Button>
          </CardContent>
        </Card>
      </section>

      {target && (
        <MapPensDialog
          key={target.id}
          group={target}
          penList={penList}
          onClose={() => setMapId(null)}
          onSaved={() => {
            setMapId(null);
            router.refresh();
          }}
        />
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">
          Pen-move worklist ({worklist.length})
        </h2>
        {worklist.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing to move — everyone mapped is where they should be.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-auto border-collapse font-mono text-[11px] leading-tight tabular-nums">
              <thead className="border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
                <tr>
                  <th className="px-2 text-left">Animal</th>
                  <th className="px-2 text-left">From</th>
                  <th className="px-2 text-left">→ To</th>
                  <th className="px-2 text-left">Group</th>
                  <th className="px-2" />
                </tr>
              </thead>
              <tbody>
                {worklist.map((m) => (
                  <tr
                    key={m.subjectId}
                    className="border-b border-border/40 hover:bg-muted/30"
                  >
                    <td className="px-2 font-medium">{m.id}</td>
                    <td className="px-2">{m.from ?? "—"}</td>
                    <td className="px-2 font-medium">
                      {m.to}
                      {m.overCapacity && (
                        <span className="ml-2 text-[11px] text-destructive">
                          over capacity
                        </span>
                      )}
                    </td>
                    <td className="px-2 text-muted-foreground">
                      {m.rule}
                    </td>
                    <td className="px-2 text-right">
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => move(m)}
                      >
                        Move
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function MapPensDialog({
  group,
  penList,
  onClose,
  onSaved,
}: {
  group: RuleRow;
  penList: (
    v: string,
    on: (x: string) => void,
    ph: string,
  ) => React.ReactNode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const pl = group.placement;
  const [mode, setMode] = useState<PMode>(pl.kind);
  const [single, setSingle] = useState(
    pl.kind === "single" ? pl.pen : "",
  );
  const [pHeifer, setPHeifer] = useState(
    pl.kind === "parity" ? (pl.buckets[0]?.pen ?? "") : "",
  );
  const [pMature, setPMature] = useState(
    pl.kind === "parity" ? (pl.buckets[1]?.pen ?? "") : "",
  );
  const [capPens, setCapPens] = useState(
    pl.kind === "capacity" ? pl.pens.join(", ") : "",
  );
  const [item, setItem] = useState(pl.kind === "item" ? pl.item : "MAVG");
  const [cutLt, setCutLt] = useState(
    pl.kind === "item" ? String(pl.cuts[0]?.lt ?? "") : "",
  );
  const [cutPen, setCutPen] = useState(
    pl.kind === "item" ? (pl.cuts[0]?.pen ?? "") : "",
  );
  const [elsePen, setElsePen] = useState(
    pl.kind === "item" ? pl.elsePen : "",
  );
  const [pending, start] = useTransition();

  const build = (): Placement | string => {
    if (mode === "none") return { kind: "none" };
    if (mode === "single")
      return single.trim()
        ? { kind: "single", pen: single.trim() }
        : "Enter a pen.";
    if (mode === "parity") {
      if (!pHeifer.trim() || !pMature.trim())
        return "Enter both pens.";
      return {
        kind: "parity",
        buckets: [
          { lacts: [1], pen: pHeifer.trim() },
          { lacts: [2, 3, 4, 5, 6, 7, 8, 9, 10], pen: pMature.trim() },
        ],
      };
    }
    if (mode === "capacity") {
      const list = capPens
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return list.length >= 2
        ? { kind: "capacity", pens: list }
        : "List at least two pens in fill order.";
    }
    // item
    const lt = Number(cutLt);
    if (!item.trim() || !Number.isFinite(lt) || !cutPen.trim() || !elsePen.trim())
      return "Fill the item, cut value and both pens.";
    return {
      kind: "item",
      item: item.trim().toUpperCase(),
      cuts: [{ lt, pen: cutPen.trim() }],
      elsePen: elsePen.trim(),
    };
  };

  const save = () =>
    start(async () => {
      const p = build();
      if (typeof p === "string") return void toast.error(p);
      const res = await setGroupPlacement({ id: group.id, placement: p });
      if (res.error) return void toast.error(res.error);
      toast.success(`“${group.name}” mapped.`);
      onSaved();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Map “{group.name}” to pens</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <Label className="text-xs">How this group uses pens</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as PMode)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  Not mapped (no moves)
                </SelectItem>
                <SelectItem value="single">One pen</SelectItem>
                <SelectItem value="parity">
                  Split by parity (heifer / mature)
                </SelectItem>
                <SelectItem value="item">
                  Split by a number cut (advanced)
                </SelectItem>
                <SelectItem value="capacity">
                  Fill by capacity (advanced)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "single" && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Pen</span>
              {penList(single, setSingle, "pen")}
            </div>
          )}
          {mode === "parity" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-28 text-muted-foreground">
                  1st lactation
                </span>
                {penList(pHeifer, setPHeifer, "heifer pen")}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-28 text-muted-foreground">
                  2nd & older
                </span>
                {penList(pMature, setPMature, "mature pen")}
              </div>
            </div>
          )}
          {mode === "item" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">If</span>
                <Input
                  className="h-7 w-20 text-xs"
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  placeholder="MAVG"
                />
                <span className="text-muted-foreground">{"<"}</span>
                <Input
                  className="h-7 w-16 text-xs"
                  value={cutLt}
                  onChange={(e) => setCutLt(e.target.value)}
                  placeholder="40"
                />
                <span className="text-muted-foreground">→</span>
                {penList(cutPen, setCutPen, "pen")}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  otherwise →
                </span>
                {penList(elsePen, setElsePen, "pen")}
              </div>
            </div>
          )}
          {mode === "capacity" && (
            <div className="space-y-1">
              <span className="text-muted-foreground">
                Pens in fill order (comma-separated)
              </span>
              <Input
                className="h-7 w-full text-xs"
                value={capPens}
                onChange={(e) => setCapPens(e.target.value)}
                placeholder="HI-1, HI-2"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
