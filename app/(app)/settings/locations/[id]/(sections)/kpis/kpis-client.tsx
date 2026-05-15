"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  KPI_GROUPS,
  KPI_LABELS,
  DEFAULT_KPIS,
  type KpiKey,
  type Playbook,
} from "@/lib/playbook";
import { setKpiOverrides } from "../../playbook/actions";

const GROUP_TITLES: Record<keyof typeof KPI_GROUPS, string> = {
  reproduction: "Reproduction",
  health: "Health",
  milk_recording: "Milk recording",
  feeding: "Feeding",
  capacity: "Capacity & stocking",
};

export function KpisClient({
  locationId,
  playbook,
}: {
  locationId: string;
  playbook: Playbook;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const keys of Object.values(KPI_GROUPS)) {
      for (const k of keys) {
        const cur = playbook.kpi_overrides[k];
        v[k] = typeof cur === "number" ? String(cur) : "";
      }
    }
    return v;
  });

  const dirty = Object.entries(vals).some(([k, raw]) => {
    const cur = playbook.kpi_overrides[k as KpiKey];
    const curStr = typeof cur === "number" ? String(cur) : "";
    return raw !== curStr;
  });

  const save = () => {
    const overrides: Record<string, number | null> = {
      ...playbook.kpi_overrides,
    };
    for (const keys of Object.values(KPI_GROUPS)) {
      for (const k of keys) {
        const raw = vals[k];
        overrides[k] = raw === "" ? null : Number(raw);
      }
    }
    startTransition(async () => {
      const r = await setKpiOverrides({ location_id: locationId, overrides });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("KPIs saved. Hot list + engines will use the new values.");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={busy || !dirty}>
          {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {(Object.keys(KPI_GROUPS) as (keyof typeof KPI_GROUPS)[]).map(
          (groupKey) => (
            <section
              key={groupKey}
              className="ring-1 ring-foreground/10 flex flex-col"
            >
              <header className="px-3 py-2 bg-foreground/5">
                <h2 className="text-sm font-medium">
                  {GROUP_TITLES[groupKey]}
                </h2>
              </header>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {KPI_GROUPS[groupKey].map((k) => {
                  const overridden =
                    typeof playbook.kpi_overrides[k] === "number";
                  return (
                    <div key={k} className="flex flex-col gap-1">
                      <label className="text-[10px] text-muted-foreground">
                        {KPI_LABELS[k]}
                        <span className="ml-1 italic">
                          (default {DEFAULT_KPIS[k]})
                        </span>
                      </label>
                      <Input
                        type="number"
                        step="any"
                        value={vals[k]}
                        placeholder={`${DEFAULT_KPIS[k]}`}
                        onChange={(e) =>
                          setVals((p) => ({ ...p, [k]: e.target.value }))
                        }
                      />
                      {!overridden ? (
                        <span className="text-[9px] text-muted-foreground italic">
                          using default
                        </span>
                      ) : (
                        <span className="text-[9px] text-primary">
                          overridden
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ),
        )}
      </div>
    </div>
  );
}
