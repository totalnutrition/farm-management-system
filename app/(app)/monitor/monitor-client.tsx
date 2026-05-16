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
  ITEMS,
  type ConditionValue,
} from "@/components/condition-builder";
import type { KpiResult } from "@/lib/derive/monitor";
import { addKpi, deleteKpi } from "./actions";

export type KpiRow = {
  id: string;
  result: KpiResult;
  metricLabel: string;
  direction: string;
  filterText: string;
};

const STATUS: Record<string, string> = {
  ok: "bg-green-500/15 text-green-600 dark:text-green-400",
  warn: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  alert: "bg-red-500/15 text-red-600 dark:text-red-400",
  nodata: "bg-muted text-muted-foreground",
};

export function MonitorClient({ rows }: { rows: KpiRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [cond, setCond] = useState<ConditionValue>({
    conds: [],
    matchAny: false,
  });
  const [metricKind, setMetricKind] = useState<"count" | "avg">("count");
  const [metricItem, setMetricItem] = useState("");
  const [goal, setGoal] = useState("");
  const [direction, setDirection] = useState<
    "higher_better" | "lower_better"
  >("higher_better");

  const submit = () =>
    start(async () => {
      const res = await addKpi({
        name,
        filter: condsToPredicate(cond),
        metricKind,
        metricItem: metricKind === "avg" ? metricItem : undefined,
        goal: Number(goal),
        direction,
      });
      if (res.error) return void toast.error(res.error);
      toast.success(`KPI “${name}” added.`);
      setName("");
      setCond({ conds: [], matchAny: false });
      setMetricKind("count");
      setMetricItem("");
      setGoal("");
      router.refresh();
    });

  const remove = (r: KpiRow) =>
    start(async () => {
      const res = await deleteKpi(r.id);
      if (res.error) return void toast.error(res.error);
      toast.success(`Deleted “${r.result.name}”.`);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No KPIs yet. Define one below.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 py-4">
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium">
                    {r.result.name}
                  </span>
                  <span
                    className={
                      "rounded px-1.5 py-0.5 text-[10px] uppercase " +
                      (STATUS[r.result.status] ?? "")
                    }
                  >
                    {r.result.status}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-2xl font-semibold">
                    {r.result.value ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    goal {r.result.goal}
                    {r.result.deltaPct !== null &&
                      ` · ${r.result.deltaPct > 0 ? "+" : ""}${r.result.deltaPct.toFixed(0)}%`}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {r.metricLabel} · {r.filterText}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => remove(r)}
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
              <Label className="text-xs">KPI name</Label>
              <Input
                className="h-7 w-48 text-xs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Fresh cows on hand"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Measure</Label>
              <Select
                value={metricKind}
                onValueChange={(v) => setMetricKind(v as "count" | "avg")}
              >
                <SelectTrigger className="h-7 w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Count of animals</SelectItem>
                  <SelectItem value="avg">Average of…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {metricKind === "avg" && (
              <div className="space-y-1">
                <Label className="text-xs">Item</Label>
                <Select value={metricItem} onValueChange={setMetricItem}>
                  <SelectTrigger className="h-7 w-[150px] text-xs">
                    <SelectValue placeholder="item" />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEMS.filter((i) => i.value !== "ID").map((i) => (
                      <SelectItem key={i.value} value={i.value}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Goal</Label>
              <Input
                className="h-7 w-24 text-xs"
                type="number"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Better when</Label>
              <Select
                value={direction}
                onValueChange={(v) =>
                  setDirection(v as "higher_better" | "lower_better")
                }
              >
                <SelectTrigger className="h-7 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="higher_better">higher</SelectItem>
                  <SelectItem value="lower_better">lower</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ConditionBuilder value={cond} onChange={setCond} />
          <Button
            size="sm"
            disabled={
              pending ||
              !name ||
              goal === "" ||
              (metricKind === "avg" && !metricItem)
            }
            onClick={submit}
          >
            Add KPI
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
