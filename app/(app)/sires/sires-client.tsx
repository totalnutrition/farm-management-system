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
import { createSire, deleteSire } from "./actions";

export type SireRow = {
  id: string;
  naab: string;
  breed: string | null;
  semenType: string;
};

export function SiresClient({ rows }: { rows: SireRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [naab, setNaab] = useState("");
  const [breed, setBreed] = useState("");
  const [stype, setStype] = useState<
    "conventional" | "sexed" | "beef"
  >("conventional");

  const add = () =>
    start(async () => {
      const res = await createSire({
        naab,
        breed: breed || undefined,
        semenType: stype,
      });
      if (res.error) return void toast.error(res.error);
      toast.success(`Sire “${naab}” added.`);
      setNaab("");
      setBreed("");
      router.refresh();
    });

  const remove = (r: SireRow) =>
    start(async () => {
      const res = await deleteSire(r.id);
      if (res.error) return void toast.error(res.error);
      toast.success(`Deleted “${r.naab}”.`);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Sire / NAAB</th>
                <th className="px-3 py-2 text-left">Breed</th>
                <th className="px-3 py-2 text-left">Semen</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{r.naab}</td>
                  <td className="px-3 py-2">{r.breed ?? "—"}</td>
                  <td className="px-3 py-2">{r.semenType}</td>
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
            <Label className="text-xs">Sire / NAAB code</Label>
            <Input
              className="h-8 w-36 text-xs"
              value={naab}
              onChange={(e) => setNaab(e.target.value)}
              placeholder="7HO1234"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Breed</Label>
            <Input
              className="h-8 w-24 text-xs"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder="HO"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Semen type</Label>
            <Select
              value={stype}
              onValueChange={(v) =>
                setStype(v as "conventional" | "sexed" | "beef")
              }
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conventional">Conventional</SelectItem>
                <SelectItem value="sexed">Sexed</SelectItem>
                <SelectItem value="beef">Beef</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" disabled={pending || !naab} onClick={add}>
            Add sire
          </Button>
        </CardContent>
      </Card>
      <p className="text-[11px] text-muted-foreground">
        Straw inventory is managed in Supply Chain (category “Semen
        &amp; Genetics”). Auto-decrement on BRED is a documented next
        step.
      </p>
    </div>
  );
}
