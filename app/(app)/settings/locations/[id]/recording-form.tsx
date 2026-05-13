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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  BulkTankFrequencies,
  ComponentSamplingMethods,
  MilkingsPerDay,
  RecordingMethods,
  TestDayFrequencies,
  type RecordingProfile,
} from "@/lib/recording-profile";
import {
  upsertRecordingProfile,
  upsertRecordingProfileAndAdvance,
} from "./recording-actions";

const formSchema = z.object({
  test_day_frequency: z.enum(
    TestDayFrequencies.map((t) => t.value) as [string, ...string[]],
  ),
  daily_recording_enabled: z.boolean(),
  milkings_per_day: z.enum(MilkingsPerDay.map((m) => m.value) as [string, ...string[]]),
  recording_method: z.enum(RecordingMethods.map((m) => m.value) as [string, ...string[]]),
  bulk_tank_recording: z.enum(BulkTankFrequencies.map((b) => b.value) as [string, ...string[]]),
  component_sampling: z.enum(ComponentSamplingMethods.map((c) => c.value) as [string, ...string[]]),
  notes: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export function RecordingProfileForm({
  locationId,
  initial,
  mode,
  nextStep,
}: {
  locationId: string;
  initial: RecordingProfile;
  mode: "standalone" | "wizard";
  nextStep?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      test_day_frequency: initial.test_day_frequency,
      daily_recording_enabled: initial.daily_recording_enabled,
      milkings_per_day: initial.milkings_per_day,
      recording_method: initial.recording_method,
      bulk_tank_recording: initial.bulk_tank_recording,
      component_sampling: initial.component_sampling,
      notes: initial.notes ?? "",
    },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      if (mode === "wizard" && nextStep) {
        try {
          await upsertRecordingProfileAndAdvance({
            location_id: locationId,
            ...values,
            test_day_frequency: values.test_day_frequency as RecordingProfile["test_day_frequency"],
            milkings_per_day: values.milkings_per_day as RecordingProfile["milkings_per_day"],
            recording_method: values.recording_method as RecordingProfile["recording_method"],
            bulk_tank_recording: values.bulk_tank_recording as RecordingProfile["bulk_tank_recording"],
            component_sampling: values.component_sampling as RecordingProfile["component_sampling"],
            nextStep,
          });
        } catch (err) {
          if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) {
            return;
          }
          toast.error(err instanceof Error ? err.message : "Save failed.");
        }
        return;
      }

      const result = await upsertRecordingProfile({
        location_id: locationId,
        ...values,
        test_day_frequency: values.test_day_frequency as RecordingProfile["test_day_frequency"],
        milkings_per_day: values.milkings_per_day as RecordingProfile["milkings_per_day"],
        recording_method: values.recording_method as RecordingProfile["recording_method"],
        bulk_tank_recording: values.bulk_tank_recording as RecordingProfile["bulk_tank_recording"],
        component_sampling: values.component_sampling as RecordingProfile["component_sampling"],
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Recording profile saved.");
      router.refresh();
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="test_day_frequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Test-day frequency</FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TestDayFrequencies.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription className="text-[10px]">
                  How often DHI / lab samples are taken per cow.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="milkings_per_day"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Milkings per day</FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MilkingsPerDay.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="recording_method"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Recording method</FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RecordingMethods.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription className="text-[10px]">
                  How daily yield gets captured. Drives the per-milking
                  data shape we expect.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bulk_tank_recording"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bulk tank recording</FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BulkTankFrequencies.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="component_sampling"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Component sampling</FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ComponentSamplingMethods.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription className="text-[10px]">
                  Where fat / protein / SCC numbers come from.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="daily_recording_enabled"
            render={({ field }) => (
              <FormItem className="sm:col-span-2 flex flex-row items-center justify-between gap-3 ring-1 ring-foreground/10 p-3">
                <div className="flex flex-col gap-0.5">
                  <FormLabel className="font-normal">
                    Daily individual recording
                  </FormLabel>
                  <FormDescription className="text-xs">
                    Each cow's yield is captured every milking. Required
                    for the Milkings entry UI and per-cow daily reporting.
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

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    placeholder="Optional — anything unusual about how this farm records milk."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
