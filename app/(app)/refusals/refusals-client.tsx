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

import { createRefusal, deleteRefusal } from "./actions";

export type RefusalRow = {
  id: string;
  occurred_at: string;
  refusal_kg: number;
  group_label: string | null;
  pen_name: string | null;
  feed_event_at: string | null;
  note: string | null;
};
export type GroupOption = { id: string; label: string };
export type PenOption = { id: string; name: string };
export type FeedEventOption = {
  id: string;
  occurred_at: string;
  feed_name: string | null;
};

const NONE = "__none__";

const formSchema = z.object({
  group_id: z.string(),
  pen_id: z.string(),
  feed_event_id: z.string(),
  refusal_kg: z.number().nonnegative(),
  occurred_at: z.string().min(1),
  note: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

function nowLocalIso(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function RefusalsClient({
  locationId,
  rows,
  groups,
  pens,
  feedEvents,
}: {
  locationId: string;
  rows: RefusalRow[];
  groups: GroupOption[];
  pens: PenOption[];
  feedEvents: FeedEventOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {rows.length} refusal{rows.length === 1 ? "" : "s"} logged. Tie one
          to its feeding event to get the intake math right.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          <HugeiconsIcon icon={PlusSignIcon} />
          Record refusal
        </Button>
      </div>

      <RefusalsTable rows={rows} />

      <AddRefusalDialog
        open={open}
        onOpenChange={setOpen}
        locationId={locationId}
        groups={groups}
        pens={pens}
        feedEvents={feedEvents}
      />
    </>
  );
}

function RefusalsTable({ rows }: { rows: RefusalRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const onDelete = (id: string) => {
    if (!confirm("Delete this refusal?")) return;
    setBusyId(id);
    startTransition(async () => {
      const r = await deleteRefusal(id);
      setBusyId(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Refusal deleted.");
      router.refresh();
    });
  };

  return (
    <div className="ring-1 ring-foreground/10 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-foreground/5">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Group / Pen</th>
            <th className="px-3 py-2 font-medium">Tied feeding</th>
            <th className="px-3 py-2 font-medium text-right">Refusal kg</th>
            <th className="px-3 py-2 font-medium">Note</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                No refusals yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-t border-foreground/10">
                <td className="px-3 py-2">{new Date(r.occurred_at).toLocaleString()}</td>
                <td className="px-3 py-2">{r.group_label ?? r.pen_name ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {r.feed_event_at ? new Date(r.feed_event_at).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.refusal_kg}</td>
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

function AddRefusalDialog({
  open,
  onOpenChange,
  locationId,
  groups,
  pens,
  feedEvents,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  locationId: string;
  groups: GroupOption[];
  pens: PenOption[];
  feedEvents: FeedEventOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      group_id: NONE,
      pen_id: NONE,
      feed_event_id: NONE,
      refusal_kg: 0,
      occurred_at: nowLocalIso(),
      note: "",
    },
  });

  const onSubmit = (v: FormValues) =>
    startTransition(async () => {
      const r = await createRefusal({
        location_id: locationId,
        group_id: v.group_id === NONE ? null : v.group_id,
        pen_id: v.pen_id === NONE ? null : v.pen_id,
        feed_event_id: v.feed_event_id === NONE ? null : v.feed_event_id,
        refusal_kg: v.refusal_kg,
        occurred_at: new Date(v.occurred_at).toISOString(),
        note: v.note ?? null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Refusal recorded.");
      onOpenChange(false);
      form.reset({
        group_id: NONE,
        pen_id: NONE,
        feed_event_id: NONE,
        refusal_kg: 0,
        occurred_at: nowLocalIso(),
        note: "",
      });
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record refusal</DialogTitle>
          <DialogDescription>
            Leftover (orts) weight. Pair it with the feeding event to drive
            intake calculations.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="group_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>— none —</SelectItem>
                        {groups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pen_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pen</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>— none —</SelectItem>
                        {pens.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="feed_event_id"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Tied feeding event</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>— none —</SelectItem>
                        {feedEvents.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {new Date(f.occurred_at).toLocaleString()}
                            {f.feed_name ? ` · ${f.feed_name}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="refusal_kg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Refusal kg</FormLabel>
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
                    <FormLabel>Note</FormLabel>
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
