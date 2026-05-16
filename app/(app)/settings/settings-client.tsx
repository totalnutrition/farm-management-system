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
import { saveSettings } from "./actions";

// Region-neutral herd assumptions (all numeric, canonical/metric).
const PARAMS: { key: string; label: string }[] = [
  { key: "vwp_days", label: "Voluntary waiting period (days)" },
  { key: "dry_lead_days", label: "Dry-off lead before due (days)" },
  { key: "closeup_days", label: "Close-up window (days)" },
  { key: "gestation_days", label: "Gestation length (days)" },
  { key: "cull_rate_pct", label: "Assumed annual cull rate (%)" },
  { key: "milk_price", label: "Milk price (per L, canonical)" },
  { key: "feed_price", label: "Feed price (per kg DM, canonical)" },
];

export function SettingsClient({
  unitSystem,
  country,
  params,
}: {
  unitSystem: "metric" | "imperial";
  country: string;
  params: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [unit, setUnit] = useState(unitSystem);
  const [ctry, setCtry] = useState(country);
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(
      PARAMS.map((p) => [
        p.key,
        params[p.key] != null ? String(params[p.key]) : "",
      ]),
    ),
  );

  const save = () =>
    start(async () => {
      const numeric: Record<string, number> = {};
      for (const p of PARAMS) {
        const v = vals[p.key];
        if (v !== "" && Number.isFinite(Number(v)))
          numeric[p.key] = Number(v);
      }
      const res = await saveSettings({
        unitSystem: unit,
        country: ctry || "XX",
        params: numeric,
      });
      if (res.error) return void toast.error(res.error);
      toast.success("Settings saved.");
      router.refresh();
    });

  return (
    <Card>
      <CardContent className="space-y-5 py-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Unit system</Label>
            <Select
              value={unit}
              onValueChange={(v) => setUnit(v as "metric" | "imperial")}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="metric">Metric (kg, °C, L)</SelectItem>
                <SelectItem value="imperial">
                  Imperial (lb, °F, gal)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Country / region code</Label>
            <Input
              className="h-8 w-24 text-xs uppercase"
              value={ctry}
              maxLength={3}
              onChange={(e) => setCtry(e.target.value.toUpperCase())}
              placeholder="XX"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">
            Herd assumptions
          </Label>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PARAMS.map((p) => (
              <div key={p.key} className="space-y-1">
                <Label className="text-xs">{p.label}</Label>
                <Input
                  className="h-8 text-xs"
                  type="number"
                  value={vals[p.key]}
                  onChange={(e) =>
                    setVals((s) => ({ ...s, [p.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
