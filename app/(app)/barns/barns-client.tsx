"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { createBarn, deleteBarn } from "./actions";

export type CatalogRow = {
  id: string;
  name: string;
  location: string | null;
  pens: number;
};

export function CatalogClient({ rows }: { rows: CatalogRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [loc, setLoc] = useState("");

  const add = () =>
    start(async () => {
      const res = await createBarn({ name, location: loc || undefined });
      if (res.error) return void toast.error(res.error);
      toast.success(`Barn “${name}” added.`);
      setName("");
      setLoc("");
      router.refresh();
    });

  const remove = (r: CatalogRow) =>
    start(async () => {
      const res = await deleteBarn(r.id);
      if (res.error) return void toast.error(res.error);
      toast.success(`Deleted “${r.name}”.`);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-auto border-collapse font-mono text-[11px] leading-tight tabular-nums">
            <thead className="border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
              <tr>
                <th className="px-2 text-left">Barn</th>
                <th className="px-2 text-left">Location</th>
                <th className="px-2 text-right">Pens</th>
                <th className="px-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/40 hover:bg-muted/30"
                >
                  <td className="px-2 font-medium">{r.name}</td>
                  <td className="px-2">{r.location ?? "—"}</td>
                  <td className="px-2 text-right">{r.pens}</td>
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
            <Label className="text-xs">Barn name</Label>
            <Input
              className="h-8 w-44 text-xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="North Barn"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Location</Label>
            <Input
              className="h-8 w-44 text-xs"
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
            />
          </div>
          <Button size="sm" disabled={pending || !name} onClick={add}>
            Add barn
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
