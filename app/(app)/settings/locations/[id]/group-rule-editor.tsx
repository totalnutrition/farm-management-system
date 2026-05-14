"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateGroupRules } from "./groups-actions";

type LocationGroupLite = {
  id: string;
  label: string;
  rule_predicates: Record<string, unknown>;
};

const PREDICATE_FIELDS: { key: string; label: string; type: "int" | "num" | "bool"; group: "lact" | "repro" | "age" | "state" }[] =
  [
    { key: "dim_min", label: "DIM min", type: "int", group: "lact" },
    { key: "dim_max", label: "DIM max", type: "int", group: "lact" },
    { key: "daily_milk_min", label: "Daily milk min (kg)", type: "num", group: "lact" },
    { key: "daily_milk_max", label: "Daily milk max (kg)", type: "num", group: "lact" },
    { key: "parity", label: "Parity =", type: "int", group: "repro" },
    { key: "parity_min", label: "Parity min", type: "int", group: "repro" },
    { key: "pregnancy_days_min", label: "Pregnancy days min", type: "int", group: "repro" },
    { key: "pregnancy_days_max", label: "Pregnancy days max", type: "int", group: "repro" },
    { key: "age_months_min", label: "Age (mo) min", type: "int", group: "age" },
    { key: "age_months_max", label: "Age (mo) max", type: "int", group: "age" },
    { key: "dry", label: "Dry = true", type: "bool", group: "state" },
    { key: "health_flag", label: "Health flag = true", type: "bool", group: "state" },
  ];

const GROUP_LABEL: Record<string, string> = {
  lact: "Lactation",
  repro: "Reproduction",
  age: "Age",
  state: "State",
};

export function GroupRuleEditor({ group }: { group: LocationGroupLite }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>(
    group.rule_predicates,
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const updateField = (key: string, value: unknown) => {
    setDraft((prev) => {
      const next = { ...prev };
      if (value === "" || value === undefined || value === null || value === false) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const onSave = () => {
    startTransition(async () => {
      const result = await updateGroupRules({
        group_id: group.id,
        rule_predicates: draft,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Rule updated.");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(group.rule_predicates);
      }}
    >
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon icon={PencilEdit02Icon} />
        Edit rule
      </Button>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rule — {group.label}</DialogTitle>
          <DialogDescription>
            Leave fields blank to omit. The engine evaluates set predicates
            as AND. <span className="font-medium">Daily milk</span> is
            evaluated against a 7-day average — cows with no recent
            milkings skip the check (lenient).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {(["lact", "repro", "age", "state"] as const).map((groupKey) => {
            const fields = PREDICATE_FIELDS.filter((f) => f.group === groupKey);
            return (
              <section
                key={groupKey}
                className="ring-1 ring-foreground/10 p-3 flex flex-col gap-2"
              >
                <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {GROUP_LABEL[groupKey]}
                </h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {fields.map((f) => {
                    const current = draft[f.key];
                    if (f.type === "bool") {
                      return (
                        <label
                          key={f.key}
                          className="flex items-center gap-2 text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={current === true}
                            onChange={(e) => updateField(f.key, e.target.checked)}
                          />
                          {f.label}
                        </label>
                      );
                    }
                    return (
                      <div key={f.key} className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">
                          {f.label}
                        </label>
                        <Input
                          type="number"
                          inputMode={f.type === "num" ? "decimal" : "numeric"}
                          step={f.type === "num" ? "any" : "1"}
                          value={typeof current === "number" ? current : ""}
                          onChange={(e) =>
                            updateField(
                              f.key,
                              e.target.value === "" ? "" : Number(e.target.value),
                            )
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
