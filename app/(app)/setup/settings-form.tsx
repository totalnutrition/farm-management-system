"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HerdSettings } from "@/lib/herd";
import { saveHerdSettings } from "./actions";

const FIELDS: { key: keyof HerdSettings; label: string; hint: string }[] = [
  { key: "voluntary_wait_days", label: "Voluntary wait (days)", hint: "Earliest DIM a cow becomes breeding-eligible" },
  { key: "gestation_days", label: "Gestation (days)", hint: "Used to project calving and dry-off" },
  { key: "preg_check_days", label: "Preg-check after (days bred)", hint: "When a bred cow is due for confirmation" },
  { key: "dry_off_days_before", label: "Dry off (days before calving)", hint: "Dry-off worklist trigger" },
  { key: "kpi_repro_pr_target", label: "Repro PR target", hint: "Monitor threshold" },
  { key: "kpi_max_days_open", label: "Max days open", hint: "Monitor threshold" },
  { key: "kpi_max_dim_open", label: "Max DIM open", hint: "Open-over-target trigger" },
];

export function SettingsForm({ settings }: { settings: HerdSettings }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      FIELDS.map((f) => [f.key, String(settings[f.key])]),
    ),
  );
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const payload = Object.fromEntries(
        FIELDS.map((f) => [f.key, Number(values[f.key])]),
      ) as Parameters<typeof saveHerdSettings>[0];
      const result = await saveHerdSettings(payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Herd settings saved.");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <label className="text-xs font-medium">{f.label}</label>
            <Input
              type="number"
              value={values[f.key]}
              onChange={(e) =>
                setValues((p) => ({ ...p, [f.key]: e.target.value }))
              }
            />
            <span className="text-xs text-muted-foreground">{f.hint}</span>
          </div>
        ))}
      </div>
      <div>
        <Button type="button" disabled={isPending} onClick={submit}>
          {isPending ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
