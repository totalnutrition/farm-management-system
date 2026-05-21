"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FieldPicker } from "@/components/field-picker";
import { ITEMS, ITEM_GROUPS } from "@/lib/derive/catalog";

// Numeric items only — these are valid for "split by a number cut"
// and the capacity "Order by" sort factor.
const NUMERIC_ITEMS = ITEMS.filter((i) => i.kind === "num");
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
  predicateToConds,
  type ConditionValue,
} from "@/components/condition-builder";
import type { Predicate } from "@/lib/derive/query";
import type { Placement } from "@/lib/derive/grouping";
import {
  addRule,
  updateRule,
  deleteRule,
  moveAnimal,
  installGroupingPresets,
  setGroupPlacement,
  savePenCapacities,
  getGroupMembers,
} from "./actions";

export type RuleRow = {
  id: string;
  ordinal: number;
  name: string;
  predicate: Predicate;
  cond: string;
  placement: Placement;
  placementText: string;
  mapped: boolean;
  size: number;
};
export type Move = {
  id: string;
  subjectId: string;
  from: string | null;
  to: string;
  rule: string;
  overCapacity: boolean;
};
export type PenOption = { value: string; capacity: number | null };

type PMode = "none" | "single" | "parity" | "item" | "capacity";

export function GroupingClient({
  rules,
  worklist,
  pens,
  unmapped,
  recon,
}: {
  rules: RuleRow[];
  worklist: Move[];
  pens: PenOption[];
  unmapped: string[];
  recon: {
    total: number;
    grouped: number;
    exited: string[];
    needsFresh: string[];
    other: string[];
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [cond, setCond] = useState<ConditionValue>({
    conds: [],
    matchAny: false,
  });
  const [mapId, setMapId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [override, setOverride] = useState<Record<string, string>>({});

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
      const to = override[m.subjectId] ?? m.to;
      const res = await moveAnimal({ subjectId: m.subjectId, toPen: to });
      if (res.error) return void toast.error(res.error);
      toast.success(`${m.id} → ${to}.`);
      router.refresh();
    });

  const acceptAll = () =>
    start(async () => {
      let ok = 0;
      for (const m of worklist) {
        const to = override[m.subjectId] ?? m.to;
        const res = await moveAnimal({ subjectId: m.subjectId, toPen: to });
        if (!res.error) ok++;
      }
      toast.success(`Moved ${ok} of ${worklist.length} animals.`);
      router.refresh();
    });

  const [preset, setPreset] = useState("3tier");
  const installPresets = () =>
    start(async () => {
      const res = await installGroupingPresets(preset);
      if (res.error) return void toast.error(res.error);
      toast.success(
        "Strategy applied — rules set (pen mappings kept, custom groups untouched).",
      );
      router.refresh();
    });

  const target = rules.find((r) => r.id === mapId) ?? null;
  const editTarget = rules.find((r) => r.id === editId) ?? null;

  return (
    <div className="space-y-8">
      <datalist id="pen-options">
        {pens.map((p) => (
          <option key={p.value} value={p.value} />
        ))}
      </datalist>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Groups</h2>
          <div className="flex items-center gap-2">
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="h-8 w-[230px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2tier">
                  2-tier (High / Low)
                </SelectItem>
                <SelectItem value="3tier">
                  3-tier (High / Mid / Low / Late)
                </SelectItem>
                <SelectItem value="4tier">
                  4-tier (1st-lact × mature, High / Low)
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={installPresets}
            >
              Apply strategy
            </Button>
          </div>
        </div>

        <div className="space-y-1.5 rounded-md border bg-muted/30 px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              <span className="font-semibold">{recon.total}</span>{" "}
              animals
            </span>
            <span className="text-muted-foreground">·</span>
            <span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {recon.grouped}
              </span>{" "}
              in a pen group
            </span>
          </div>
          {(() => {
            const buckets: [string, string[], string][] = [
              ["Need a calving date", recon.needsFresh, "text-amber-600 dark:text-amber-400"],
              ["Exited (sold/dead)", recon.exited, "text-muted-foreground"],
              ["Uncovered — review", recon.other, "text-destructive"],
            ];
            const active = buckets.filter(([, ids]) => ids.length);
            if (!active.length)
              return (
                <p className="text-muted-foreground">
                  Reconciled — every active animal is in exactly one
                  pen group.
                </p>
              );
            return (
              <div className="space-y-1">
                <p className="text-muted-foreground">
                  Not penned (worklist, not groups):
                </p>
                {active.map(([label, ids, cls]) => (
                  <div key={label} className="flex flex-wrap gap-x-2">
                    <span className={"font-semibold " + cls}>
                      {ids.length}
                    </span>
                    <span>{label}</span>
                    <span
                      className="text-muted-foreground"
                      title={ids.join(", ")}
                    >
                      ({ids.slice(0, 10).join(", ")}
                      {ids.length > 10
                        ? `, +${ids.length - 10} more`
                        : ""}
                      )
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
        <p className="text-[11px] text-muted-foreground">
          One vocabulary: every pregnant animal is Far-off → Close-up
          (split by parity), not “bred/springing”. Groups are
          most-specific first; priority (the #) assigns each animal to
          exactly one. Sold/dead and animals missing a calving date
          are a worklist here, not fake pens — enter the calving date
          and they flow into the milking string automatically.
        </p>

        {unmapped.length > 0 && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            {unmapped.length} group{unmapped.length === 1 ? "" : "s"} not
            mapped to pens yet ({unmapped.join(", ")}). See the counts
            below, then map each to your pens — nothing moves until you
            do.
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
                  <th className="px-2 text-right">Animals</th>
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
                    <td className="px-2 text-right font-medium">
                      {r.size}
                    </td>
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
                        onClick={() => setEditId(r.id)}
                        className="text-muted-foreground underline-offset-2 hover:underline"
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapId(r.id)}
                        className="ml-2 text-muted-foreground underline-offset-2 hover:underline"
                      >
                        {r.mapped ? "pens" : "map"}
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
          pens={pens}
          onClose={() => setMapId(null)}
          onSaved={() => {
            setMapId(null);
            router.refresh();
          }}
        />
      )}

      {editTarget && (
        <EditGroupDialog
          key={editTarget.id}
          group={editTarget}
          onClose={() => setEditId(null)}
          onSaved={() => {
            setEditId(null);
            router.refresh();
          }}
        />
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">
            Pen-move worklist ({worklist.length})
          </h2>
          {worklist.length > 0 && (
            <Button size="sm" disabled={pending} onClick={acceptAll}>
              Accept all
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Suggestions only — edit any “To” pen to override, then Move
          (or Accept all).
        </p>
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
                    <td className="px-2">
                      <input
                        list="pen-options"
                        className="h-6 w-24 rounded border border-input bg-transparent px-1 font-mono text-[11px]"
                        value={override[m.subjectId] ?? m.to}
                        onChange={(e) =>
                          setOverride((o) => ({
                            ...o,
                            [m.subjectId]: e.target.value,
                          }))
                        }
                      />
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
  pens,
  onClose,
  onSaved,
}: {
  group: RuleRow;
  pens: PenOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const pl = group.placement;
  const capOf = (n: string) =>
    pens.find((p) => p.value === n)?.capacity ?? null;

  const [mode, setMode] = useState<PMode>(pl.kind);
  const [single, setSingle] = useState(pl.kind === "single" ? pl.pen : "");
  const [pHeifer, setPHeifer] = useState(
    pl.kind === "parity" ? (pl.buckets[0]?.pen ?? "") : "",
  );
  const [pMature, setPMature] = useState(
    pl.kind === "parity" ? (pl.buckets[1]?.pen ?? "") : "",
  );
  const [item, setItem] = useState(pl.kind === "item" ? pl.item : "MAVG");
  const [cuts, setCuts] = useState<{ lt: string; pen: string }[]>(
    pl.kind === "item"
      ? pl.cuts.map((c) => ({ lt: String(c.lt), pen: c.pen }))
      : [{ lt: "", pen: "" }],
  );
  const [elsePen, setElsePen] = useState(
    pl.kind === "item" ? pl.elsePen : "",
  );
  const [capRows, setCapRows] = useState<{ pen: string; cap: string }[]>(
    pl.kind === "capacity"
      ? pl.pens.map((p) => ({
          pen: p,
          cap: capOf(p) != null ? String(capOf(p)) : "",
        }))
      : [
          { pen: "", cap: "" },
          { pen: "", cap: "" },
        ],
  );
  const [orderItem, setOrderItem] = useState(
    pl.kind === "capacity" ? (pl.orderBy?.item ?? "") : "",
  );
  const [orderDir, setOrderDir] = useState<"asc" | "desc">(
    pl.kind === "capacity" ? (pl.orderBy?.dir ?? "desc") : "desc",
  );
  const [pending, start] = useTransition();

  // Members of this group with every numeric item, so the editor
  // can preview HOW the placement lands across pens before save.
  const [members, setMembers] = useState<
    { id: string; values: Record<string, number | null> }[]
  >([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await getGroupMembers(group.id);
      if (!alive) return;
      if ("members" in r) setMembers(r.members);
    })();
    return () => {
      alive = false;
    };
  }, [group.id]);

  const penInput = (
    value: string,
    onChange: (v: string) => void,
    ph: string,
  ) => (
    <Input
      list="pen-options"
      className="h-7 w-[120px] text-xs"
      placeholder={ph}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );

  const build = (): { placement: Placement; caps?: { pen: string; capacity: number | null }[] } | string => {
    if (mode === "none") return { placement: { kind: "none" } };
    if (mode === "single")
      return single.trim()
        ? { placement: { kind: "single", pen: single.trim() } }
        : "Enter a pen.";
    if (mode === "parity") {
      if (!pHeifer.trim() || !pMature.trim()) return "Enter both pens.";
      return {
        placement: {
          kind: "parity",
          buckets: [
            { lacts: [1], pen: pHeifer.trim() },
            { lacts: [2, 3, 4, 5, 6, 7, 8, 9, 10], pen: pMature.trim() },
          ],
        },
      };
    }
    if (mode === "capacity") {
      const rows = capRows
        .map((r) => ({ pen: r.pen.trim(), cap: r.cap.trim() }))
        .filter((r) => r.pen);
      if (rows.length < 2) return "Add at least two pens in fill order.";
      return {
        placement: {
          kind: "capacity",
          pens: rows.map((r) => r.pen),
          ...(orderItem.trim()
            ? {
                orderBy: {
                  item: orderItem.trim().toUpperCase(),
                  dir: orderDir,
                },
              }
            : {}),
        },
        caps: rows.map((r) => ({
          pen: r.pen,
          capacity:
            r.cap && Number.isFinite(Number(r.cap))
              ? Number(r.cap)
              : null,
        })),
      };
    }
    if (!item.trim()) return "Pick a field for the cut.";
    if (!elsePen.trim()) return "Enter the 'otherwise' pen.";
    const parsedCuts = cuts
      .map((c) => ({ lt: Number(c.lt), pen: c.pen.trim() }))
      .filter((c) => Number.isFinite(c.lt) && c.pen);
    if (parsedCuts.length === 0)
      return "Add at least one cut (value + pen).";
    return {
      placement: {
        kind: "item",
        item: item.trim().toUpperCase(),
        cuts: parsedCuts,
        elsePen: elsePen.trim(),
      },
    };
  };

  // Lenient preview placement — uses current state with "—" for any
  // missing pen, so counts show even before everything is filled in.
  const preview = (): Placement | null => {
    if (mode === "none") return { kind: "none" };
    if (mode === "single") return { kind: "single", pen: single.trim() || "—" };
    if (mode === "parity")
      return {
        kind: "parity",
        buckets: [
          { lacts: [1], pen: pHeifer.trim() || "—" },
          {
            lacts: [2, 3, 4, 5, 6, 7, 8, 9, 10],
            pen: pMature.trim() || "—",
          },
        ],
      };
    if (mode === "capacity") {
      const rows = capRows.filter((r) => r.pen.trim() || r.cap.trim());
      if (!rows.length) return null;
      return {
        kind: "capacity",
        pens: rows.map((r) => r.pen.trim() || "—"),
        ...(orderItem.trim()
          ? {
              orderBy: { item: orderItem.trim().toUpperCase(), dir: orderDir },
            }
          : {}),
      };
    }
    const parsedCuts = cuts
      .filter((c) => c.lt.trim() !== "" && Number.isFinite(Number(c.lt)))
      .map((c) => ({ lt: Number(c.lt), pen: c.pen.trim() || "—" }));
    if (!parsedCuts.length) return null;
    return {
      kind: "item",
      item: item.trim().toUpperCase() || "MAVG",
      cuts: parsedCuts,
      elsePen: elsePen.trim() || "—",
    };
  };

  // Pen → count given the current placement and the group's members.
  // `preview` is recreated each render but reads exactly the listed
  // deps, so manual dep list keeps re-computation tight.
  const counts = useMemo(() => {
    const pl2 = preview();
    const out: Record<string, number> = {};
    if (!pl2 || !members.length) return out;
    const add = (p: string) => {
      out[p] = (out[p] ?? 0) + 1;
    };
    if (pl2.kind === "none") return out;
    if (pl2.kind === "single") {
      for (let i = 0; i < members.length; i++) add(pl2.pen);
      return out;
    }
    if (pl2.kind === "parity") {
      for (const m of members) {
        const l = m.values.LACT ?? 0;
        const b =
          pl2.buckets.find((x) => x.lacts.includes(l)) ??
          pl2.buckets[pl2.buckets.length - 1];
        add(b?.pen ?? "—");
      }
      return out;
    }
    if (pl2.kind === "item") {
      for (const m of members) {
        const v = m.values[pl2.item];
        let p = pl2.elsePen;
        if (v !== null && v !== undefined)
          for (const c of pl2.cuts)
            if (v < c.lt) {
              p = c.pen;
              break;
            }
        add(p);
      }
      return out;
    }
    // capacity
    const ordered = [...members];
    if (pl2.orderBy) {
      const { item: k, dir } = pl2.orderBy;
      ordered.sort((a, b) => {
        const av = a.values[k];
        const bv = b.values[k];
        if (av === null && bv === null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return dir === "desc" ? bv - av : av - bv;
      });
    }
    const capMap = new Map<string, number>();
    for (const r of capRows) {
      const n = Number(r.cap);
      if (r.pen.trim() && Number.isFinite(n)) capMap.set(r.pen.trim(), n);
    }
    const used = new Map<string, number>();
    for (let i = 0; i < ordered.length; i++) {
      let chosen = pl2.pens[pl2.pens.length - 1];
      for (const p of pl2.pens) {
        const cap = capMap.get(p) ?? Infinity;
        if ((used.get(p) ?? 0) < cap) {
          chosen = p;
          break;
        }
      }
      used.set(chosen, (used.get(chosen) ?? 0) + 1);
      add(chosen);
    }
    return out;
    // preview() is closed over the deps below — listing it would
    // invalidate the memo every render with no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    single,
    pHeifer,
    pMature,
    item,
    cuts,
    elsePen,
    capRows,
    orderItem,
    orderDir,
    members,
  ]);

  const save = () =>
    start(async () => {
      const b = build();
      if (typeof b === "string") return void toast.error(b);
      const res = await setGroupPlacement({
        id: group.id,
        placement: b.placement,
      });
      if (res.error) return void toast.error(res.error);
      if (b.caps && b.caps.length) await savePenCapacities({ caps: b.caps });
      toast.success(`“${group.name}” mapped.`);
      onSaved();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Map “{group.name}” ({group.size} animals) to pens
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <Label className="text-xs">How this group uses pens</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as PMode)}>
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
                <SelectItem value="capacity">
                  Several pens by capacity
                </SelectItem>
                <SelectItem value="item">
                  Split by a number cut (advanced)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "single" && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Pen</span>
              {penInput(single, setSingle, "pen")}
            </div>
          )}

          {mode === "parity" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-28 text-muted-foreground">
                  1st lactation
                </span>
                {penInput(pHeifer, setPHeifer, "heifer pen")}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-28 text-muted-foreground">
                  2nd &amp; older
                </span>
                {penInput(pMature, setPMature, "mature pen")}
              </div>
            </div>
          )}

          {mode === "capacity" && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                {group.size} animals. List pens in fill order with each
                pen’s capacity; optionally rank who fills first.
              </p>
              {capRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-12 text-muted-foreground">
                    Pen {i + 1}
                  </span>
                  {penInput(
                    row.pen,
                    (v) =>
                      setCapRows((rs) =>
                        rs.map((x, j) =>
                          j === i ? { ...x, pen: v } : x,
                        ),
                      ),
                    "pen",
                  )}
                  <Input
                    className="h-7 w-20 text-xs"
                    placeholder="cap"
                    value={row.cap}
                    onChange={(e) =>
                      setCapRows((rs) =>
                        rs.map((x, j) =>
                          j === i ? { ...x, cap: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  {capRows.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        setCapRows((rs) => rs.filter((_, j) => j !== i))
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setCapRows((rs) => [...rs, { pen: "", cap: "" }])
                }
                className="rounded border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
              >
                + pen
              </button>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-muted-foreground">Order by</span>
                <FieldPicker
                  items={NUMERIC_ITEMS}
                  groups={ITEM_GROUPS}
                  value={orderItem}
                  onChange={setOrderItem}
                  placeholder="(optional)"
                  clearLabel="(optional)"
                  triggerClassName="h-7 w-[150px] text-xs"
                />
                <Select
                  value={orderDir}
                  onValueChange={(v) =>
                    setOrderDir(v as "asc" | "desc")
                  }
                >
                  <SelectTrigger className="h-7 w-[120px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">high → low</SelectItem>
                    <SelectItem value="asc">low → high</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {mode === "item" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Field</span>
                <FieldPicker
                  items={NUMERIC_ITEMS}
                  groups={ITEM_GROUPS}
                  value={item}
                  onChange={setItem}
                  placeholder="field"
                  triggerClassName="h-7 w-[180px] text-xs"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Add cuts in ascending order — the first matching cut
                wins; everything else lands in the otherwise pen.
              </p>
              {cuts.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-muted-foreground w-8">
                    {i === 0 ? "if <" : "else <"}
                  </span>
                  <Input
                    className="h-7 w-16 text-xs"
                    value={c.lt}
                    onChange={(e) =>
                      setCuts((rs) =>
                        rs.map((r, j) =>
                          j === i ? { ...r, lt: e.target.value } : r,
                        ),
                      )
                    }
                    placeholder="value"
                  />
                  <span className="text-muted-foreground">→</span>
                  {penInput(
                    c.pen,
                    (v) =>
                      setCuts((rs) =>
                        rs.map((r, j) => (j === i ? { ...r, pen: v } : r)),
                      ),
                    "pen",
                  )}
                  {counts[c.pen.trim() || "—"] !== undefined && (
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {counts[c.pen.trim() || "—"]} animals
                    </span>
                  )}
                  {cuts.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setCuts((rs) => rs.filter((_, j) => j !== i))
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setCuts((rs) => [...rs, { lt: "", pen: "" }])
                }
                className="rounded border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
              >
                + cut
              </button>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">otherwise →</span>
                {penInput(elsePen, setElsePen, "pen")}
                {counts[elsePen.trim() || "—"] !== undefined && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {counts[elsePen.trim() || "—"]} animals
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="rounded-md border bg-muted/30 px-3 py-2 text-[11px]">
            <div className="text-muted-foreground">
              Preview · {members.length} animals in this group →
            </div>
            {Object.keys(counts).length === 0 ? (
              <div className="italic text-muted-foreground">
                Fill in the pens to see the split.
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
                {Object.entries(counts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([pen, n]) => (
                    <span key={pen}>
                      <span className="font-semibold">{n}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        → {pen}
                      </span>
                    </span>
                  ))}
              </div>
            )}
          </div>
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

function EditGroupDialog({
  group,
  onClose,
  onSaved,
}: {
  group: RuleRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [cond, setCond] = useState<ConditionValue>(() =>
    predicateToConds(group.predicate),
  );
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const predicate = condsToPredicate(cond);
      if (!predicate)
        return void toast.error("Add at least one condition.");
      if (!name.trim()) return void toast.error("Group name is required.");
      const res = await updateRule({
        id: group.id,
        name: name.trim(),
        predicate,
      });
      if (res.error) return void toast.error(res.error);
      toast.success(`“${name}” updated.`);
      onSaved();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit group</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Group name</Label>
            <Input
              className="h-7 w-44 text-xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <ConditionBuilder value={cond} onChange={setCond} />
          <p className="text-[11px] text-muted-foreground">
            Pen mapping and evaluation order are unchanged — use “pens”
            for placement.
          </p>
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
