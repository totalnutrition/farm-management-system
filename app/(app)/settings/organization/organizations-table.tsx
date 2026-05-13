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
  FormDescription,
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
import { CommonTimezones } from "@/lib/timezones";
import {
  createOrganization,
  deleteOrganization,
  updateOrganization,
} from "./actions";

export type OrganizationRow = {
  id: string;
  name: string;
  address: string | null;
  default_currency: string;
  default_units: "metric" | "imperial";
  default_timezone: string;
};

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  address: z.string().trim(),
  default_currency: z
    .string()
    .trim()
    .min(3, "Use a 3-letter ISO code.")
    .max(8, "Too long."),
  default_units: z.enum(["metric", "imperial"]),
  default_timezone: z.string().trim().min(1, "Timezone is required."),
});
type FormValues = z.infer<typeof formSchema>;

const emptyValues: FormValues = {
  name: "",
  address: "",
  default_currency: "USD",
  default_units: "metric",
  default_timezone: "UTC",
};

export function OrganizationsTable({
  rows,
  canManage,
  canEdit,
}: {
  rows: OrganizationRow[];
  canManage: boolean;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<OrganizationRow | null>(null);
  const [deleting, setDeleting] = useState<OrganizationRow | null>(null);

  const showActions = canEdit || canManage;
  const colCount = showActions ? 4 : 3;

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
              <TableHead>Address</TableHead>
              <TableHead>Defaults</TableHead>
              {showActions ? (
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
                  No organizations to show.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="max-w-md whitespace-pre-line">
                    {r.address ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="font-mono">{r.default_currency}</span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="capitalize">{r.default_units}</span>
                    <span className="text-muted-foreground"> · </span>
                    <span>{r.default_timezone}</span>
                  </TableCell>
                  {showActions ? (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canEdit ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(r)}
                          >
                            <HugeiconsIcon icon={PencilEdit02Icon} />
                            Edit
                          </Button>
                        ) : null}
                        {canManage ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleting(r)}
                          >
                            <HugeiconsIcon icon={Delete02Icon} />
                            Delete
                          </Button>
                        ) : null}
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

function OrganizationFormBody({
  form,
}: {
  form: ReturnType<typeof useForm<FormValues>>;
}) {
  return (
    <div className="flex flex-col gap-3">
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

      <div className="flex flex-col gap-2 border-t pt-3">
        <h3 className="text-xs font-medium">Defaults</h3>
        <p className="text-[10px] text-muted-foreground">
          Locations inherit these unless they set their own value.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="default_currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Currency</FormLabel>
                <FormControl>
                  <Select
                    value={field.value || "USD"}
                    onValueChange={field.onChange}
                  >
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
            name="default_units"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Units</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="metric">Metric (kg, L, ha)</SelectItem>
                      <SelectItem value="imperial">
                        Imperial (lb, gal, ac)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription className="text-[10px]">
                  Display preference. Storage is always metric.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="default_timezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Timezone</FormLabel>
                <FormControl>
                  <Select
                    value={field.value || "UTC"}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {CommonTimezones.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
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
      </div>
    </div>
  );
}

function CreateDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyValues,
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await createOrganization(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Organization created.");
      form.reset(emptyValues);
      setOpen(false);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset(emptyValues);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">
          <HugeiconsIcon icon={PlusSignIcon} />
          New Organization
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>
            Add a new client organization.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <OrganizationFormBody form={form} />
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
  row: OrganizationRow | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: row
      ? {
          name: row.name,
          address: row.address ?? "",
          default_currency: row.default_currency,
          default_units: row.default_units,
          default_timezone: row.default_timezone,
        }
      : emptyValues,
  });

  if (!row) return null;

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await updateOrganization({ id: row.id, ...values });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Organization updated.");
      onClose();
    });
  };

  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
          <DialogDescription>{row.name}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <OrganizationFormBody form={form} />
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
  row: OrganizationRow | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  if (!row) return null;

  const onConfirm = () => {
    startTransition(async () => {
      const result = await deleteOrganization(row.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Organization deleted.");
      onClose();
    });
  };

  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Organization</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{row.name}</strong>. This
            cannot be undone.
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
