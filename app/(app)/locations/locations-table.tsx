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
import { cn } from "@/lib/utils";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LocationKindEnabled,
  LocationKindOrder,
  LocationKindView,
  type LocationKind,
} from "@/lib/types";
import { createLocation, deleteLocation, updateLocation } from "./actions";

export type LocationRow = {
  id: string;
  name: string;
  kind: LocationKind;
  address: string | null;
  is_active: boolean;
};

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  kind: z.enum([
    "dairy",
    "beef",
    "poultry",
    "small_ruminants",
    "mixed",
    "other",
  ]),
  address: z.string().trim(),
});
type FormValues = z.infer<typeof formSchema>;

export function LocationsTable({
  rows,
  canManage,
}: {
  rows: LocationRow[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<LocationRow | null>(null);
  const [deleting, setDeleting] = useState<LocationRow | null>(null);

  const colCount = canManage ? 4 : 3;

  return (
    <div className="flex flex-col gap-3">
      {canManage ? (
        <div className="flex justify-end">
          <CreateDialog />
        </div>
      ) : null}
      <div className="ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Address</TableHead>
              {canManage ? (
                <TableHead className="text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="text-center text-muted-foreground"
                >
                  No locations yet. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {LocationKindView[r.kind]}
                  </TableCell>
                  <TableCell className="max-w-md whitespace-pre-line text-xs text-muted-foreground">
                    {r.address ?? "—"}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing(r)}
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleting(r)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EditDialog row={editing} onClose={() => setEditing(null)} />
      <DeleteDialog row={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function KindPicker({
  value,
  onChange,
}: {
  value: LocationKind;
  onChange: (k: LocationKind) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {LocationKindOrder.map((k) => {
        const enabled = LocationKindEnabled[k];
        const selected = value === k;
        return (
          <button
            key={k}
            type="button"
            disabled={!enabled}
            onClick={() => enabled && onChange(k)}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded border p-2 text-left transition",
              selected
                ? "border-foreground bg-foreground/5"
                : "border-foreground/10",
              enabled
                ? "cursor-pointer hover:border-foreground/40"
                : "cursor-not-allowed opacity-50 blur-[0.6px]",
            )}
          >
            <span className="text-xs font-medium">{LocationKindView[k]}</span>
            <span className="text-[10px] text-muted-foreground">
              {enabled ? "Available" : "Coming soon"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CreateDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", kind: "dairy", address: "" },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await createLocation(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Location created.");
      form.reset();
      setOpen(false);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">
          <HugeiconsIcon icon={PlusSignIcon} />
          New Location
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Location</DialogTitle>
          <DialogDescription>
            A location is a farm site. Pick the kind that best describes it —
            other kinds will be unlocked as their modules ship.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
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
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kind</FormLabel>
                  <FormControl>
                    <KindPicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
  onClose,
}: {
  row: LocationRow | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: row
      ? { name: row.name, kind: row.kind, address: row.address ?? "" }
      : { name: "", kind: "dairy", address: "" },
  });

  if (!row) return null;

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await updateLocation({ id: row.id, ...values });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Location updated.");
      onClose();
    });
  };

  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Location</DialogTitle>
          <DialogDescription>{row.name}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kind</FormLabel>
                  <FormControl>
                    <KindPicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
  onClose,
}: {
  row: LocationRow | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  if (!row) return null;

  const onConfirm = () => {
    startTransition(async () => {
      const result = await deleteLocation(row.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Location deleted.");
      onClose();
    });
  };

  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Location</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{row.name}</strong> and every
            resource inside it. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={onConfirm}
          >
            <HugeiconsIcon icon={Delete02Icon} />
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
