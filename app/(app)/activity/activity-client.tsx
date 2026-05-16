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
import { markActivity, resolveActivity } from "./actions";

export type FlagRow = { animalId: string; activity: string };

const ACTIVITIES = [
  "HEAT",
  "SICK",
  "WOUND",
  "LAME",
  "CHECK",
  "MASTITIS",
  "OTHER",
];

export function ActivityClient({
  animals,
  rows,
}: {
  animals: string[];
  rows: FlagRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [animal, setAnimal] = useState("");
  const [activity, setActivity] = useState("HEAT");
  const [note, setNote] = useState("");

  const mark = () =>
    start(async () => {
      const res = await markActivity({
        animalId: animal,
        activity,
        note: note || undefined,
      });
      if (res.error) return void toast.error(res.error);
      toast.success(`${animal} marked: ${activity}.`);
      setNote("");
      router.refresh();
    });

  const resolve = (a: string) =>
    start(async () => {
      const res = await resolveActivity(a);
      if (res.error) return void toast.error(res.error);
      toast.success(`${a} resolved.`);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-1">
            <Label className="text-xs">Animal</Label>
            <Select value={animal} onValueChange={setAnimal}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="animal" />
              </SelectTrigger>
              <SelectContent>
                {animals.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    no animals
                  </SelectItem>
                ) : (
                  animals.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Activity</Label>
            <Select value={activity} onValueChange={setActivity}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITIES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Note</Label>
            <Input
              className="h-8 w-48 text-xs"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            disabled={pending || !animal}
            onClick={mark}
          >
            Mark
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">
          Needs attention ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing flagged.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Animal</th>
                  <th className="px-3 py-2 text-left">For</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.animalId} className="border-t">
                    <td className="px-3 py-2 font-medium">
                      {r.animalId}
                    </td>
                    <td className="px-3 py-2">{r.activity}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => resolve(r.animalId)}
                      >
                        Resolve
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
