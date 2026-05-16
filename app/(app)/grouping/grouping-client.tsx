"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { addRule, deleteRule, moveAnimal } from "./actions";

export type RuleRow = {
  id: string;
  ordinal: number;
  name: string;
  cond: string;
  targetPen: string;
};
export type Move = {
  id: string;
  subjectId: string;
  from: string | null;
  to: string;
  rule: string;
};

export function GroupingClient({
  rules,
  worklist,
}: {
  rules: RuleRow[];
  worklist: Move[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [cond, setCond] = useState("");
  const [pen, setPen] = useState("");

  const submit = () =>
    start(async () => {
      const res = await addRule({ name, condition: cond, targetPen: pen });
      if (res.error) return void toast.error(res.error);
      toast.success(`Rule “${name}” added.`);
      setName("");
      setCond("");
      setPen("");
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

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Rules (first match wins)</h2>
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
                    <td className="px-3 py-2">{r.targetPen}</td>
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
          <CardContent className="flex flex-wrap items-end gap-3 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Rule name</Label>
              <Input
                className="h-8 w-44 text-xs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Close-up"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                When (condition, e.g. RC=6 DCC&gt;219)
              </Label>
              <Input
                className="h-8 w-72 font-mono text-xs"
                value={cond}
                onChange={(e) => setCond(e.target.value)}
                placeholder="RC=2 DIM=0-30"
                spellCheck={false}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Target pen</Label>
              <Input
                className="h-8 w-32 text-xs"
                value={pen}
                onChange={(e) => setPen(e.target.value)}
                placeholder="FRESH"
              />
            </div>
            <Button
              size="sm"
              disabled={pending || !name || !cond || !pen}
              onClick={submit}
            >
              Add rule
            </Button>
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
                    <td className="px-3 py-2 font-medium">{m.to}</td>
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
