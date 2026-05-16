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
import { createRation, deleteRation, recordFeeding } from "./actions";

export type RationRow = { id: string; name: string; costPerKg: number };
export type PenFeed = {
  pen: string;
  kg: number | null;
  refused: number | null;
  cost: number | null;
  shrink: number | null;
};

const today = () => new Date().toISOString().slice(0, 10);

export function FeedClient({
  rations,
  pens,
  penFeed,
}: {
  rations: RationRow[];
  pens: string[];
  penFeed: PenFeed[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rName, setRName] = useState("");
  const [rCost, setRCost] = useState("");
  const [pen, setPen] = useState("");
  const [ration, setRation] = useState("");
  const [kg, setKg] = useState("");
  const [refused, setRefused] = useState("");
  const [date, setDate] = useState(today());

  const addRation = () =>
    start(async () => {
      const res = await createRation({
        name: rName,
        costPerKg: Number(rCost || 0),
      });
      if (res.error) return void toast.error(res.error);
      toast.success(`Ration “${rName}” added.`);
      setRName("");
      setRCost("");
      router.refresh();
    });

  const delRation = (r: RationRow) =>
    start(async () => {
      const res = await deleteRation(r.id);
      if (res.error) return void toast.error(res.error);
      toast.success(`Deleted “${r.name}”.`);
      router.refresh();
    });

  const feed = () =>
    start(async () => {
      const res = await recordFeeding({
        penNo: pen,
        ration,
        kg: Number(kg),
        refusedKg: refused ? Number(refused) : undefined,
        date,
      });
      if (res.error) return void toast.error(res.error);
      toast.success(`Fed pen ${pen}.`);
      setKg("");
      setRefused("");
      router.refresh();
    });

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Pen feed summary</h2>
        {penFeed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No feeding recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Pen</th>
                  <th className="px-3 py-2 text-left">Delivered (kg)</th>
                  <th className="px-3 py-2 text-left">Refused (kg)</th>
                  <th className="px-3 py-2 text-left">Cost</th>
                  <th className="px-3 py-2 text-left">Shrink %</th>
                </tr>
              </thead>
              <tbody>
                {penFeed.map((p) => (
                  <tr key={p.pen} className="border-t">
                    <td className="px-3 py-2 font-medium">{p.pen}</td>
                    <td className="px-3 py-2">{p.kg ?? "—"}</td>
                    <td className="px-3 py-2">{p.refused ?? "—"}</td>
                    <td className="px-3 py-2">{p.cost ?? "—"}</td>
                    <td className="px-3 py-2">{p.shrink ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Record feeding</h2>
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Pen</Label>
              <Select value={pen} onValueChange={setPen}>
                <SelectTrigger className="h-7 w-[120px] text-xs">
                  <SelectValue placeholder="pen" />
                </SelectTrigger>
                <SelectContent>
                  {pens.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      no pens
                    </SelectItem>
                  ) : (
                    pens.map((p) => (
                      <SelectItem key={p} value={p}>
                        Pen {p}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ration</Label>
              <Select value={ration} onValueChange={setRation}>
                <SelectTrigger className="h-7 w-[150px] text-xs">
                  <SelectValue placeholder="ration" />
                </SelectTrigger>
                <SelectContent>
                  {rations.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      add a ration first
                    </SelectItem>
                  ) : (
                    rations.map((r) => (
                      <SelectItem key={r.id} value={r.name}>
                        {r.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Delivered kg</Label>
              <Input
                className="h-7 w-24 text-xs"
                type="number"
                value={kg}
                onChange={(e) => setKg(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Refused kg</Label>
              <Input
                className="h-7 w-24 text-xs"
                type="number"
                value={refused}
                onChange={(e) => setRefused(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                className="h-7 w-36 text-xs"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              disabled={pending || !pen || !ration || !kg}
              onClick={feed}
            >
              Record
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Rations</h2>
        {rations.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Ration</th>
                  <th className="px-3 py-2 text-left">Cost / kg</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rations.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2">{r.costPerKg}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => delRation(r)}
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
              <Label className="text-xs">Ration name</Label>
              <Input
                className="h-7 w-44 text-xs"
                value={rName}
                onChange={(e) => setRName(e.target.value)}
                placeholder="Lactating TMR"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cost / kg</Label>
              <Input
                className="h-7 w-24 text-xs"
                type="number"
                value={rCost}
                onChange={(e) => setRCost(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              disabled={pending || !rName}
              onClick={addRation}
            >
              Add ration
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
