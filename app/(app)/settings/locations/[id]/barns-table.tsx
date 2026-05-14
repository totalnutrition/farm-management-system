"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Form } from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarnTypeView,
  RowConfigView,
  type Barn,
} from "@/lib/barns";
import { createBarn, deleteBarn, updateBarn } from "./barns-actions";
import {
  BarnFormBody,
  barnFormSchema,
  barnFormValuesToSubmit,
  barnRowToFormValues,
  emptyBarnValues,
  type BarnFormValues,
} from "./barn-form";


export function BarnsTable({
  locationId,
  rows,
  planTotalStalls,
}: {
  locationId: string;
  rows: Barn[];
  planTotalStalls: number;
}) {
  const [editing, setEditing] = useState<Barn | null>(null);
  const [deleting, setDeleting] = useState<Barn | null>(null);

  const totalStalls = rows.reduce(
    (s, r) => s + (r.freestall_count ?? 0),
    0,
  );
  const gauge = planTotalStalls > 0 ? Math.round((totalStalls / planTotalStalls) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      {planTotalStalls > 0 ? (
        <div className="ring-1 ring-foreground/10 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span>
              Stalls {totalStalls} / {planTotalStalls} of plan
            </span>
            <span className="font-mono text-muted-foreground">{gauge}%</span>
          </div>
          <div className="h-1.5 bg-foreground/10 overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, gauge)}%` }}
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
              <TableHead>Type</TableHead>
              <TableHead>Rows</TableHead>
              <TableHead className="text-right">Freestalls</TableHead>
              <TableHead className="text-right">Headlocks</TableHead>
              <TableHead>Vent</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  No barns yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{BarnTypeView[b.type] ?? b.type}</TableCell>
                  <TableCell>
                    {b.row_configuration
                      ? RowConfigView[b.row_configuration]
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {b.freestall_count ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {b.headlock_count ?? "—"}
                  </TableCell>
                  <TableCell className="capitalize">
                    {b.ventilation_type ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(b)}
                      >
                        <HugeiconsIcon icon={PencilEdit02Icon} />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleting(b)}
                      >
                        <HugeiconsIcon icon={Delete02Icon} />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EditDialog
        row={editing}
        locationId={locationId}
        onClose={() => setEditing(null)}
      />
      <DeleteDialog
        row={deleting}
        locationId={locationId}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function CreateDialog({ locationId }: { locationId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<BarnFormValues>({
    resolver: zodResolver(barnFormSchema),
    defaultValues: emptyBarnValues,
  });

  const onSubmit = (values: BarnFormValues) => {
    startTransition(async () => {
      const result = await createBarn(barnFormValuesToSubmit(locationId, values));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Barn created.");
      form.reset(emptyBarnValues);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <HugeiconsIcon icon={PlusSignIcon} />
          New Barn
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Barn</DialogTitle>
          <DialogDescription>Physical structure that houses animals.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <BarnFormBody form={form} />
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
  row: Barn | null;
  locationId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<BarnFormValues>({
    resolver: zodResolver(barnFormSchema),
    values: row ? barnRowToFormValues(row) : emptyBarnValues,
  });
  if (!row) return null;

  const onSubmit = (values: BarnFormValues) => {
    startTransition(async () => {
      const result = await updateBarn({
        id: row.id,
        ...barnFormValuesToSubmit(locationId, values),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Barn updated.");
      onClose();
    });
  };

  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Barn</DialogTitle>
          <DialogDescription>{row.name}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <BarnFormBody form={form} />
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
  row: Barn | null;
  locationId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  if (!row) return null;
  const onConfirm = () => {
    startTransition(async () => {
      const result = await deleteBarn({ id: row.id, location_id: locationId });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Barn deleted.");
      onClose();
    });
  };
  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Barn</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{row.name}</strong>. Pens
            inside this barn will be deleted too.
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
