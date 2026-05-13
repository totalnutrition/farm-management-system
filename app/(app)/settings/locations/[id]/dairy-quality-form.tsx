"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { DairySettings } from "@/lib/dairy-settings";
import { upsertDairySettings } from "./dairy-settings-actions";

const numOrEmpty = z.union([z.number(), z.literal("")]);

const formSchema = z.object({
  scc_hospital_threshold: z.number().min(0).max(10_000_000),
  scc_linear_score_hospital: z.number().min(0).max(10),
  fat_target_pct: numOrEmpty,
  protein_target_pct: numOrEmpty,
  withdrawal_auto_flag: z.boolean(),
  withdrawal_extra_label_multiplier: z.number().min(0.1).max(10),
  withdrawal_lookback_days: z.number().min(0).max(365),
  cull_rate_target_pct: numOrEmpty,
  rha_milk_target_kg: numOrEmpty,
});

type FormValues = z.infer<typeof formSchema>;

export function DairyQualityForm({
  locationId,
  initial,
}: {
  locationId: string;
  initial: DairySettings;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      scc_hospital_threshold: initial.scc_hospital_threshold,
      scc_linear_score_hospital: initial.scc_linear_score_hospital,
      fat_target_pct: initial.fat_target_pct ?? ("" as unknown as number),
      protein_target_pct: initial.protein_target_pct ?? ("" as unknown as number),
      withdrawal_auto_flag: initial.withdrawal_auto_flag,
      withdrawal_extra_label_multiplier: initial.withdrawal_extra_label_multiplier,
      withdrawal_lookback_days: initial.withdrawal_lookback_days,
      cull_rate_target_pct:
        initial.cull_rate_target_pct ?? ("" as unknown as number),
      rha_milk_target_kg:
        initial.rha_milk_target_kg ?? ("" as unknown as number),
    },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await upsertDairySettings({
        location_id: locationId,
        ...initial,
        ...values,
        fat_target_pct:
          typeof values.fat_target_pct === "number"
            ? values.fat_target_pct
            : null,
        protein_target_pct:
          typeof values.protein_target_pct === "number"
            ? values.protein_target_pct
            : null,
        cull_rate_target_pct:
          typeof values.cull_rate_target_pct === "number"
            ? values.cull_rate_target_pct
            : null,
        rha_milk_target_kg:
          typeof values.rha_milk_target_kg === "number"
            ? values.rha_milk_target_kg
            : null,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Quality &amp; withdrawal settings saved.");
      router.refresh();
    });
  };

  const NumberField = ({
    name,
    label,
    suffix,
    hint,
    step,
  }: {
    name: keyof FormValues;
    label: string;
    suffix?: string;
    hint?: string;
    step?: string;
  }) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">{label}</FormLabel>
          <FormControl>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                step={step ?? "0.01"}
                value={field.value === "" || field.value === undefined || field.value === false || field.value === true
                  ? (typeof field.value === "boolean" ? "" : (field.value as string))
                  : (field.value as number)}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
              />
              {suffix ? (
                <span className="text-xs text-muted-foreground shrink-0">
                  {suffix}
                </span>
              ) : null}
            </div>
          </FormControl>
          {hint ? <FormDescription className="text-[10px]">{hint}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <header className="flex flex-col gap-0.5">
            <h2 className="text-sm font-medium">Milk quality thresholds</h2>
            <p className="text-xs text-muted-foreground">
              Hospital-pen triggers and component targets used by reports.
            </p>
          </header>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberField
              name="scc_hospital_threshold"
              label="SCC threshold for hospital flag"
              suffix="cells/mL"
              hint="Flag cows with SCC above this value (default 400,000)."
              step="1000"
            />
            <NumberField
              name="scc_linear_score_hospital"
              label="Linear score threshold"
              suffix="LS"
              hint="Equivalent linear score (LS 4 ≈ 200k SCC; LS 5 ≈ 400k)."
              step="0.1"
            />
            <NumberField
              name="fat_target_pct"
              label="Bulk-tank fat target"
              suffix="%"
              hint="Target average fat in the tank. Leave blank to disable."
            />
            <NumberField
              name="protein_target_pct"
              label="Bulk-tank protein target"
              suffix="%"
              hint="Target average protein in the tank."
            />
          </div>
        </section>

        <section className="flex flex-col gap-3 border-t pt-4">
          <header className="flex flex-col gap-0.5">
            <h2 className="text-sm font-medium">Withdrawal policy</h2>
            <p className="text-xs text-muted-foreground">
              Auto-flag cows under milk / meat withdrawal so their milk
              doesn&apos;t reach the bulk tank and they aren&apos;t shipped to
              slaughter inside the hold window.
            </p>
          </header>
          <FormField
            control={form.control}
            name="withdrawal_auto_flag"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between gap-3 ring-1 ring-foreground/10 p-3">
                <div className="flex flex-col gap-0.5">
                  <FormLabel className="font-normal">
                    Auto-flag animals on withdrawal
                  </FormLabel>
                  <FormDescription className="text-xs">
                    When a treatment is recorded with a withdrawal end date,
                    flag the cow's milk / meat as held until that date.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberField
              name="withdrawal_extra_label_multiplier"
              label="Extra-label safety multiplier"
              hint="Multiply label withdrawal time by this factor for extra-label use (default 1.0; vets often use 1.5–2.0)."
              step="0.1"
            />
            <NumberField
              name="withdrawal_lookback_days"
              label="Recent treatment lookback"
              suffix="days"
              hint="When deciding if a cow may be on withdrawal, look back this many days."
              step="1"
            />
          </div>
        </section>

        <section className="flex flex-col gap-3 border-t pt-4">
          <header className="flex flex-col gap-0.5">
            <h2 className="text-sm font-medium">Herd-level targets</h2>
            <p className="text-xs text-muted-foreground">
              Used by dashboards and reports. Leave blank to skip.
            </p>
          </header>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberField
              name="cull_rate_target_pct"
              label="Cull rate target"
              suffix="%/yr"
              hint="Industry typical: 30–35%."
            />
            <NumberField
              name="rha_milk_target_kg"
              label="Rolling herd avg milk target"
              suffix="kg/yr"
              hint="Target rolling herd average per cow per year."
              step="1"
            />
          </div>
        </section>

        <div className="flex justify-end border-t pt-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save quality & withdrawal"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
