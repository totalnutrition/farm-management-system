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
import type { DairySettings } from "@/lib/dairy-settings";
import { upsertDairySettings } from "./dairy-settings-actions";

const formSchema = z.object({
  bulk_tank_reconciliation_threshold_pct: z.number().min(0).max(100),
  bulk_tank_pickup_cadence: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export function DairyBulkTankForm({
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
      bulk_tank_reconciliation_threshold_pct:
        initial.bulk_tank_reconciliation_threshold_pct,
      bulk_tank_pickup_cadence: initial.bulk_tank_pickup_cadence ?? "",
    },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await upsertDairySettings({
        location_id: locationId,
        ...initial,
        bulk_tank_reconciliation_threshold_pct:
          values.bulk_tank_reconciliation_threshold_pct,
        bulk_tank_pickup_cadence: values.bulk_tank_pickup_cadence || null,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Bulk-tank settings saved.");
      router.refresh();
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <header className="flex flex-col gap-0.5">
            <h2 className="text-sm font-medium">Bulk-tank reconciliation</h2>
            <p className="text-xs text-muted-foreground">
              How tank readings reconcile against per-cow milkings + diverted
              milk. The threshold drives alerts on the Bulk tank page.
            </p>
          </header>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="bulk_tank_reconciliation_threshold_pct"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Reconciliation alert threshold</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.5"
                        inputMode="decimal"
                        {...field}
                        value={field.value}
                        onChange={(e) =>
                          field.onChange(Number(e.target.value || 0))
                        }
                      />
                      <span className="text-xs text-muted-foreground shrink-0">%</span>
                    </div>
                  </FormControl>
                  <FormDescription className="text-[10px]">
                    Flag days where unexplained delta (sum-individual vs.
                    bulk-tank reading, net of diversions) exceeds this %.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bulk_tank_pickup_cadence"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Pickup cadence</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. every other day"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-[10px]">
                    Free-text. Drives expected pickup ticket cadence on
                    reports.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <div className="flex justify-end border-t pt-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save bulk-tank settings"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
