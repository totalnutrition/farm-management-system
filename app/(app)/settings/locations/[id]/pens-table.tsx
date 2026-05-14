"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
import { PenTypeView, PenTypes, type Pen } from "@/lib/pens";
import {
  createPen,
  deletePen,
  mergePens,
  splitPen,
  updatePen,
} from "./pens-actions";

type BarnLite = { id: string; name: string };
type GroupLite = { id: string; label: string };

const formSchema = z.object({
  name: z.string().trim().min(1, "Name required"),
  pen_code: z.string(),
  type: z.enum(PenTypes.map((p) => p.value) as [string, ...string[]]),
  barn_id: z.string(),
  group_id: z.string(),
  capacity_head: z.union([z.number(), z.literal("")]),
  bunk_running_ft: z.union([z.number(), z.literal("")]),
  stocking_target_pct: z.union([z.number(), z.literal("")]),
  length_ft: z.union([z.number(), z.literal("")]),
  width_ft: z.union([z.number(), z.literal("")]),
  position_index: z.union([z.number(), z.literal("")]),
  side: z.enum(["left", "right", ""]),
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
  bunk_running_ft: "" as unknown as number,
  stocking_target_pct: "" as unknown as number,
  length_ft: "" as unknown as number,
  width_ft: "" as unknown as number,
  position_index: 0,
  side: "" as const,
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
    bunk_running_ft:
      typeof values.bunk_running_ft === "number" ? values.bunk_running_ft : null,
    stocking_target_pct:
      typeof values.stocking_target_pct === "number" ? values.stocking_target_pct : null,
    length_ft: typeof values.length_ft === "number" ? values.length_ft : null,
    width_ft: typeof values.width_ft === "number" ? values.width_ft : null,
    position_index:
      typeof values.position_index === "number" ? values.position_index : 0,
    side: values.side === "" ? null : values.side,
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
  headcountByGroup = {},
  targetByGroup = {},
}: {
  locationId: string;
  rows: Pen[];
  barns: BarnLite[];
  groups: GroupLite[];
  headcountByGroup?: Record<string, number>;
  targetByGroup?: Record<string, { pen_cap: number; bunk_ft: number }>;
}) {
  const [deleting, setDeleting] = useState<Pen | null>(null);
  const [createDefaultGroupId, setCreateDefaultGroupId] = useState<string | null>(null);

  // Edit state is URL-driven: ?edit=<pen_id> opens that pen. Row edit
  // buttons and the BarnVisualizer both navigate to this URL, so the
  // dialog state is a single source of truth.
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const editParam = params.get("edit");
  const editing = useMemo<Pen | null>(
    () => (editParam ? rows.find((r) => r.id === editParam) ?? null : null),
    [editParam, rows],
  );
  const openPenEdit = (pen: Pen) => {
    const q = new URLSearchParams(params.toString());
    q.set("edit", pen.id);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const clearEditParam = () => {
    if (!editParam) return;
    const q = new URLSearchParams(params.toString());
    q.delete("edit");
    router.replace(`${pathname}${q.toString() ? `?${q.toString()}` : ""}`, {
      scroll: false,
    });
  };

  const barnLabel = (id: string | null) =>
    barns.find((b) => b.id === id)?.name ?? "—";

  // Group pens by group_id, then a final "Unassigned" bucket.
  const byGroup = new Map<string, Pen[]>();
  for (const p of rows) {
    const key = p.group_id ?? "__none__";
    const arr = byGroup.get(key) ?? [];
    arr.push(p);
    byGroup.set(key, arr);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Pens are grouped by their assigned group. Capacity is your
          declared head + bunk-feet — over- and under-stocking are
          shown as cautions, never blocked.
        </p>
        <CreateDialog
          locationId={locationId}
          barns={barns}
          groups={groups}
          defaultGroupId={createDefaultGroupId}
          onAfter={() => setCreateDefaultGroupId(null)}
        />
      </div>

      {groups.length === 0 && rows.length === 0 ? (
        <div className="ring-1 ring-foreground/10 p-3 text-xs text-muted-foreground">
          No groups yet — set up the herd-structure plan first under
          Groups, then add pens here.
        </div>
      ) : null}

      {groups.map((g) => {
        const groupPens = byGroup.get(g.id) ?? [];
        const headcount = headcountByGroup[g.id] ?? 0;
        const target = targetByGroup[g.id];
        return (
          <GroupSection
            key={g.id}
            group={g}
            pens={groupPens}
            headcount={headcount}
            targetPenCap={target?.pen_cap}
            targetBunkFt={target?.bunk_ft}
            barnLabel={barnLabel}
            onAdd={() => setCreateDefaultGroupId(g.id)}
            onEdit={openPenEdit}
            onDelete={setDeleting}
          />
        );
      })}

      {(byGroup.get("__none__") ?? []).length > 0 ? (
        <GroupSection
          group={{ id: "__none__", label: "Unassigned" }}
          pens={byGroup.get("__none__") ?? []}
          headcount={0}
          barnLabel={barnLabel}
          onAdd={() => setCreateDefaultGroupId(null)}
          onEdit={openPenEdit}
          onDelete={setDeleting}
        />
      ) : null}

      <EditDialog
        row={editing}
        locationId={locationId}
        barns={barns}
        groups={groups}
        allPens={rows}
        onClose={clearEditParam}
      />
      <DeleteDialog
        row={deleting}
        locationId={locationId}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

type SectionGroup = { id: string; label: string };
function GroupSection({
  group,
  pens,
  headcount,
  targetPenCap,
  targetBunkFt,
  barnLabel,
  onAdd,
  onEdit,
  onDelete,
}: {
  group: SectionGroup;
  pens: Pen[];
  headcount: number;
  targetPenCap?: number;
  targetBunkFt?: number;
  barnLabel: (id: string | null) => string;
  onAdd: () => void;
  onEdit: (p: Pen) => void;
  onDelete: (p: Pen) => void;
}) {
  const totalCap = pens.reduce((s, p) => s + (p.capacity_head ?? 0), 0);
  const totalBunk = pens.reduce((s, p) => s + (p.bunk_running_ft ?? 0), 0);
  const stockingPct = totalCap > 0 ? Math.round((headcount / totalCap) * 100) : 0;
  const bunkInPerCow = headcount > 0 ? Math.round((totalBunk * 12) / headcount) : 0;

  let stockingTone = "text-muted-foreground";
  let stockingNote = "—";
  if (totalCap > 0 && headcount > 0) {
    if (stockingPct > 115) {
      stockingTone = "text-destructive";
      stockingNote = "over-stocked";
    } else if (stockingPct < 70) {
      stockingTone = "text-amber-600 dark:text-amber-400";
      stockingNote = "under-stocked";
    } else {
      stockingTone = "text-primary";
      stockingNote = "on target";
    }
  }

  // Compare declared capacity to engine target (head × stocking).
  let targetTone = "text-muted-foreground";
  let targetNote = "";
  if (targetPenCap !== undefined && targetPenCap > 0) {
    if (totalCap === 0) {
      targetTone = "text-amber-600 dark:text-amber-400";
      targetNote = `target ${targetPenCap} head · no pens declared`;
    } else if (totalCap < targetPenCap) {
      const short = targetPenCap - totalCap;
      targetTone = "text-destructive";
      targetNote = `target ${targetPenCap} head · short by ${short}`;
    } else {
      const over = totalCap - targetPenCap;
      targetTone = "text-primary";
      targetNote =
        over === 0
          ? `target ${targetPenCap} head · met`
          : `target ${targetPenCap} head · +${over} headroom`;
    }
    if (targetBunkFt !== undefined && targetBunkFt > 0) {
      targetNote += ` · target ${targetBunkFt.toFixed(0)}ft bunk`;
    }
  }

  return (
    <section className="ring-1 ring-foreground/10 flex flex-col">
      <header className="px-3 py-2 bg-foreground/5 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-medium">
            {group.label}
            <span className="ml-2 text-[10px] font-normal text-muted-foreground">
              {pens.length} pen{pens.length === 1 ? "" : "s"} · {headcount} cow{headcount === 1 ? "" : "s"}
              {totalCap > 0 ? ` · cap ${totalCap}` : ""}
              {totalBunk > 0 ? ` · ${totalBunk}ft bunk` : ""}
            </span>
          </h3>
          <p className={`text-[10px] ${stockingTone}`}>
            {totalCap > 0 ? `${stockingPct}% stocked · ${stockingNote}` : "no capacity declared"}
            {bunkInPerCow > 0 ? ` · ${bunkInPerCow} in/cow bunk space` : ""}
          </p>
          {targetNote ? (
            <p className={`text-[10px] ${targetTone}`}>{targetNote}</p>
          ) : null}
        </div>
        {group.id !== "__none__" ? (
          <Button type="button" size="sm" variant="ghost" onClick={onAdd}>
            <HugeiconsIcon icon={PlusSignIcon} />
            Add pen
          </Button>
        ) : null}
      </header>
      {pens.length === 0 ? (
        <div className="px-3 py-3 text-xs text-muted-foreground text-center">
          No pens in this group yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-foreground/[0.025]">
              <tr className="text-left">
                <th className="px-3 py-1.5 font-medium">Name</th>
                <th className="px-3 py-1.5 font-medium">Type</th>
                <th className="px-3 py-1.5 font-medium">Barn</th>
                <th className="px-3 py-1.5 font-medium text-right">Cap</th>
                <th className="px-3 py-1.5 font-medium text-right">Bunk ft</th>
                <th className="px-3 py-1.5 font-medium">Flags</th>
                <th className="px-3 py-1.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pens.map((p) => (
                <tr key={p.id} className="border-t border-foreground/10">
                  <td className="px-3 py-1.5">
                    <span className="font-medium">{p.name}</span>
                    {p.is_placeholder ? (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        placeholder
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-1.5">{PenTypeView[p.type] ?? p.type}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{barnLabel(p.barn_id)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{p.capacity_head ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{p.bunk_running_ft ?? "—"}</td>
                  <td className="px-3 py-1.5 text-[10px] text-muted-foreground">
                    {[
                      p.is_AI_pen ? "AI" : null,
                      p.is_BULL_pen ? "BULL" : null,
                      p.is_DRY_pen ? "DRY" : null,
                      p.is_HOSP_pen ? "HOSP" : null,
                      p.is_FRESH_pen ? "FRESH" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(p)}>
                      <HugeiconsIcon icon={PencilEdit02Icon} />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(p)}>
                      <HugeiconsIcon icon={Delete02Icon} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
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
          name="bunk_running_ft"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bunk feet (running)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  inputMode="decimal"
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
          name="stocking_target_pct"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Target stocking % (override)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="leave blank to use group default"
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
          name="length_ft"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pen length (ft, along barn long axis)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  inputMode="decimal"
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
          name="width_ft"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pen width (ft)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  inputMode="decimal"
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
          name="position_index"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Position (order along barn, 0 = first)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
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
          name="side"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Side (double-side barns only)</FormLabel>
              <FormControl>
                <Select
                  value={field.value === "" ? "__none" : field.value}
                  onValueChange={(v) =>
                    field.onChange(v === "__none" ? "" : (v as "left" | "right"))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— n/a —</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
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
        <p className="text-xs font-medium">Pen-type side-effect flags</p>
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
  defaultGroupId,
  onAfter,
}: {
  locationId: string;
  barns: BarnLite[];
  groups: GroupLite[];
  defaultGroupId?: string | null;
  onAfter?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: empty,
  });

  // Open the dialog automatically when caller provides a default group
  // (i.e. the user clicked "Add pen" inside a group section).
  if (defaultGroupId !== undefined && defaultGroupId !== null && !open) {
    form.reset({ ...empty, group_id: defaultGroupId });
    setOpen(true);
  }

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
      onAfter?.();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onAfter?.();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <HugeiconsIcon icon={PlusSignIcon} />
          New pen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Pen</DialogTitle>
          <DialogDescription>
            Pens belong to groups. Capacity + bunk feet are your
            declared values; the app cautions on over- / under-stocking
            but never blocks.
          </DialogDescription>
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
  allPens,
  onClose,
}: {
  row: Pen | null;
  locationId: string;
  barns: BarnLite[];
  groups: GroupLite[];
  allPens: Pen[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitAt, setSplitAt] = useState<string>("");
  const [splitName, setSplitName] = useState<string>("");
  const [mergeWith, setMergeWith] = useState<string>("");
  const [mergeName, setMergeName] = useState<string>("");
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
          bunk_running_ft: row.bunk_running_ft ?? ("" as unknown as number),
          stocking_target_pct: row.stocking_target_pct ?? ("" as unknown as number),
          length_ft: row.length_ft ?? ("" as unknown as number),
          width_ft: row.width_ft ?? ("" as unknown as number),
          position_index: row.position_index ?? 0,
          side: (row.side ?? "") as "left" | "right" | "",
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

  // Adjacent / sibling pens in the same barn for the Merge dropdown.
  const mergeCandidates = allPens.filter(
    (p) => p.id !== row.id && p.barn_id !== null && p.barn_id === row.barn_id,
  );

  const doMerge = () => {
    if (!mergeWith) {
      toast.error("Pick a pen to merge with.");
      return;
    }
    if (!confirm("Merge will delete the other pen and move its cows here. Continue?"))
      return;
    startTransition(async () => {
      const r = await mergePens({
        primary_pen_id: row.id,
        secondary_pen_id: mergeWith,
        new_name: mergeName.trim() || undefined,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Pens merged.");
      setMergeWith("");
      setMergeName("");
      onClose();
      router.refresh();
    });
  };

  const doSplit = () => {
    const at = Number(splitAt);
    if (!at || at <= 0) {
      toast.error("Enter a split point in feet.");
      return;
    }
    if (!splitName.trim()) {
      toast.error("Name the new pen.");
      return;
    }
    startTransition(async () => {
      const r = await splitPen({
        pen_id: row.id,
        split_at_ft: at,
        new_name: splitName.trim(),
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Pen split.");
      setSplitOpen(false);
      setSplitAt("");
      setSplitName("");
      onClose();
      router.refresh();
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

        <section className="border-t border-foreground/10 pt-3 mt-3 flex flex-col gap-3">
          <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Layout actions
          </h4>

          <div className="ring-1 ring-foreground/10 p-3 flex flex-col gap-2">
            <div className="text-xs font-medium">Split this pen</div>
            <p className="text-[10px] text-muted-foreground">
              Carves the pen into two along its length. Capacity, bunk feet,
              and length are allocated proportionally. Requires the pen&apos;s
              length_ft to be set.
            </p>
            {!splitOpen ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSplitOpen(true)}
                disabled={!row.length_ft}
              >
                Split…
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted-foreground">
                    Split at (ft from start, max {row.length_ft ?? 0})
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    max={Number(row.length_ft ?? 0)}
                    value={splitAt}
                    onChange={(e) => setSplitAt(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted-foreground">
                    Name for the new pen
                  </label>
                  <Input
                    value={splitName}
                    onChange={(e) => setSplitName(e.target.value)}
                    placeholder={`${row.name} B`}
                  />
                </div>
                <div className="col-span-2 flex gap-2">
                  <Button type="button" size="sm" onClick={doSplit} disabled={isPending}>
                    {isPending ? "Splitting…" : "Apply split"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSplitOpen(false);
                      setSplitAt("");
                      setSplitName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="ring-1 ring-foreground/10 p-3 flex flex-col gap-2">
            <div className="text-xs font-medium">Merge with another pen</div>
            <p className="text-[10px] text-muted-foreground">
              Combines the other pen into this one. The other pen&apos;s cows
              and capacity / bunk / length values transfer here, then the
              other pen is deleted. Same barn only.
            </p>
            {mergeCandidates.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic">
                No other pens in this barn to merge with.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted-foreground">
                    Pen to merge into this one
                  </label>
                  <Select value={mergeWith} onValueChange={setMergeWith}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a pen" />
                    </SelectTrigger>
                    <SelectContent>
                      {mergeCandidates.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.length_ft ? ` · ${p.length_ft}ft` : ""}
                          {p.capacity_head ? ` · cap ${p.capacity_head}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted-foreground">
                    New name (optional)
                  </label>
                  <Input
                    value={mergeName}
                    onChange={(e) => setMergeName(e.target.value)}
                    placeholder={row.name}
                  />
                </div>
                <div className="col-span-2">
                  <Button type="button" size="sm" onClick={doMerge} disabled={isPending || !mergeWith}>
                    {isPending ? "Merging…" : "Merge"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
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
