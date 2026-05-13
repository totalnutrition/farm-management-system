"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import {
  createDirectoryEntry,
  deleteDirectoryEntry,
  updateDirectoryEntry,
  type DirectoryEntry,
} from "./directory-actions";

const roleOptions = [
  { value: "technician", label: "Technician" },
  { value: "veterinarian", label: "Veterinarian" },
  { value: "hoof_trimmer", label: "Hoof trimmer" },
  { value: "nutritionist", label: "Nutritionist" },
  { value: "inseminator", label: "Inseminator" },
  { value: "consultant", label: "Consultant" },
  { value: "other", label: "Other" },
] as const;

const roleLabel: Record<string, string> = Object.fromEntries(
  roleOptions.map((r) => [r.value, r.label]),
);

const formSchema = z.object({
  role: z.enum(roleOptions.map((r) => r.value) as [string, ...string[]]),
  full_name: z.string().trim().min(1, "Name required."),
  organization_name: z.string(),
  email: z.string(),
  phone: z.string(),
  external_id: z.string(),
  notes: z.string(),
  is_active: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

const empty: FormValues = {
  role: "technician",
  full_name: "",
  organization_name: "",
  email: "",
  phone: "",
  external_id: "",
  notes: "",
  is_active: true,
};

function toSubmit(locationId: string, values: FormValues) {
  return {
    location_id: locationId,
    role: values.role as
      | "technician"
      | "veterinarian"
      | "hoof_trimmer"
      | "nutritionist"
      | "inseminator"
      | "consultant"
      | "other",
    full_name: values.full_name,
    organization_name: values.organization_name || null,
    email: values.email || null,
    phone: values.phone || null,
    external_id: values.external_id || null,
    notes: values.notes || null,
    is_active: values.is_active,
  };
}

export function DirectoryClient({
  locationId,
  rows,
}: {
  locationId: string;
  rows: DirectoryEntry[];
}) {
  const [editing, setEditing] = useState<DirectoryEntry | null>(null);
  const [deleting, setDeleting] = useState<DirectoryEntry | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <CreateDialog locationId={locationId} />
      </div>
      <div className="ring-1 ring-foreground/10 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No entries yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className={!r.is_active ? "opacity-50" : ""}>
                  <TableCell className="text-xs">{roleLabel[r.role] ?? r.role}</TableCell>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.organization_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">{r.email ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.phone ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {r.is_active ? "Active" : "Inactive"}
                  </TableCell>
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

function FormBody({ form }: { form: ReturnType<typeof useForm<FormValues>> }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FormField
        control={form.control}
        name="role"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <FormControl>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((o) => (
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
        name="full_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Full name</FormLabel>
            <FormControl>
              <Input autoComplete="off" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="organization_name"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Organization / Clinic</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input type="email" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phone</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="external_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>External ID (license, NAAB tech #)</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="is_active"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between gap-3 ring-1 ring-foreground/10 p-3">
            <FormLabel className="font-normal text-xs">Active</FormLabel>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
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
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: empty,
  });
  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await createDirectoryEntry(toSubmit(locationId, values));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Entry added.");
      form.reset(empty);
      setOpen(false);
      router.refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <HugeiconsIcon icon={PlusSignIcon} />
          New entry
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New directory entry</DialogTitle>
          <DialogDescription>
            A person referenced by events at this location.
          </DialogDescription>
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
  row: DirectoryEntry | null;
  locationId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: row
      ? ({
          role: row.role as FormValues["role"],
          full_name: row.full_name,
          organization_name: row.organization_name ?? "",
          email: row.email ?? "",
          phone: row.phone ?? "",
          external_id: row.external_id ?? "",
          notes: row.notes ?? "",
          is_active: row.is_active,
        } as FormValues)
      : empty,
  });
  if (!row) return null;
  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await updateDirectoryEntry({
        id: row.id,
        ...toSubmit(locationId, values),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Entry updated.");
      onClose();
      router.refresh();
    });
  };
  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit entry</DialogTitle>
          <DialogDescription>{row.full_name}</DialogDescription>
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
  row: DirectoryEntry | null;
  locationId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  if (!row) return null;
  const onConfirm = () => {
    startTransition(async () => {
      const result = await deleteDirectoryEntry({
        id: row.id,
        location_id: locationId,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Entry deleted.");
      onClose();
      router.refresh();
    });
  };
  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete entry</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{row.full_name}</strong>.
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
