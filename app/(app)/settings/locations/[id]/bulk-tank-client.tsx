"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  recordDiversion,
  recordTankReading,
  type Diversion,
  type TankReading,
} from "./bulk-tank-actions";

const today = () => new Date().toISOString().slice(0, 10);

export function BulkTankClient({
  locationId,
  readings,
  diversions,
}: {
  locationId: string;
  readings: TankReading[];
  diversions: Diversion[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Reading form
  const [r, setR] = useState({
    reading_date: today(),
    volume_kg: "" as string,
    fat_pct: "" as string,
    protein_pct: "" as string,
    scc: "" as string,
    notes: "" as string,
  });

  // Diversion form
  const [d, setD] = useState({
    diversion_date: today(),
    kg: "" as string,
    bucket: "hospital",
    notes: "" as string,
  });

  const onSaveReading = () => {
    startTransition(async () => {
      const result = await recordTankReading({
        location_id: locationId,
        reading_date: r.reading_date,
        volume_kg: r.volume_kg === "" ? null : Number(r.volume_kg),
        fat_pct: r.fat_pct === "" ? null : Number(r.fat_pct),
        protein_pct: r.protein_pct === "" ? null : Number(r.protein_pct),
        scc: r.scc === "" ? null : Number(r.scc),
        notes: r.notes || null,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Reading saved.");
      router.refresh();
    });
  };

  const onSaveDiversion = () => {
    startTransition(async () => {
      const result = await recordDiversion({
        location_id: locationId,
        diversion_date: d.diversion_date,
        kg: Number(d.kg || 0),
        bucket: d.bucket as
          | "hospital"
          | "calves"
          | "waste"
          | "dumped"
          | "spilled"
          | "other",
        notes: d.notes || null,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Diversion recorded.");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <h2 className="text-sm font-medium">Record a tank reading</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs">Date</label>
            <Input
              type="date"
              value={r.reading_date}
              onChange={(e) => setR({ ...r, reading_date: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs">Volume (kg)</label>
            <Input
              type="number"
              inputMode="decimal"
              value={r.volume_kg}
              onChange={(e) => setR({ ...r, volume_kg: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs">Fat %</label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={r.fat_pct}
              onChange={(e) => setR({ ...r, fat_pct: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs">Protein %</label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={r.protein_pct}
              onChange={(e) => setR({ ...r, protein_pct: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs">SCC</label>
            <Input
              type="number"
              inputMode="numeric"
              value={r.scc}
              onChange={(e) => setR({ ...r, scc: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-3">
            <label className="text-xs">Notes</label>
            <Textarea
              rows={2}
              value={r.notes}
              onChange={(e) => setR({ ...r, notes: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="button" disabled={isPending} onClick={onSaveReading}>
            Save reading
          </Button>
        </div>
      </section>

      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <h2 className="text-sm font-medium">Record a diversion</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs">Date</label>
            <Input
              type="date"
              value={d.diversion_date}
              onChange={(e) => setD({ ...d, diversion_date: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs">Bucket</label>
            <Select value={d.bucket} onValueChange={(v) => setD({ ...d, bucket: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["hospital", "calves", "waste", "dumped", "spilled", "other"] as const).map((b) => (
                  <SelectItem key={b} value={b} className="capitalize">
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs">Volume (kg)</label>
            <Input
              type="number"
              inputMode="decimal"
              value={d.kg}
              onChange={(e) => setD({ ...d, kg: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs">Notes</label>
            <Input
              value={d.notes}
              onChange={(e) => setD({ ...d, notes: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="button" disabled={isPending} onClick={onSaveDiversion}>
            Save diversion
          </Button>
        </div>
      </section>

      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <h2 className="text-sm font-medium">Recent readings</h2>
        <div className="ring-1 ring-foreground/10 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-foreground/5">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium text-right">Volume (kg)</th>
                <th className="px-3 py-2 font-medium text-right">Fat %</th>
                <th className="px-3 py-2 font-medium text-right">Protein %</th>
                <th className="px-3 py-2 font-medium text-right">SCC</th>
              </tr>
            </thead>
            <tbody>
              {readings.length === 0 ? (
                <tr>
                  <td className="px-3 py-2 text-muted-foreground" colSpan={5}>
                    No readings yet.
                  </td>
                </tr>
              ) : (
                readings.map((row) => (
                  <tr key={row.id} className="border-t border-foreground/10">
                    <td className="px-3 py-2">{row.reading_date}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.volume_kg ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.fat_pct ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.protein_pct ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.scc ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <h2 className="text-sm font-medium">Recent diversions</h2>
        <div className="ring-1 ring-foreground/10 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-foreground/5">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Bucket</th>
                <th className="px-3 py-2 font-medium text-right">kg</th>
                <th className="px-3 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {diversions.length === 0 ? (
                <tr>
                  <td className="px-3 py-2 text-muted-foreground" colSpan={4}>
                    No diversions yet.
                  </td>
                </tr>
              ) : (
                diversions.map((row) => (
                  <tr key={row.id} className="border-t border-foreground/10">
                    <td className="px-3 py-2">{row.diversion_date}</td>
                    <td className="px-3 py-2 capitalize">{row.bucket}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.kg}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.notes ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
