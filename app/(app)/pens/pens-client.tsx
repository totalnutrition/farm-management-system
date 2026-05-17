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
import { createPen, deletePen, PEN_TYPES } from "./actions";

export type PenRow = {
  id: string;
  penNo: number;
  types: string[];
  capacity: number | null;
  label: string | null;
  barn: string | null;
  count: number;
};

export function PensClient({
  rows,
  barns,
}: {
  rows: PenRow[];
  barns: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [penNo, setPenNo] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [capacity, setCapacity] = useState("");
  const [label, setLabel] = useState("");
  const [barn, setBarn] = useState("");

  const toggle = (t: string) =>
    setTypes((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  const submit = () =>
    start(async () => {
      const res = await createPen({
        penNo: Number(penNo),
        types: types as (typeof PEN_TYPES)[number][],
        capacity: capacity ? Number(capacity) : undefined,
        label: label || undefined,
        barn: barn || undefined,
      });
      if (res.error) return void toast.error(res.error);
      toast.success(`Pen ${penNo} added.`);
      setPenNo("");
      setTypes([]);
      setCapacity("");
      setLabel("");
      setBarn("");
      router.refresh();
    });

  const remove = (r: PenRow) =>
    start(async () => {
      const res = await deletePen(r.id);
      if (res.error) return void toast.error(res.error);
      toast.success(`Pen ${r.penNo} deleted.`);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pens yet. Add one below.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-auto border-collapse font-mono text-[11px] leading-tight tabular-nums">
            <thead className="border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
              <tr>
                <th className="px-2 text-right">Pen</th>
                <th className="px-2 text-left">Label</th>
                <th className="px-2 text-left">Barn</th>
                <th className="px-2 text-left">Types</th>
                <th className="px-2 text-right">Cap</th>
                <th className="px-2 text-right">In</th>
                <th className="px-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/40 hover:bg-muted/30"
                >
                  <td className="px-2 text-right font-medium">
                    {r.penNo}
                  </td>
                  <td className="px-2">{r.label ?? "—"}</td>
                  <td className="px-2">{r.barn ?? "—"}</td>
                  <td className="px-2">
                    <span className="flex flex-wrap gap-1">
                      {r.types.length === 0
                        ? "—"
                        : r.types.map((t) => (
                            <span
                              key={t}
                              className="rounded bg-muted px-1 text-[10px]"
                            >
                              {t}
                            </span>
                          ))}
                    </span>
                  </td>
                  <td className="px-2 text-right">
                    {r.capacity ?? "∞"}
                  </td>
                  <td
                    className={
                      "px-2 text-right " +
                      (r.capacity != null && r.count > r.capacity
                        ? "text-destructive"
                        : "")
                    }
                  >
                    {r.count}
                  </td>
                  <td className="px-2 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => remove(r)}
                      className="text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
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
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-1">
            <Label className="text-xs">Pen # (1–9999)</Label>
            <Input
              className="h-8 w-24 text-xs"
              type="number"
              min={1}
              max={9999}
              value={penNo}
              onChange={(e) => setPenNo(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Types</Label>
            <div className="flex flex-wrap gap-1">
              {PEN_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggle(t)}
                  className={
                    "rounded-full border px-2 py-0.5 text-[11px] transition-colors " +
                    (types.includes(t)
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:bg-muted")
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Capacity</Label>
            <Input
              className="h-8 w-24 text-xs"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="∞"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Label</Label>
            <Input
              className="h-8 w-40 text-xs"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Fresh pen"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Barn</Label>
            <Select
              value={barn || "none"}
              onValueChange={(v) => setBarn(v === "none" ? "" : v)}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="none" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {barns.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            disabled={pending || !penNo || types.length === 0}
            onClick={submit}
          >
            Add pen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
