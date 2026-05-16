"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { addProtocol, deleteProtocol, doProtocolStep } from "./actions";

export type ProtocolRow = {
  id: string;
  name: string;
  enrollText: string;
  anchor: string;
  steps: string[];
};
export type TaskRow = {
  id: string;
  subjectId: string;
  protocol: string;
  step: string;
  dueDate: string;
  status: "due" | "overdue";
  eventCode?: number;
};
export type CodeOption = { code: number; label: string };

const ANCHORS = [
  { value: "FDAT", label: "Fresh date" },
  { value: "DDAT", label: "Dry date" },
];

type Step = { dayOffset: string; label: string; eventCode: string };

export function ProtocolsClient({
  protocols,
  tasks,
  codes,
}: {
  protocols: ProtocolRow[];
  tasks: TaskRow[];
  codes: CodeOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [cond, setCond] = useState<ConditionValue>({
    conds: [],
    matchAny: false,
  });
  const [anchor, setAnchor] = useState("FDAT");
  const [steps, setSteps] = useState<Step[]>([
    { dayOffset: "", label: "", eventCode: "" },
  ]);

  const submit = () =>
    start(async () => {
      const enroll = condsToPredicate(cond);
      if (!enroll)
        return void toast.error("Add an enrollment condition.");
      const cleanSteps = steps
        .filter((s) => s.dayOffset !== "" && s.label.trim())
        .map((s) => ({
          dayOffset: Number(s.dayOffset),
          label: s.label.trim(),
          eventCode: s.eventCode ? Number(s.eventCode) : undefined,
        }));
      if (cleanSteps.length === 0)
        return void toast.error("Add at least one step.");
      const res = await addProtocol({
        name,
        enroll,
        anchor,
        steps: cleanSteps,
      });
      if (res.error) return void toast.error(res.error);
      toast.success(`Protocol “${name}” added.`);
      setName("");
      setCond({ conds: [], matchAny: false });
      setSteps([{ dayOffset: "", label: "", eventCode: "" }]);
      router.refresh();
    });

  const remove = (p: ProtocolRow) =>
    start(async () => {
      const res = await deleteProtocol(p.id);
      if (res.error) return void toast.error(res.error);
      toast.success(`Deleted “${p.name}”.`);
      router.refresh();
    });

  const done = (t: TaskRow) =>
    start(async () => {
      if (t.eventCode == null)
        return void toast.error("This step has no event to record.");
      const res = await doProtocolStep({
        subjectId: t.subjectId,
        eventCode: t.eventCode,
      });
      if (res.error) return void toast.error(res.error);
      toast.success(`${t.id}: ${t.step} recorded.`);
      router.refresh();
    });

  const setStep = (i: number, k: keyof Step, v: string) =>
    setSteps((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-medium">
          Tasks due today ({tasks.length})
        </h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing due (or no protocols / enrolled animals).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Animal</th>
                  <th className="px-3 py-2 text-left">Protocol</th>
                  <th className="px-3 py-2 text-left">Step</th>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {tasks.map((t, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 font-medium">{t.id}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {t.protocol}
                    </td>
                    <td className="px-3 py-2">
                      {t.step}
                      {t.status === "overdue" && (
                        <span className="ml-2 text-[11px] text-destructive">
                          overdue
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {t.dueDate}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {t.eventCode != null && (
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() => done(t)}
                        >
                          Done
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Protocols</h2>
        {protocols.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No protocols yet. Define one below.
          </p>
        ) : (
          <div className="space-y-2">
            {protocols.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      enroll: <span className="font-mono">{p.enrollText}</span>{" "}
                      · anchor {p.anchor}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.steps.join(" → ")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => remove(p)}
                  >
                    Delete
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Protocol name</Label>
                <Input
                  className="h-7 w-48 text-xs"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Presynch-Ovsynch"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Anchor date</Label>
                <Select value={anchor} onValueChange={setAnchor}>
                  <SelectTrigger className="h-7 w-[150px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANCHORS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Enroll animals where</Label>
              <ConditionBuilder value={cond} onChange={setCond} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Steps</Label>
              {steps.map((s, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">day</span>
                  <Input
                    className="h-7 w-16 text-xs"
                    type="number"
                    value={s.dayOffset}
                    onChange={(e) =>
                      setStep(i, "dayOffset", e.target.value)
                    }
                  />
                  <Input
                    className="h-7 w-40 text-xs"
                    placeholder="step label (e.g. GnRH)"
                    value={s.label}
                    onChange={(e) => setStep(i, "label", e.target.value)}
                  />
                  <Select
                    value={s.eventCode || "none"}
                    onValueChange={(v) =>
                      setStep(i, "eventCode", v === "none" ? "" : v)
                    }
                  >
                    <SelectTrigger className="h-7 w-[150px] text-xs">
                      <SelectValue placeholder="event (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">no event</SelectItem>
                      {codes.map((c) => (
                        <SelectItem key={c.code} value={String(c.code)}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    aria-label="remove step"
                    className="px-1 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      setSteps((st) => st.filter((_, j) => j !== i))
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setSteps((st) => [
                    ...st,
                    { dayOffset: "", label: "", eventCode: "" },
                  ])
                }
                className="rounded border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
              >
                + step
              </button>
            </div>

            <Button
              size="sm"
              disabled={pending || !name}
              onClick={submit}
            >
              Add protocol
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
