"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  CapacityGroupClasses,
  isStockingKey,
  type CapacityDefaults,
} from "@/lib/capacity-defaults";
import { updateCapacityDefaults } from "./actions";

const range = (min: number, max: number, label: string) =>
  z
    .number({ message: `${label} must be a number.` })
    .min(min, `${label} ≥ ${min}.`)
    .max(max, `${label} ≤ ${max}.`);

const formSchema = z.object({
  fresh_stocking_pct: range(50, 200, "Fresh stocking %"),
  high_stocking_pct: range(50, 200, "High stocking %"),
  mid_stocking_pct: range(50, 200, "Mid stocking %"),
  low_stocking_pct: range(50, 200, "Low stocking %"),
  dry_close_stocking_pct: range(50, 200, "Close-up stocking %"),
  dry_far_stocking_pct: range(50, 200, "Far-off stocking %"),
  fresh_bunk_in: range(12, 48, "Fresh bunk in"),
  high_bunk_in: range(12, 48, "High bunk in"),
  mid_bunk_in: range(12, 48, "Mid bunk in"),
  low_bunk_in: range(12, 48, "Low bunk in"),
  dry_close_bunk_in: range(12, 48, "Close-up bunk in"),
  dry_far_bunk_in: range(12, 48, "Far-off bunk in"),
});

type FormValues = z.infer<typeof formSchema>;

export function CapacityDefaultsForm({
  initial,
  canEdit,
}: {
  initial: CapacityDefaults;
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initial,
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await updateCapacityDefaults(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Capacity defaults saved.");
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-3"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CapacityGroupClasses.map((c) => (
            <FormField
              key={c.key}
              control={form.control}
              name={c.key as keyof FormValues}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">{c.label}</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.5"
                        inputMode="decimal"
                        disabled={!canEdit}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                          )
                        }
                      />
                      <span className="text-xs text-muted-foreground shrink-0">
                        {isStockingKey(c.key) ? "%" : "in"}
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
        {canEdit ? (
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Saving..." : "Save defaults"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Only organization admins can edit defaults.
          </p>
        )}
      </form>
    </Form>
  );
}
