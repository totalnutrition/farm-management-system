"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { compileFormula, FUNCTION_NAMES } from "@/lib/derive/formula";
import { ITEMS } from "@/lib/derive/catalog";
import type { CalcFieldRow, CalcKind } from "@/lib/calc-fields";
import { saveCalcField, deleteCalcField } from "./calc-actions";

const KIND_LABEL: Record<CalcKind, string> = {
  num: "Number",
  flag: "Flag (groupable)",
  text: "Text",
};

const BUILTIN = new Set(ITEMS.map((i) => i.value));

function liveCheck(
  key: string,
  expr: string,
  others: CalcFieldRow[],
): string | null {
  const K = key.trim().toUpperCase();
  if (K && !/^[A-Z][A-Z0-9_]{1,15}$/.test(K))
    return "Key: a letter then 2–16 letters/digits/underscore.";
  if (BUILTIN.has(K)) return `“${K}” is a built-in item.`;
  if (!expr.trim()) return null;
  try {
    const f = compileFormula(expr);
    const known = new Set([
      ...BUILTIN,
      "ID",
      "TODAY",
      ...others.map((o) => o.key),
    ]);
    const bad = f.refs.filter((r) => !known.has(r));
    if (bad.length) return `Unknown item(s): ${bad.join(", ")}.`;
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

const blank = {
  id: undefined as string | undefined,
  key: "",
  label: "",
  expression: "",
  kind: "num" as CalcKind,
};

export function CalculatedFields({
  rows,
  canEdit,
}: {
  rows: CalcFieldRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof blank, v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  const others = useMemo(
    () => rows.filter((r) => r.id !== f.id),
    [rows, f.id],
  );
  const problem = liveCheck(f.key, f.expression, others);

  const edit = (r: CalcFieldRow) => {
    setF({
      id: r.id,
      key: r.key,
      label: r.label,
      expression: r.expression,
      kind: r.kind,
    });
    setOpen(true);
  };
  const create = () => {
    setF(blank);
    setOpen(true);
  };

  const submit = () =>
    start(async () => {
      const res = await saveCalcField(f);
      if (res.error) return void toast.error(res.error);
      toast.success(`Saved “${f.label}”.`);
      setOpen(false);
      router.refresh();
    });

  const remove = (r: CalcFieldRow) =>
    start(async () => {
      const res = await deleteCalcField(r.id);
      if (res.error) return void toast.error(res.error);
      toast.success(`Deleted “${r.label}”.`);
      router.refresh();
    });

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Calculated fields</h2>
          <p className="text-xs text-muted-foreground">
            Saved Google-Sheets-style formulas over items. Reusable in
            queries, grouping, monitors and saved views.
          </p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={create}>
                New field
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {f.id ? "Edit" : "New"} calculated field
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Key (item code)</Label>
                    <Input
                      className="h-8 font-mono text-xs uppercase"
                      placeholder="RPD"
                      value={f.key}
                      onChange={(e) =>
                        set("key", e.target.value.toUpperCase())
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="Relative production diff."
                      value={f.label}
                      onChange={(e) => set("label", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Result type</Label>
                  <Select
                    value={f.kind}
                    onValueChange={(v) => set("kind", v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.keys(KIND_LABEL) as CalcKind[]
                      ).map((k) => (
                        <SelectItem key={k} value={k}>
                          {KIND_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Formula</Label>
                  <textarea
                    className="h-24 w-full rounded-md border border-input bg-transparent p-2 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
                    placeholder='=IF(MILK>0, MTOT/DIM, 0)'
                    value={f.expression}
                    spellCheck={false}
                    onChange={(e) => set("expression", e.target.value)}
                  />
                  {problem ? (
                    <p className="text-[11px] text-destructive">
                      {problem}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Items by code (MILK, DIM, RPRO…). Functions:{" "}
                      {FUNCTION_NAMES.slice(0, 14).join(", ")}…
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={submit}
                  disabled={
                    pending ||
                    !!problem ||
                    !f.key.trim() ||
                    !f.label.trim() ||
                    !f.expression.trim()
                  }
                >
                  {pending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-auto border-collapse font-mono text-[11px] leading-tight tabular-nums">
            <thead className="border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
              <tr>
                <th className="px-2 text-left">Key</th>
                <th className="px-2 text-left">Name</th>
                <th className="px-2 text-left">Type</th>
                <th className="px-2 text-left">Formula</th>
                {canEdit && <th className="px-2" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/40 hover:bg-muted/30"
                >
                  <td className="px-2 font-medium">{r.key}</td>
                  <td className="px-2">{r.label}</td>
                  <td className="px-2 text-muted-foreground">
                    {r.kind}
                  </td>
                  <td className="px-2">{r.expression}</td>
                  {canEdit && (
                    <td className="px-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => edit(r)}
                        className="text-muted-foreground underline-offset-2 hover:underline"
                      >
                        edit
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
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
