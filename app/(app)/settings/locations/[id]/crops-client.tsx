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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createCropPlan,
  deleteCropPlan,
  recordCropEvent,
  updateCropPlan,
  type CropPlan,
} from "./crops-actions";

const statusOptions = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "harvested", label: "Harvested" },
  { value: "failed", label: "Failed" },
  { value: "archived", label: "Archived" },
] as const;

const eventTypeOptions = [
  { value: "planting", label: "Planting" },
  { value: "irrigation", label: "Irrigation" },
  { value: "fertilization", label: "Fertilization" },
  { value: "spray", label: "Spray (pesticide/herbicide)" },
  { value: "scouting", label: "Scouting" },
  { value: "harvest", label: "Harvest" },
  { value: "residue_management", label: "Residue management" },
  { value: "other", label: "Other" },
] as const;

type ParcelLite = { id: string; name: string; area_hectares: number | null };

const planForm = z.object({
  parcel_id: z.string().uuid("Pick a parcel."),
  crop_type: z.string().trim().min(1, "Crop type required."),
  variety: z.string(),
  planted_at: z.string(),
  planned_harvest_at: z.string(),
  status: z.enum(statusOptions.map((s) => s.value) as [string, ...string[]]),
  expected_yield_kg_per_ha: z.union([z.number(), z.literal("")]),
  actual_yield_kg_per_ha: z.union([z.number(), z.literal("")]),
  notes: z.string(),
});
type PlanFormValues = z.infer<typeof planForm>;

const today = () => new Date().toISOString().slice(0, 10);

function defaultPlanValues(parcelId: string): PlanFormValues {
  return {
    parcel_id: parcelId,
    crop_type: "",
    variety: "",
    planted_at: "",
    planned_harvest_at: "",
    status: "planned",
    expected_yield_kg_per_ha: "" as unknown as number,
    actual_yield_kg_per_ha: "" as unknown as number,
    notes: "",
  };
}

function toPlanSubmit(values: PlanFormValues) {
  return {
    parcel_id: values.parcel_id,
    crop_type: values.crop_type,
    variety: values.variety || null,
    planted_at: values.planted_at || null,
    planned_harvest_at: values.planned_harvest_at || null,
    status: values.status as
      | "planned"
      | "in_progress"
      | "harvested"
      | "failed"
      | "archived",
    expected_yield_kg_per_ha:
      typeof values.expected_yield_kg_per_ha === "number"
        ? values.expected_yield_kg_per_ha
        : null,
    actual_yield_kg_per_ha:
      typeof values.actual_yield_kg_per_ha === "number"
        ? values.actual_yield_kg_per_ha
        : null,
    notes: values.notes || null,
  };
}

export function CropsClient({
  parcels,
  plans,
}: {
  parcels: ParcelLite[];
  plans: (CropPlan & { parcel_name: string })[];
}) {
  const [editing, setEditing] = useState<CropPlan | null>(null);
  const [deleting, setDeleting] = useState<CropPlan | null>(null);
  const [logging, setLogging] = useState<CropPlan | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <CreateDialog parcels={parcels} />
      </div>
      <div className="ring-1 ring-foreground/10 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Parcel</TableHead>
              <TableHead>Crop</TableHead>
              <TableHead>Variety</TableHead>
              <TableHead>Planted</TableHead>
              <TableHead>Planned harvest</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Expected (kg/ha)</TableHead>
              <TableHead className="text-right">Actual (kg/ha)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No crop plans yet.
                  {parcels.length === 0 ? (
                    <>
                      {" "}
                      Add an arable parcel under <strong>Infrastructure</strong> first.
                    </>
                  ) : null}
                </TableCell>
              </TableRow>
            ) : (
              plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.parcel_name}</TableCell>
                  <TableCell>{p.crop_type}</TableCell>
                  <TableCell className="text-muted-foreground">{p.variety ?? "—"}</TableCell>
                  <TableCell className="text-xs">{p.planted_at ?? "—"}</TableCell>
                  <TableCell className="text-xs">{p.planned_harvest_at ?? "—"}</TableCell>
                  <TableCell className="capitalize text-xs">
                    {p.status.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {p.expected_yield_kg_per_ha ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {p.actual_yield_kg_per_ha ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setLogging(p)}
                      >
                        Log event
                      </Button>
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

      <EditDialog row={editing} parcels={parcels} onClose={() => setEditing(null)} />
      <DeleteDialog row={deleting} onClose={() => setDeleting(null)} />
      <EventDialog row={logging} onClose={() => setLogging(null)} />
    </div>
  );
}

