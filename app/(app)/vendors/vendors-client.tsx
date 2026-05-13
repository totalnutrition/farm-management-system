"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  Delete02Icon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

import { upsertVendor, deleteVendor } from "./actions";

export type VendorRow = {
  id: string;
  name: string;
  category: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  payment_terms: string | null;
  notes: string | null;
};

const CATEGORIES = ["feed", "vet", "semen", "equipment", "forage", "service", "other"] as const;

const formSchema = z.object({
  name: z.string().min(1, "Required."),
  category: z.enum(CATEGORIES),
  contact_email: z.string().optional(),
  contact_phone: z.string().optional(),
  address: z.string().optional(),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function VendorsClient({
  locationId,
  rows,
}: {
  locationId: string;
  rows: VendorRow[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VendorRow | null>(null);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {rows.length} vendor{rows.length === 1 ? "" : "s"} on file.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(null); setOpen(true); }}>
          <HugeiconsIcon icon={PlusSignIcon} />
          Add vendor
        </Button>
      </div>

      <VendorsTable rows={rows} onEdit={(r) => { setEditing(r); setOpen(true); }} />

      <VendorDialog
        open={open}
        onOpenChange={setOpen}
        locationId={locationId}
        initial={editing}
      />
    </>
  );
}

function VendorsTable({
  rows,
  onEdit,
}: {
  rows: VendorRow[];
  onEdit: (r: VendorRow) => void;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const onDelete = (id: string, name: string) => {
    if (!confirm(`Delete vendor "${name}"?`)) return;
    setBusyId(id);
    startTransition(async () => {
      const r = await deleteVendor(id);
      setBusyId(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Vendor deleted.");
      router.refresh();
    });
  };

  return (
    <div className="ring-1 ring-foreground/10 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-foreground/5">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Phone</th>
            <th className="px-3 py-2 font-medium">Terms</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                No vendors yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-t border-foreground/10">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.category ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.contact_email ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.contact_phone ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.payment_terms ?? "—"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(r)}>
                    <HugeiconsIcon icon={PencilEdit02Icon} />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(r.id, r.name)}
                    disabled={busyId === r.id}
                  >
                    <HugeiconsIcon icon={Delete02Icon} />
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function VendorDialog({
  open,
  onOpenChange,
  locationId,
  initial,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  locationId: string;
  initial: VendorRow | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      name: initial?.name ?? "",
      category: (initial?.category as FormValues["category"]) ?? "feed",
      contact_email: initial?.contact_email ?? "",
      contact_phone: initial?.contact_phone ?? "",
      address: initial?.address ?? "",
      payment_terms: initial?.payment_terms ?? "",
      notes: initial?.notes ?? "",
    },
  });

  const onSubmit = (v: FormValues) =>
    startTransition(async () => {
      const r = await upsertVendor({
        id: initial?.id,
        location_id: locationId,
        name: v.name,
        category: v.category,
        contact_email: v.contact_email || null,
        contact_phone: v.contact_phone || null,
        address: v.address || null,
        payment_terms: v.payment_terms || null,
        notes: v.notes || null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(initial ? "Vendor updated." : "Vendor added.");
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit vendor" : "Add vendor"}</DialogTitle>
          <DialogDescription>
            Vendors supply feed, vet medicine, semen, equipment or services.
            Each procurement receipt references one vendor.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
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
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment terms</FormLabel>
                    <FormControl>
                      <Input placeholder="Net 30" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
