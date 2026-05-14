"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Settings02Icon,
  ArrowMoveDownRightIcon,
  ArrowMoveUpRightIcon,
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

import { adjustStock, updateReorderLevel } from "./actions";

export type StockItem = {
  id: string;
  kind: string;
  display_name: string;
  unit: string;
  on_hand_qty: number;
  reorder_level: number | null;
  unit_cost_current: number | null;
};

function nowLocalIso(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const KIND_LABEL: Record<string, string> = {
  feed_material: "Feed materials",
  vet_medicine: "Veterinary medicines",
  semen_straw: "Semen straws",
  consumable: "Consumables",
  equipment: "Equipment",
};

export function StocksClient({ items }: { items: StockItem[] }) {
  const grouped = new Map<string, StockItem[]>();
  for (const it of items) {
    const arr = grouped.get(it.kind) ?? [];
    arr.push(it);
    grouped.set(it.kind, arr);
  }
  const kinds = ["feed_material", "vet_medicine", "semen_straw", "consumable", "equipment"];

  return (
    <>
      {items.length === 0 ? (
        <div className="ring-1 ring-foreground/10 p-3 text-xs text-muted-foreground">
          No stock lines yet. Lines are auto-created when you log a feeding or
          vaccination event, or when you record a procurement receipt.
        </div>
      ) : null}
      {kinds.map((k) => {
        const list = grouped.get(k);
        if (!list?.length) return null;
        return (
          <section key={k} className="ring-1 ring-foreground/10 flex flex-col">
            <header className="px-3 py-2 bg-foreground/5 text-xs font-medium">
              {KIND_LABEL[k] ?? k}
              <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                {list.length} line{list.length === 1 ? "" : "s"}
              </span>
            </header>
            <Table items={list} />
          </section>
        );
      })}
    </>
  );
}

function Table({ items }: { items: StockItem[] }) {
  const [adjusting, setAdjusting] = useState<StockItem | null>(null);
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-foreground/[0.025]">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Unit</th>
              <th className="px-3 py-2 font-medium text-right">On hand</th>
              <th className="px-3 py-2 font-medium text-right">Reorder at</th>
              <th className="px-3 py-2 font-medium text-right">Unit cost</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((s) => {
              const low =
                s.reorder_level !== null && s.on_hand_qty <= s.reorder_level;
              return (
                <tr key={s.id} className="border-t border-foreground/10">
                  <td className="px-3 py-2 font-medium">{s.display_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.unit}</td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      low ? "text-destructive font-medium" : ""
                    }`}
                  >
                    {s.on_hand_qty.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    <ReorderField item={s} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {s.unit_cost_current === null ? "—" : s.unit_cost_current.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAdjusting(s)}>
                      <HugeiconsIcon icon={Settings02Icon} />
                      Adjust
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AdjustDialog
        open={!!adjusting}
        onOpenChange={(o) => !o && setAdjusting(null)}
        item={adjusting}
      />
    </>
  );
}

function ReorderField({ item }: { item: StockItem }) {
  const [value, setValue] = useState<string>(
    item.reorder_level === null ? "" : String(item.reorder_level),
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const commit = () => {
    const num = value.trim() === "" ? null : Number(value);
    if (num !== null && Number.isNaN(num)) {
      setValue(item.reorder_level === null ? "" : String(item.reorder_level));
      return;
    }
    if ((item.reorder_level ?? null) === num) return;
    startTransition(async () => {
      const r = await updateReorderLevel({ stock_item_id: item.id, reorder_level: num });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Reorder level updated.");
      router.refresh();
    });
  };

  return (
    <Input
      type="number"
      step="any"
      min={0}
      value={value}
      disabled={isPending}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="h-7 w-24 ml-auto text-right tabular-nums"
    />
  );
}

const adjustFormSchema = z.object({
  qty_delta: z.number(),
  kind: z.enum(["adjustment", "wastage", "opening"]),
  occurred_at: z.string().min(1),
  note: z.string().optional(),
});
type AdjustFormValues = z.infer<typeof adjustFormSchema>;

function AdjustDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  item: StockItem | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<AdjustFormValues>({
    resolver: zodResolver(adjustFormSchema),
    defaultValues: {
      qty_delta: 0,
      kind: "adjustment",
      occurred_at: nowLocalIso(),
      note: "",
    },
  });

  const onSubmit = (v: AdjustFormValues) => {
    if (!item) return;
    if (v.qty_delta === 0) {
      toast.error("Delta can't be zero.");
      return;
    }
    startTransition(async () => {
      const r = await adjustStock({
        stock_item_id: item.id,
        qty_delta: v.qty_delta,
        kind: v.kind,
        occurred_at: new Date(v.occurred_at).toISOString(),
        note: v.note || null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Stock adjusted.");
      onOpenChange(false);
      form.reset({ qty_delta: 0, kind: "adjustment", occurred_at: nowLocalIso(), note: "" });
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust {item?.display_name}</DialogTitle>
          <DialogDescription>
            Positive delta adds to on-hand, negative removes. Adjustments,
            wastage, and opening balances all land in the ledger and stay
            traceable.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kind</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="opening">
                        <span className="inline-flex items-center gap-1">
                          <HugeiconsIcon icon={ArrowMoveUpRightIcon} className="size-3" />
                          Opening balance
                        </span>
                      </SelectItem>
                      <SelectItem value="adjustment">Adjustment (count fix)</SelectItem>
                      <SelectItem value="wastage">
                        <span className="inline-flex items-center gap-1">
                          <HugeiconsIcon icon={ArrowMoveDownRightIcon} className="size-3" />
                          Wastage / spoilage
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="qty_delta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delta ({item?.unit ?? ""})</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="any"
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
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Apply"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
