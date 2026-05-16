"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { projectHerd, type ProjAnimal } from "@/lib/derive/projection";

const CHECKPOINTS = [0, 30, 60, 90, 180, 365];

export function ProjectionClient({
  herd,
  defaultCullRate,
}: {
  herd: ProjAnimal[];
  defaultCullRate: number;
}) {
  const [cull, setCull] = useState(String(defaultCullRate));
  const [dryAt, setDryAt] = useState("305");

  const points = useMemo(
    () =>
      projectHerd(
        herd,
        {
          dryAtDim: Number(dryAt) || 305,
          cullRatePct: Number(cull) || 0,
        },
        365,
        CHECKPOINTS,
      ),
    [herd, cull, dryAt],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Annual cull rate (%)</Label>
          <Input
            className="h-8 w-28 text-xs"
            type="number"
            value={cull}
            onChange={(e) => setCull(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Dry off at DIM</Label>
          <Input
            className="h-8 w-28 text-xs"
            type="number"
            value={dryAt}
            onChange={(e) => setDryAt(e.target.value)}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {herd.length} animals · Wood&apos;s lactation curve
          (standard-science defaults).
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Horizon</th>
              <th className="px-3 py-2 text-left">Herd milk/day (kg)</th>
              <th className="px-3 py-2 text-left">Milking cows</th>
              <th className="px-3 py-2 text-left">Dry / other</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day} className="border-t">
                <td className="px-3 py-2 font-medium">
                  {p.day === 0 ? "today" : `+${p.day}d`}
                </td>
                <td className="px-3 py-2">{p.totalKg}</td>
                <td className="px-3 py-2">{p.milking}</td>
                <td className="px-3 py-2">{p.dry}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Deterministic from current pregnancies + curve; cull rate is a
        flat daily attrition approximation. Curve coefficients become
        configurable per herd in a later step.
      </p>
    </div>
  );
}
