"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
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
import { Textarea } from "@/components/ui/textarea";
import type { HerdProfile } from "@/lib/herd-profile";
import {
  upsertHerdProfile,
  upsertHerdProfileAndAdvance,
} from "./groups-actions";

const formSchema = z.object({
  target_lactating_count: z.number().int().min(0).max(1_000_000),
  target_dry_count: z.number().int().min(0).max(1_000_000),
  target_heifer_count: z.number().int().min(0).max(1_000_000),
  target_calf_count: z.number().int().min(0).max(1_000_000),
  pct_primiparous: z.number().min(0).max(100),
  calving_interval_days: z.number().int().min(250).max(700),
  replacement_rate_pct: z.number().min(0).max(100),
  target_rolling_herd_avg_kg_yr: z.number().int().min(0).max(50_000).nullable(),
  notes: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

function numField(label: string, suffix?: string) {
  return (
    <></>
  );
}
void numField; // suppress unused

export function HerdProfileForm({
  locationId,
  initial,
  mode,
  nextStep,
}: {
  locationId: string;
  initial: HerdProfile;
  mode: "standalone" | "wizard";
  nextStep?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      target_lactating_count: initial.target_lactating_count,
      target_dry_count: initial.target_dry_count,
      target_heifer_count: initial.target_heifer_count,
      target_calf_count: initial.target_calf_count,
      pct_primiparous: initial.pct_primiparous,
      calving_interval_days: initial.calving_interval_days,
      replacement_rate_pct: initial.replacement_rate_pct,
      target_rolling_herd_avg_kg_yr: initial.target_rolling_herd_avg_kg_yr,
      notes: initial.notes ?? "",
    },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      if (mode === "wizard" && nextStep) {
        try {
          await upsertHerdProfileAndAdvance({
            location_id: locationId,
            ...values,
            nextStep,
          });
        } catch (err) {
          if (err instanceof Error && err.message.includes("NEXT_REDIRECT"))
            return;
          toast.error(err instanceof Error ? err.message : "Save failed.");
        }
        return;
      }
      const result = await upsertHerdProfile({ location_id: locationId, ...values });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Herd profile saved.");
      router.refresh();
    });
  };

  const numberCell = (name: keyof FormValues, label: string, suffix?: string, hint?: string) => (
    <FormField
      control={form.control}
      name={name as keyof FormValues}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">{label}</FormLabel>
          <FormControl>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="1"
                inputMode="numeric"
                {...field}
                value={field.value === null ? "" : (field.value as number | string)}
                onChange={(e) =>
                  field.onChange(e.target.value === "" ? null : Number(e.target.value))
                }
              />
              {suffix ? (
                <span className="text-xs text-muted-foreground shrink-0">{suffix}</span>
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
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <div>
          <h3 className="text-sm font-medium mb-2">Counts</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {numberCell("target_lactating_count", "Lactating cows", "head")}
            {numberCell("target_dry_count", "Dry cows", "head")}
            {numberCell("target_heifer_count", "Heifers", "head")}
            {numberCell("target_calf_count", "Calves", "head")}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium mb-2">Herd dynamics</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {numberCell(
              "pct_primiparous",
              "Primiparous %",
              "%",
              "Fraction of lactating that are first-lactation.",
            )}
            {numberCell(
              "calving_interval_days",
              "Calving interval",
              "days",
              "Avg days between consecutive calvings.",
            )}
            {numberCell(
              "replacement_rate_pct",
              "Replacement rate",
              "%/yr",
              "Annual cull + replacement turnover.",
            )}
            {numberCell(
              "target_rolling_herd_avg_kg_yr",
              "Target RHA",
              "kg/yr",
              "Optional: rolling herd average milk per cow.",
            )}
          </div>
        </div>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="submit" disabled={isPending}>
            {mode === "wizard" ? (
              <>
                {isPending ? "Saving..." : "Save & continue"}
                <HugeiconsIcon icon={ArrowRight01Icon} />
              </>
            ) : isPending ? (
              "Saving..."
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
