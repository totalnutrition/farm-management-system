"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, PencilEdit02Icon, Delete02Icon } from "@hugeicons/core-free-icons";
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
import {
  createArableParcel,
  deleteArableParcel,
  updateArableParcel,
  type ArableParcel,
} from "./arable-parcels-actions";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name required."),
  parcel_code: z.string(),
  area_hectares: z.union([z.number(), z.literal("")]),
  status: z.enum(["active", "fallow", "archived"]),
  notes: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

const empty: FormValues = {
  name: "",
  parcel_code: "",
  area_hectares: "" as unknown as number,
  status: "active",
  notes: "",
};

function toSubmit(locationId: string, values: FormValues) {
  return {
    location_id: locationId,
    name: values.name,
    parcel_code: values.parcel_code || null,
    area_hectares:
      typeof values.area_hectares === "number" ? values.area_hectares : null,
    status: values.status,
    notes: values.notes || null,
  };
}

export function ArableParcelsTable({
  locationId,
  rows,
  plannedTotalHectares,
}: {
  locationId: string;
  rows: ArableParcel[];
  plannedTotalHectares: number | null;
}) {
  const [editing, setEditing] = useState<ArableParcel | null>(null);
  const [deleting, setDeleting] = useState<ArableParcel | null>(null);

  const totalHa = rows.reduce(
    (s, r) => s + (r.area_hectares ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-3">
      {plannedTotalHectares !== null ? (
        <div className="ring-1 ring-foreground/10 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span>
              Area {totalHa.toFixed(1)} / {plannedTotalHectares.toFixed(1)} ha
            </span>
            <span className="font-mono text-muted-foreground">
              {plannedTotalHectares > 0
                ? Math.round((totalHa / plannedTotalHectares) * 100)
                : 0}
              %
            </span>
          </div>
          <div className="h-1.5 bg-foreground/10 overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${plannedTotalHectares > 0 ? Math.min(100, (totalHa / plannedTotalHectares) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      ) : null}
      <div className="flex justify-end">
        <CreateDialog locationId={locationId} />
      </div>
      <div className="ring-1 ring-foreground/10 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">Area (ha)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No parcels yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.parcel_code ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.area_hectares ?? "—"}
                  </TableCell>
                  <TableCell className="capitalize">{r.status}</TableCell>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EditDialog row={editing} locationId={locationId} onClose={() => setEditing(null)} />
      <DeleteDialog row={deleting} locationId={locationId} onClose={() => setDeleting(null)} />
    </div>
  );
}

function FormBody({ form }: { form: ReturnType<typeof useForm<FormValues>> }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
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
        name="parcel_code"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Code (optional)</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="area_hectares"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Area (ha)</FormLabel>
            <FormControl>
              <Input
                type="number"
                step="0.01"
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
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <FormControl>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="fallow">Fallow</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
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
  );
}

function CreateDialog({ locationId }: { locationId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: empty,
  });
  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await createArableParcel(toSubmit(locationId, values));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Parcel created.");
      form.reset(empty);
      setOpen(false);
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <HugeiconsIcon icon={PlusSignIcon} />
          New Parcel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Parcel</DialogTitle>
          <DialogDescription>Arable land sub-area.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormBody form={form} />
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
  row: ArableParcel | null;
  locationId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: row
      ? ({
          name: row.name,
          parcel_code: row.parcel_code ?? "",
          area_hectares: row.area_hectares ?? ("" as unknown as number),
          status: row.status,
          notes: row.notes ?? "",
        } as FormValues)
      : empty,
  });
  if (!row) return null;
  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await updateArableParcel({ id: row.id, ...toSubmit(locationId, values) });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Parcel updated.");
      onClose();
    });
  };
  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Parcel</DialogTitle>
          <DialogDescription>{row.name}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormBody form={form} />
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
  row: ArableParcel | null;
  locationId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  if (!row) return null;
  const onConfirm = () => {
    startTransition(async () => {
      const result = await deleteArableParcel({ id: row.id, location_id: locationId });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Parcel deleted.");
      onClose();
    });
  };
  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Parcel</DialogTitle>
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
