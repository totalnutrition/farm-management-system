"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  PencilEdit02Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CommonCurrencies } from "@/lib/settings-resolver";
import {
  createPricingScheme,
  deletePricingScheme,
  updatePricingScheme,
  type PricingScheme,
} from "./milk-pricing-actions";

const correctionOptions = [
  { value: "raw", label: "Raw" },
  { value: "fcm_3.5", label: "FCM 3.5%" },
  { value: "fcm_4", label: "FCM 4.0%" },
  { value: "ecm_nrc", label: "ECM (NRC)" },
  { value: "ecm_tr", label: "ECM (Tyrrell-Reid)" },
  { value: "ms", label: "Milksolids" },
  { value: "ts", label: "Total Solids" },
  { value: "fat_corrected", label: "Fat-corrected" },
  { value: "snf_corrected", label: "SNF-corrected" },
  { value: "custom", label: "Custom" },
] as const;

const baseUnits = ["kg", "L", "lb", "cwt", "MS-kg"] as const;

const formSchema = z.object({
  name: z.string().trim().min(1, "Name required."),
  currency: z.string().trim().min(3).max(8),
  base_unit: z.enum(baseUnits),
  correction: z.enum(correctionOptions.map((c) => c.value) as [string, ...string[]]),
  base_price_per_unit: z.union([z.number(), z.literal("")]),
  effective_from: z.string().min(10, "Required"),
  effective_to: z.string(),
  notes: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

const empty: FormValues = {
  name: "",
  currency: "USD",
  base_unit: "kg",
  correction: "raw",
  base_price_per_unit: "" as unknown as number,
  effective_from: new Date().toISOString().slice(0, 10),
  effective_to: "",
  notes: "",
};

type TemplateLite = {
  slug: string;
  name: string;
  currency: string;
  base_unit: string;
  correction_method: string;
};

function toSubmit(
  locationId: string,
  values: FormValues,
  templateId: string | null,
) {
  return {
    location_id: locationId,
    template_id: templateId,
    name: values.name,
    currency: values.currency,
    base_unit: values.base_unit,
    correction: values.correction as
      | "raw"
      | "fcm_3.5"
      | "fcm_4"
      | "ecm_nrc"
      | "ecm_tr"
      | "ms"
      | "ts"
      | "fat_corrected"
      | "snf_corrected"
      | "custom",
    base_price_per_unit:
      typeof values.base_price_per_unit === "number"
        ? values.base_price_per_unit
        : null,
    effective_from: values.effective_from,
    effective_to: values.effective_to || null,
    notes: values.notes || null,
  };
}

export function MilkPricingTable({
  locationId,
  rows,
  templates,
}: {
  locationId: string;
  rows: PricingScheme[];
  templates: Array<TemplateLite & { id: string }>;
}) {
  const [editing, setEditing] = useState<PricingScheme | null>(null);
  const [deleting, setDeleting] = useState<PricingScheme | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <CreateDialog locationId={locationId} templates={templates} />
      </div>
      <div className="ring-1 ring-foreground/10 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Correction</TableHead>
              <TableHead className="text-right">Base price</TableHead>
              <TableHead>Effective from</TableHead>
              <TableHead>Effective to</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No pricing schemes yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const active =
                  !r.effective_to ||
                  new Date(r.effective_to) >= new Date();
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.name}
                      {active ? (
                        <span className="ml-2 text-[10px] text-primary">active</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.currency}</TableCell>
                    <TableCell>{r.base_unit}</TableCell>
                    <TableCell>
                      {correctionOptions.find((c) => c.value === r.correction)
                        ?.label ?? r.correction}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {r.base_price_per_unit ?? "—"}
                    </TableCell>
                    <TableCell>{r.effective_from}</TableCell>
                    <TableCell>{r.effective_to ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing(r)}
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleting(r)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <EditDialog row={editing} locationId={locationId} onClose={() => setEditing(null)} />
      <DeleteDialog row={deleting} locationId={locationId} onClose={() => setDeleting(null)} />
    </div>
  );
}

function FormBody({
  form,
  templates,
  onTemplate,
}: {
  form: ReturnType<typeof useForm<FormValues>>;
  templates: Array<TemplateLite & { id: string }>;
  onTemplate: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {templates.length > 0 ? (
        <div className="flex flex-col gap-1">
          <label className="text-xs">Start from template (optional)</label>
          <Select
            defaultValue="__none"
            onValueChange={(v) => {
              if (v === "__none") {
                onTemplate(null);
                return;
              }
              const t = templates.find((tt) => tt.id === v);
              if (!t) return;
              onTemplate(t.id);
              form.setValue("name", t.name);
              form.setValue("currency", t.currency);
              form.setValue("base_unit", t.base_unit as FormValues["base_unit"]);
              form.setValue(
                "correction",
                t.correction_method as FormValues["correction"],
              );
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">
                <span className="italic text-muted-foreground">Empty / custom</span>
              </SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="currency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Currency</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {CommonCurrencies.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
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
          name="base_unit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Base unit</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {baseUnits.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
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
          name="correction"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correction</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {correctionOptions.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
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
          name="base_price_per_unit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Base price / unit</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.0001"
                  inputMode="decimal"
                  value={field.value === "" || field.value === undefined ? "" : (field.value as number)}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="effective_from"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Effective from</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="effective_to"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Effective to (blank = active)</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
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
                <Textarea rows={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

function CreateDialog({
  locationId,
  templates,
}: {
  locationId: string;
  templates: Array<TemplateLite & { id: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: empty,
  });
  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await createPricingScheme(toSubmit(locationId, values, templateId));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pricing scheme created.");
      form.reset(empty);
      setTemplateId(null);
      setOpen(false);
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <HugeiconsIcon icon={PlusSignIcon} />
          New scheme
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create pricing scheme</DialogTitle>
          <DialogDescription>
            Adding a new scheme automatically closes the previous open one's
            effective_to.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormBody form={form} templates={templates} onTemplate={setTemplateId} />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  row,
  locationId,
  onClose,
}: {
  row: PricingScheme | null;
  locationId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: row
      ? ({
          name: row.name,
          currency: row.currency,
          base_unit: row.base_unit as FormValues["base_unit"],
          correction: row.correction as FormValues["correction"],
          base_price_per_unit: row.base_price_per_unit ?? ("" as unknown as number),
          effective_from: row.effective_from,
          effective_to: row.effective_to ?? "",
          notes: row.notes ?? "",
        } as FormValues)
      : empty,
  });
  if (!row) return null;
  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await updatePricingScheme({
        id: row.id,
        ...toSubmit(locationId, values, row.template_id),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pricing scheme updated.");
      onClose();
    });
  };
  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit pricing scheme</DialogTitle>
          <DialogDescription>{row.name}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormBody form={form} templates={[]} onTemplate={() => undefined} />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  row,
  locationId,
  onClose,
}: {
  row: PricingScheme | null;
  locationId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  if (!row) return null;
  const onConfirm = () => {
    startTransition(async () => {
      const result = await deletePricingScheme({ id: row.id, location_id: locationId });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Scheme deleted.");
      onClose();
    });
  };
  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete scheme</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{row.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={isPending} onClick={onConfirm}>
            <HugeiconsIcon icon={Delete02Icon} />
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
