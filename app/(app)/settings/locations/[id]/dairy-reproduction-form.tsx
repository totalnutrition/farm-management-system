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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HeatDetectionMethods, type DairySettings } from "@/lib/dairy-settings";
import { upsertDairySettings } from "./dairy-settings-actions";

const numOrEmpty = z.union([z.number(), z.literal("")]);

const formSchema = z.object({
  voluntary_waiting_period_days: z.number().min(0).max(200),
  heat_detection_method: z.enum(
    HeatDetectionMethods.map((h) => h.value) as [string, ...string[]],
  ),
  preg_check_initial_days: z.number().min(14).max(90),
  preg_check_confirm_days: z.number().min(20).max(120),
  expected_gestation_days: z.number().min(250).max(310),
  do_not_breed_days_threshold: numOrEmpty,
  preg_rate_target_pct: numOrEmpty,
  conception_rate_target_pct: numOrEmpty,
  services_per_conception_target: numOrEmpty,
  dry_off_dcc_days: z.number().min(150).max(300),
  close_up_dcc_days: z.number().min(200).max(290),
  calving_alert_days_before: z.number().min(0).max(60),
});

type FormValues = z.infer<typeof formSchema>;

export function DairyReproductionForm({
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
      voluntary_waiting_period_days: initial.voluntary_waiting_period_days,
      heat_detection_method: initial.heat_detection_method,
      preg_check_initial_days: initial.preg_check_initial_days,
      preg_check_confirm_days: initial.preg_check_confirm_days,
      expected_gestation_days: initial.expected_gestation_days,
      do_not_breed_days_threshold:
        initial.do_not_breed_days_threshold ?? ("" as unknown as number),
      preg_rate_target_pct:
        initial.preg_rate_target_pct ?? ("" as unknown as number),
      conception_rate_target_pct:
        initial.conception_rate_target_pct ?? ("" as unknown as number),
      services_per_conception_target:
        initial.services_per_conception_target ?? ("" as unknown as number),
      dry_off_dcc_days: initial.dry_off_dcc_days,
      close_up_dcc_days: initial.close_up_dcc_days,
      calving_alert_days_before: initial.calving_alert_days_before,
    },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await upsertDairySettings({
        location_id: locationId,
        ...initial,
        ...values,
        heat_detection_method:
          values.heat_detection_method as DairySettings["heat_detection_method"],
        do_not_breed_days_threshold:
          typeof values.do_not_breed_days_threshold === "number"
            ? values.do_not_breed_days_threshold
            : null,
        preg_rate_target_pct:
          typeof values.preg_rate_target_pct === "number"
            ? values.preg_rate_target_pct
            : null,
        conception_rate_target_pct:
          typeof values.conception_rate_target_pct === "number"
            ? values.conception_rate_target_pct
            : null,
        services_per_conception_target:
          typeof values.services_per_conception_target === "number"
            ? values.services_per_conception_target
            : null,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Reproduction settings saved.");
      router.refresh();
    });
  };

  const NumberField = ({
    name,
    label,
    suffix,
    hint,
  }: {
    name: keyof FormValues;
    label: string;
    suffix?: string;
    hint?: string;
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
                step="0.01"
                value={field.value === "" || field.value === undefined
                  ? ""
                  : (field.value as number | string)}
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
            <h2 className="text-sm font-medium">Reproductive cycle</h2>
            <p className="text-xs text-muted-foreground">
              Default policies that drive when cows become eligible to breed
              and when pregnancy checks happen.
            </p>
          </header>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumberField
              name="voluntary_waiting_period_days"
              label="Voluntary waiting period"
              suffix="days"
              hint="Days post-calving before a cow is eligible to be bred."
            />
            <FormField
              control={form.control}
              name="heat_detection_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Heat detection</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HeatDetectionMethods.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <NumberField
              name="expected_gestation_days"
              label="Expected gestation"
              suffix="days"
              hint="Holstein default: 280."
            />
            <NumberField
              name="preg_check_initial_days"
              label="Initial preg check"
              suffix="d post-breeding"
            />
            <NumberField
              name="preg_check_confirm_days"
              label="Confirmation preg check"
              suffix="d post-breeding"
            />
            <NumberField
              name="do_not_breed_days_threshold"
              label="Auto-DNB DIM threshold"
              suffix="DIM"
              hint="Suggest Do-Not-Breed past this DIM. Leave blank to disable."
            />
          </div>
        </section>

        <section className="flex flex-col gap-3 border-t pt-4">
          <header className="flex flex-col gap-0.5">
            <h2 className="text-sm font-medium">Dry-off &amp; transition</h2>
            <p className="text-xs text-muted-foreground">
              Days-carried-calf triggers for dry-off, close-up move, and the
              calving alert window. Drives automatic group suggestions and
              fresh-cow protocols.
            </p>
          </header>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumberField
              name="dry_off_dcc_days"
              label="Dry-off trigger"
              suffix="days carried calf"
              hint="Suggest dry-off when DCC reaches this value (default 220)."
            />
            <NumberField
              name="close_up_dcc_days"
              label="Close-up move"
              suffix="days carried calf"
              hint="Move to close-up pen at this DCC (default 250)."
            />
            <NumberField
              name="calving_alert_days_before"
              label="Calving alert window"
              suffix="days before due"
              hint="Flag cows due to calve within this many days."
            />
          </div>
        </section>

        <section className="flex flex-col gap-3 border-t pt-4">
          <header className="flex flex-col gap-0.5">
            <h2 className="text-sm font-medium">Reproductive KPI targets</h2>
            <p className="text-xs text-muted-foreground">
              Targets used by reports and dashboards. Leave blank to skip.
            </p>
          </header>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumberField
              name="preg_rate_target_pct"
              label="Pregnancy rate target"
              suffix="%"
              hint="21-d pregnancy rate target (industry good: 22–28%)."
            />
            <NumberField
              name="conception_rate_target_pct"
              label="Conception rate target"
              suffix="%"
              hint="Industry good: 35–45%."
            />
            <NumberField
              name="services_per_conception_target"
              label="Services per conception"
              hint="Industry good: ≤ 2.5."
            />
          </div>
        </section>

        <div className="flex justify-end border-t pt-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save reproduction settings"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
