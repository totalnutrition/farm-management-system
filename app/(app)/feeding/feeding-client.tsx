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
  CookBookIcon,
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

import { createFeedingEvent, deleteFeedingEvent } from "./actions";

export type FeedingEvent = {
  id: string;
  occurred_at: string;
  as_fed_kg: number;
  dm_kg: number | null;
  group_label: string | null;
  pen_name: string | null;
  feed_name: string | null;
  note: string | null;
};
export type GroupOption = { id: string; label: string };
export type PenOption = { id: string; name: string };
export type FeedOption = { id: string; name: string; dm_pct: number | null };
export type RecipeOption = { id: string; name: string };

const NONE = "__none__";

const formSchema = z.object({
  group_id: z.string(),
  pen_id: z.string(),
  feed_material_id: z.string().min(1, "Pick a feed material."),
  recipe_id: z.string(),
  as_fed_kg: z.number().positive("Must be > 0"),
  occurred_at: z.string().min(1, "Required."),
  note: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

function nowLocalIso(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function FeedingClient({
  locationId,
  events,
  groups,
  pens,
  feeds,
  recipes = [],
}: {
  locationId: string;
  events: FeedingEvent[];
  groups: GroupOption[];
  pens: PenOption[];
  feeds: FeedOption[];
  recipes?: RecipeOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {events.length} event{events.length === 1 ? "" : "s"} on file. Each
          entry deducts as-fed kg from the matching feed stock line.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} disabled={feeds.length === 0}>
          <HugeiconsIcon icon={PlusSignIcon} />
          Record feeding
        </Button>
      </div>

      {feeds.length === 0 ? (
        <div className="ring-1 ring-foreground/10 p-3 text-xs text-muted-foreground">
          No feed materials yet. Add one in Settings → Organization → Catalogs.
        </div>
      ) : null}

      <EventsTable events={events} />

      <AddFeedingDialog
        open={open}
        onOpenChange={setOpen}
        locationId={locationId}
        groups={groups}
        pens={pens}
        feeds={feeds}
        recipes={recipes}
      />
    </>
  );
}

function EventsTable({ events }: { events: FeedingEvent[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const onDelete = (id: string) => {
    if (!confirm("Delete this feeding event? Stock will be restored.")) return;
    setBusyId(id);
    startTransition(async () => {
      const r = await deleteFeedingEvent(id);
      setBusyId(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Feeding event deleted.");
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
            <th className="px-3 py-2 font-medium">Feed</th>
            <th className="px-3 py-2 font-medium text-right">As-fed kg</th>
            <th className="px-3 py-2 font-medium text-right">DM kg</th>
            <th className="px-3 py-2 font-medium">Note</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">
                No feeding events yet.
              </td>
            </tr>
          ) : (
            events.map((e) => (
              <tr key={e.id} className="border-t border-foreground/10">
                <td className="px-3 py-2">
                  {new Date(e.occurred_at).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  {e.group_label ?? e.pen_name ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1">
                    <HugeiconsIcon icon={CookBookIcon} className="size-3" />
                    {e.feed_name ?? "—"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{e.as_fed_kg}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {e.dm_kg === null ? "—" : e.dm_kg.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{e.note ?? ""}</td>
                <td className="px-3 py-2 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(e.id)}
                    disabled={busyId === e.id}
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

function AddFeedingDialog({
  open,
  onOpenChange,
  locationId,
  groups,
  pens,
  feeds,
  recipes,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  locationId: string;
  groups: GroupOption[];
  pens: PenOption[];
  feeds: FeedOption[];
  recipes: RecipeOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      group_id: NONE,
      pen_id: NONE,
      feed_material_id: feeds[0]?.id ?? "",
      recipe_id: NONE,
      as_fed_kg: 0,
      occurred_at: nowLocalIso(),
      note: "",
    },
  });

  const onSubmit = (v: FormValues) => {
    startTransition(async () => {
      const r = await createFeedingEvent({
        location_id: locationId,
        group_id: v.group_id === NONE ? null : v.group_id,
        pen_id: v.pen_id === NONE ? null : v.pen_id,
        feed_material_id: v.feed_material_id,
        recipe_id: v.recipe_id === NONE ? null : v.recipe_id,
        as_fed_kg: v.as_fed_kg,
        occurred_at: new Date(v.occurred_at).toISOString(),
        note: v.note ?? null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Feeding recorded.");
      form.reset({
        group_id: NONE,
        pen_id: NONE,
        feed_material_id: feeds[0]?.id ?? "",
        recipe_id: NONE,
        as_fed_kg: 0,
        occurred_at: nowLocalIso(),
        note: "",
      });
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record feeding</DialogTitle>
          <DialogDescription>
            Each entry inserts a feed_event and a paired stock_movement
            (consumption) tied back to it. DM kg is derived from the
            catalog DM %.
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
                name="feed_material_id"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Feed material</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a feed" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {feeds.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                            {f.dm_pct !== null ? ` · ${f.dm_pct}% DM` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {recipes.length > 0 ? (
                <FormField
                  control={form.control}
                  name="recipe_id"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Recipe (optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE}>— none —</SelectItem>
                          {recipes.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              ) : null}
              <FormField
                control={form.control}
                name="as_fed_kg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>As-fed (kg)</FormLabel>
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
