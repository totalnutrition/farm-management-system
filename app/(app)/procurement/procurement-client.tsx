"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, Delete02Icon } from "@hugeicons/core-free-icons";

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

import { createReceipt, deleteReceipt } from "./actions";

export type ReceiptRow = {
  id: string;
  occurred_at: string;
  vendor_name: string | null;
  item_name: string | null;
  unit: string | null;
  qty: number;
  unit_cost: number | null;
  note: string | null;
};
export type VendorOption = { id: string; name: string; category: string | null };
export type ExistingStockOption = {
  id: string;
  display_name: string;
  unit: string;
  kind: string;
};
export type FeedOption = { id: string; name: string };
export type VetOption = { id: string; name: string };

const NONE = "__none__";
const NEW_FEED = "new_feed_material";
const NEW_VET = "new_vet_medicine";
const NEW_CONSUMABLE = "new_consumable";
const NEW_EQUIPMENT = "new_equipment";

const formSchema = z.object({
  vendor_id: z.string(),
  target_kind: z.string(),
  existing_stock_id: z.string(),
  catalog_feed_id: z.string(),
  catalog_vet_id: z.string(),
  display_name: z.string(),
  unit: z.string().min(1, "Required."),
  qty: z.number().positive("Must be > 0."),
  unit_cost: z.number().nullable().optional(),
  occurred_at: z.string().min(1),
  note: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

function nowLocalIso(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function ProcurementClient({
  locationId,
  rows,
  vendors,
  existingStock,
  feeds,
  vetMeds,
}: {
  locationId: string;
  rows: ReceiptRow[];
  vendors: VendorOption[];
  existingStock: ExistingStockOption[];
  feeds: FeedOption[];
  vetMeds: VetOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {rows.length} receipt{rows.length === 1 ? "" : "s"} on file. Each
          receipt increases on-hand for one stock line and (optionally) sets
          its current unit cost.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          <HugeiconsIcon icon={PlusSignIcon} />
          Record receipt
        </Button>
      </div>

      <ReceiptsTable rows={rows} />

      <ReceiptDialog
        open={open}
        onOpenChange={setOpen}
        locationId={locationId}
        vendors={vendors}
        existingStock={existingStock}
        feeds={feeds}
        vetMeds={vetMeds}
      />
    </>
  );
}

function ReceiptsTable({ rows }: { rows: ReceiptRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const onDelete = (id: string) => {
    if (!confirm("Delete this receipt? On-hand will decrease accordingly.")) return;
    setBusyId(id);
    startTransition(async () => {
      const r = await deleteReceipt(id);
      setBusyId(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Receipt deleted.");
      router.refresh();
    });
  };

  return (
    <div className="ring-1 ring-foreground/10 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-foreground/5">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Vendor</th>
            <th className="px-3 py-2 font-medium">Item</th>
            <th className="px-3 py-2 font-medium text-right">Qty</th>
            <th className="px-3 py-2 font-medium text-right">Unit cost</th>
            <th className="px-3 py-2 font-medium">Note</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">
                No receipts yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-t border-foreground/10">
                <td className="px-3 py-2">{new Date(r.occurred_at).toLocaleString()}</td>
                <td className="px-3 py-2">{r.vendor_name ?? "—"}</td>
                <td className="px-3 py-2 font-medium">{r.item_name ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.qty} {r.unit ?? ""}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {r.unit_cost === null ? "—" : r.unit_cost.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.note ?? ""}</td>
                <td className="px-3 py-2 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(r.id)}
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

function ReceiptDialog({
  open,
  onOpenChange,
  locationId,
  vendors,
  existingStock,
  feeds,
  vetMeds,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  locationId: string;
  vendors: VendorOption[];
  existingStock: ExistingStockOption[];
  feeds: FeedOption[];
  vetMeds: VetOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vendor_id: NONE,
      target_kind: "existing",
      existing_stock_id: existingStock[0]?.id ?? "",
      catalog_feed_id: feeds[0]?.id ?? "",
      catalog_vet_id: vetMeds[0]?.id ?? "",
      display_name: "",
      unit: "kg",
      qty: 0,
      unit_cost: null,
      occurred_at: nowLocalIso(),
      note: "",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const targetKind = form.watch("target_kind");

  const onSubmit = (v: FormValues) => {
    let stockItemId: string | null = null;
    let source: Parameters<typeof createReceipt>[0]["source"] = null;
    let unit = v.unit;

    if (v.target_kind === "existing") {
      stockItemId = v.existing_stock_id || null;
      const hit = existingStock.find((s) => s.id === v.existing_stock_id);
      if (hit) unit = hit.unit;
      if (!stockItemId) {
        toast.error("Pick an existing stock line.");
        return;
      }
    } else if (v.target_kind === NEW_FEED) {
      source = {
        kind: "feed_material",
        feed_material_id: v.catalog_feed_id,
        unit,
      };
    } else if (v.target_kind === NEW_VET) {
      source = {
        kind: "vet_medicine",
        vet_medicine_id: v.catalog_vet_id,
        unit,
      };
    } else if (v.target_kind === NEW_CONSUMABLE || v.target_kind === NEW_EQUIPMENT) {
      if (!v.display_name) {
        toast.error("Display name required for a new item.");
        return;
      }
      source = {
        kind: v.target_kind === NEW_CONSUMABLE ? "consumable" : "equipment",
        display_name: v.display_name,
        unit,
      };
    }

    startTransition(async () => {
      const r = await createReceipt({
        location_id: locationId,
        vendor_id: v.vendor_id === NONE ? null : v.vendor_id,
        stock_item_id: stockItemId,
        source,
        qty: v.qty,
        unit_cost: v.unit_cost ?? null,
        occurred_at: new Date(v.occurred_at).toISOString(),
        note: v.note || null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Receipt recorded.");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record receipt</DialogTitle>
          <DialogDescription>
            Add to an existing stock line, or provision a new one from the
            feed / vet catalog or a free-form consumable / equipment item.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="vendor_id"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Vendor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>— none —</SelectItem>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                            {v.category ? ` · ${v.category}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="target_kind"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>What did you receive?</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="existing">An existing stock line</SelectItem>
                        <SelectItem value={NEW_FEED}>New: feed material (from catalog)</SelectItem>
                        <SelectItem value={NEW_VET}>New: vet medicine (from catalog)</SelectItem>
                        <SelectItem value={NEW_CONSUMABLE}>New: consumable</SelectItem>
                        <SelectItem value={NEW_EQUIPMENT}>New: equipment</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {targetKind === "existing" && (
                <FormField
                  control={form.control}
                  name="existing_stock_id"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Stock line</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pick a line" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {existingStock.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.display_name} · {s.unit} · {s.kind.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}

              {targetKind === NEW_FEED && (
                <FormField
                  control={form.control}
                  name="catalog_feed_id"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Feed material</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {feeds.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}

              {targetKind === NEW_VET && (
                <FormField
                  control={form.control}
                  name="catalog_vet_id"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Vet medicine</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vetMeds.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}

              {(targetKind === NEW_CONSUMABLE || targetKind === NEW_EQUIPMENT) && (
                <FormField
                  control={form.control}
                  name="display_name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Item name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            targetKind === NEW_CONSUMABLE
                              ? "Disposable gloves / Bedding"
                              : "Milk pail / Trolley"
                          }
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="qty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(Number(e.target.value || 0))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl>
                      <Input placeholder="kg / L / mL / each" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit cost</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="occurred_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>When</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Note (invoice #, etc.)</FormLabel>
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
                {isPending ? "Saving…" : "Record"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
