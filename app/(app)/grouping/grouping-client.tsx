"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  ConditionBuilder,
  condsToPredicate,
  type ConditionValue,
} from "@/components/condition-builder";
import {
  addRule,
  deleteRule,
  moveAnimal,
  installGroupingPresets,
} from "./actions";

export type RuleRow = {
  id: string;
  ordinal: number;
  name: string;
  cond: string;
  target: string;
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

export function GroupingClient({
  rules,
  worklist,
  pens,
}: {
  rules: RuleRow[];
  worklist: Move[];
  pens: PenOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [cond, setCond] = useState<ConditionValue>({
    conds: [],
    matchAny: false,
  });
  const [splitMode, setSplitMode] = useState(false);
  const [pen, setPen] = useState("");
  const [penFirst, setPenFirst] = useState("");
  const [penMature, setPenMature] = useState("");

  // pen is a number (DC convention); typeable so a rule is never
  // blocked by "no pens yet" — a new pen is created on save. Existing
  // pens are offered as autocomplete.
  const penInput = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
  ) => (
    <Input
      type="number"
      min={1}
      max={9999}
      list="pen-options"
      className="h-7 w-[110px] text-xs"
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
      const res = await addRule({
        name,
        predicate,
        targetPen: splitMode ? undefined : pen,
        splitFirst: splitMode ? penFirst : undefined,
        splitMature: splitMode ? penMature : undefined,
      });
      if (res.error) return void toast.error(res.error);
      toast.success(`Rule “${name}” added.`);
      setName("");
      setCond({ conds: [], matchAny: false });
      setPen("");
      setPenFirst("");
      setPenMature("");
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
      toast.success("Standard pens & rules installed.");
      router.refresh();
    });

  return (
    <div className="space-y-8">
      <datalist id="pen-options">
        {pens.map((p) => (
          <option key={p.value} value={p.value} />
        ))}
      </datalist>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Rules (first match wins)</h2>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={installPresets}
          >
            Install standard setup
          </Button>
        </div>
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rules yet. Add one below.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">→ Pen</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.ordinal}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.cond}</td>
                    <td className="px-3 py-2">{r.target}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => remove(r)}
                      >
                        Delete
                      </Button>
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
                <Label className="text-xs">Rule name</Label>
                <Input
                  className="h-7 w-44 text-xs"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Close-up"
                />
              </div>
            </div>
            <ConditionBuilder value={cond} onChange={setCond} />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSplitMode((s) => !s)}
                className="text-muted-foreground underline-offset-2 hover:underline"
              >
                {splitMode ? "single pen" : "split by parity"}
              </button>
              <span className="text-muted-foreground">→</span>
              {splitMode ? (
                <>
                  <span className="text-muted-foreground">1st-lact</span>
                  {penInput(penFirst, setPenFirst, "pen")}
                  <span className="text-muted-foreground">mature</span>
                  {penInput(penMature, setPenMature, "pen")}
                </>
              ) : (
                penInput(pen, setPen, "target pen")
              )}
              <Button
                size="sm"
                disabled={
                  pending ||
                  !name ||
                  (splitMode ? !penFirst || !penMature : !pen)
                }
                onClick={submit}
              >
                Add rule
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">
          Pen-move worklist ({worklist.length})
        </h2>
        {worklist.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Everyone is where they should be (or no rule applies).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Animal</th>
                  <th className="px-3 py-2 text-left">From</th>
                  <th className="px-3 py-2 text-left">→ To</th>
                  <th className="px-3 py-2 text-left">Rule</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {worklist.map((m) => (
                  <tr key={m.subjectId} className="border-t">
                    <td className="px-3 py-2 font-medium">{m.id}</td>
                    <td className="px-3 py-2">{m.from ?? "—"}</td>
                    <td className="px-3 py-2 font-medium">
                      {m.to}
                      {m.overCapacity && (
                        <span className="ml-2 text-[11px] text-destructive">
                          over capacity
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {m.rule}
                    </td>
                    <td className="px-3 py-2 text-right">
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
