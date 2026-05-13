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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PenTypeView, PenTypes, type Pen } from "@/lib/pens";
import { createPen, deletePen, updatePen } from "./pens-actions";

type BarnLite = { id: string; name: string };
type GroupLite = { id: string; label: string };

const formSchema = z.object({
  name: z.string().trim().min(1, "Name required"),
  pen_code: z.string(),
  type: z.enum(PenTypes.map((p) => p.value) as [string, ...string[]]),
  barn_id: z.string(),
  group_id: z.string(),
  capacity_head: z.union([z.number(), z.literal("")]),
  is_AI_pen: z.boolean(),
  is_BULL_pen: z.boolean(),
  is_DRY_pen: z.boolean(),
  is_HOSP_pen: z.boolean(),
  is_FRESH_pen: z.boolean(),
  notes: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

const empty: FormValues = {
  name: "",
  pen_code: "",
  type: "milking",
  barn_id: "",
  group_id: "",
  capacity_head: "" as unknown as number,
  is_AI_pen: false,
  is_BULL_pen: false,
  is_DRY_pen: false,
  is_HOSP_pen: false,
  is_FRESH_pen: false,
  notes: "",
};

function toSubmit(locationId: string, values: FormValues) {
  return {
    location_id: locationId,
    name: values.name,
    pen_code: values.pen_code || null,
    type: values.type,
    barn_id: values.barn_id || null,
    group_id: values.group_id || null,
    capacity_head: typeof values.capacity_head === "number" ? values.capacity_head : null,
    is_AI_pen: values.is_AI_pen,
    is_BULL_pen: values.is_BULL_pen,
    is_DRY_pen: values.is_DRY_pen,
    is_HOSP_pen: values.is_HOSP_pen,
    is_FRESH_pen: values.is_FRESH_pen,
    notes: values.notes || null,
  };
}

export function PensTable({
  locationId,
  rows,
  barns,
  groups,
}: {
  locationId: string;
  rows: Pen[];
  barns: BarnLite[];
  groups: GroupLite[];
}) {
  const [editing, setEditing] = useState<Pen | null>(null);
  const [deleting, setDeleting] = useState<Pen | null>(null);

  const barnLabel = (id: string | null) =>
    barns.find((b) => b.id === id)?.name ?? "—";
  const groupLabel = (id: string | null) =>
    groups.find((g) => g.id === id)?.label ?? "—";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <CreateDialog locationId={locationId} barns={barns} groups={groups} />
      </div>
      <div className="ring-1 ring-foreground/10 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Barn</TableHead>
              <TableHead>Group</TableHead>
              <TableHead className="text-right">Cap</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No pens yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="font-medium">{p.name}</span>
                    {p.is_placeholder ? (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        placeholder
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{PenTypeView[p.type] ?? p.type}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {barnLabel(p.barn_id)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {groupLabel(p.group_id)}
                  </TableCell>
                  <TableCell className="text-right">{p.capacity_head ?? "—"}</TableCell>
                  <TableCell className="text-[10px]">
                    {[
                      p.is_AI_pen ? "AI" : null,
                      p.is_BULL_pen ? "BULL" : null,
                      p.is_DRY_pen ? "DRY" : null,
                      p.is_HOSP_pen ? "HOSP" : null,
                      p.is_FRESH_pen ? "FRESH" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(p)}
                      >
                        <HugeiconsIcon icon={PencilEdit02Icon} />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleting(p)}
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

      <EditDialog
        row={editing}
        locationId={locationId}
        barns={barns}
        groups={groups}
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

function PenFormBody({
  form,
  barns,
  groups,
}: {
  form: ReturnType<typeof useForm<FormValues>>;
  barns: BarnLite[];
  groups: GroupLite[];
}) {
  return (
    <div className="flex flex-col gap-3">
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
          name="pen_code"
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
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pen type</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PenTypes.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
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
          name="capacity_head"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Capacity (head)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="numeric"
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
          name="barn_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Barn</FormLabel>
              <FormControl>
                <Select
                  value={field.value || "__none"}
                  onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">
                      <span className="italic text-muted-foreground">No barn</span>
                    </SelectItem>
                    {barns.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
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
          name="group_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default group</FormLabel>
              <FormControl>
                <Select
                  value={field.value || "__none"}
                  onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">
                      <span className="italic text-muted-foreground">Unassigned</span>
                    </SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className="border-t pt-3 flex flex-col gap-1.5">
        <p className="text-xs font-medium">DC305 side-effect flags</p>
        <p className="text-[10px] text-muted-foreground">
          Entering these pens auto-writes events on the animal. AI and BULL
          are mutually exclusive.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(["is_AI_pen", "is_BULL_pen", "is_DRY_pen", "is_HOSP_pen", "is_FRESH_pen"] as const).map(
            (k) => (
              <FormField
                key={k}
                control={form.control}
                name={k}
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between gap-2 ring-1 ring-foreground/10 p-2">
                    <FormLabel className="text-[10px] font-mono">
                      {k.replace(/^is_/, "").replace(/_pen$/, "")}
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            ),
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
    </div>
  );
}

function CreateDialog({
  locationId,
  barns,
  groups,
}: {
  locationId: string;
  barns: BarnLite[];
  groups: GroupLite[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: empty,
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await createPen(toSubmit(locationId, values));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pen created.");
      form.reset(empty);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <HugeiconsIcon icon={PlusSignIcon} />
          New Pen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Pen</DialogTitle>
          <DialogDescription>Physical pen inside a barn.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <PenFormBody form={form} barns={barns} groups={groups} />
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
  barns,
  groups,
  onClose,
}: {
  row: Pen | null;
  locationId: string;
  barns: BarnLite[];
  groups: GroupLite[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: row
      ? ({
          ...empty,
          name: row.name,
          pen_code: row.pen_code ?? "",
          type: row.type as FormValues["type"],
          barn_id: row.barn_id ?? "",
          group_id: row.group_id ?? "",
          capacity_head: row.capacity_head ?? ("" as unknown as number),
          is_AI_pen: row.is_AI_pen,
          is_BULL_pen: row.is_BULL_pen,
          is_DRY_pen: row.is_DRY_pen,
          is_HOSP_pen: row.is_HOSP_pen,
          is_FRESH_pen: row.is_FRESH_pen,
          notes: row.notes ?? "",
        } as FormValues)
      : empty,
  });
  if (!row) return null;

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await updatePen({ id: row.id, ...toSubmit(locationId, values) });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pen updated.");
      onClose();
    });
  };

  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Pen</DialogTitle>
          <DialogDescription>{row.name}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <PenFormBody form={form} barns={barns} groups={groups} />
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
  row: Pen | null;
  locationId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  if (!row) return null;
  const onConfirm = () => {
    startTransition(async () => {
      const result = await deletePen({ id: row.id, location_id: locationId });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pen deleted.");
      onClose();
    });
  };
  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Pen</DialogTitle>
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