function PlanFormBody({
  form,
  parcels,
}: {
  form: ReturnType<typeof useForm<PlanFormValues>>;
  parcels: ParcelLite[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FormField
        control={form.control}
        name="parcel_id"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Parcel</FormLabel>
            <FormControl>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a parcel" />
                </SelectTrigger>
                <SelectContent>
                  {parcels.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.area_hectares !== null ? ` (${p.area_hectares} ha)` : ""}
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
        name="crop_type"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Crop type</FormLabel>
            <FormControl>
              <Input
                placeholder="Corn / Alfalfa / Wheat / ..."
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="variety"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Variety</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="planted_at"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Planted</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="planned_harvest_at"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Planned harvest</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <FormControl>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
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
        name="expected_yield_kg_per_ha"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Expected yield (kg/ha)</FormLabel>
            <FormControl>
              <Input
                type="number"
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
        name="actual_yield_kg_per_ha"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Actual yield (kg/ha)</FormLabel>
            <FormControl>
              <Input
                type="number"
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

function CreateDialog({ parcels }: { parcels: ParcelLite[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planForm),
    defaultValues: defaultPlanValues(parcels[0]?.id ?? ""),
  });
  const onSubmit = (values: PlanFormValues) => {
    startTransition(async () => {
      const result = await createCropPlan(toPlanSubmit(values));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Crop plan created.");
      form.reset(defaultPlanValues(parcels[0]?.id ?? ""));
      setOpen(false);
      router.refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" disabled={parcels.length === 0}>
          <HugeiconsIcon icon={PlusSignIcon} />
          New crop plan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New crop plan</DialogTitle>
          <DialogDescription>Crop on a specific parcel.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <PlanFormBody form={form} parcels={parcels} />
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
  parcels,
  onClose,
}: {
  row: CropPlan | null;
  parcels: ParcelLite[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planForm),
    values: row
      ? ({
          parcel_id: row.parcel_id,
          crop_type: row.crop_type,
          variety: row.variety ?? "",
          planted_at: row.planted_at ?? "",
          planned_harvest_at: row.planned_harvest_at ?? "",
          status: row.status as PlanFormValues["status"],
          expected_yield_kg_per_ha:
            row.expected_yield_kg_per_ha ?? ("" as unknown as number),
          actual_yield_kg_per_ha:
            row.actual_yield_kg_per_ha ?? ("" as unknown as number),
          notes: row.notes ?? "",
        } as PlanFormValues)
      : defaultPlanValues(""),
  });
  if (!row) return null;
  const onSubmit = (values: PlanFormValues) => {
    startTransition(async () => {
      const result = await updateCropPlan({ id: row.id, ...toPlanSubmit(values) });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Crop plan updated.");
      onClose();
      router.refresh();
    });
  };
  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit crop plan</DialogTitle>
          <DialogDescription>{row.crop_type}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <PlanFormBody form={form} parcels={parcels} />
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
  row: CropPlan | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  if (!row) return null;
  const onConfirm = () => {
    startTransition(async () => {
      const result = await deleteCropPlan({ id: row.id, parcel_id: row.parcel_id });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Plan deleted.");
      onClose();
      router.refresh();
    });
  };
  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete plan</DialogTitle>
          <DialogDescription>
            This will permanently delete the <strong>{row.crop_type}</strong> plan
            and all its events.
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

function EventDialog({
  row,
  onClose,
}: {
  row: CropPlan | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [eventDate, setEventDate] = useState(today());
  const [eventType, setEventType] = useState<
    "planting" | "irrigation" | "fertilization" | "spray" | "scouting" | "harvest" | "residue_management" | "other"
  >("scouting");
  const [description, setDescription] = useState("");
  if (!row) return null;
  const onSave = () => {
    startTransition(async () => {
      const result = await recordCropEvent({
        plan_id: row.id,
        event_date: eventDate,
        event_type: eventType,
        description: description || null,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Event logged.");
      onClose();
      setDescription("");
      router.refresh();
    });
  };
  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log event — {row.crop_type}</DialogTitle>
          <DialogDescription>Free-text events on this crop plan.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs">Date</label>
            <Input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs">Event type</label>
            <Select
              value={eventType}
              onValueChange={(v) => setEventType(v as typeof eventType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {eventTypeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs">Description</label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
