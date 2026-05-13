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
import {
  BarnTypeView,
  BarnTypes,
  ParlorTypes,
  RowConfigView,
  RowConfigurations,
  VentilationTypes,
  type Barn,
} from "@/lib/barns";
import { createBarn, deleteBarn, updateBarn } from "./barns-actions";

const numOrEmpty = z.union([z.number(), z.literal("")]);

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  barn_code: z.string().trim(),
  type: z.enum(BarnTypes.map((b) => b.value) as [string, ...string[]]),
  row_configuration: z.string(),
  freestall_count: numOrEmpty,
  headlock_count: numOrEmpty,
  loafing_area_sqft: numOrEmpty,
  holding_pen_capacity: numOrEmpty,
  stall_surface: z.string(),
  bedding_type: z.string(),
  stall_length_ft: numOrEmpty,
  stall_width_in: numOrEmpty,
  neck_rail_height_in: numOrEmpty,
  bunk_type: z.string(),
  bunk_total_linear_ft: numOrEmpty,
  floor_type: z.string(),
  manure_handling: z.string(),
  ventilation_type: z.string(),
  fan_count: numOrEmpty,
  fan_diameter_in: numOrEmpty,
  soaker_lines_present: z.boolean(),
  soaker_nozzle_height_in: numOrEmpty,
  sprinklers: z.boolean(),
  fans_over_stalls: z.boolean(),
  brushes_count: numOrEmpty,
  footbath_present: z.boolean(),
  parlor_type: z.string(),
  parlor_stalls: numOrEmpty,
  robot_count: numOrEmpty,
  notes: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

const emptyValues: FormValues = {
  name: "",
  barn_code: "",
  type: "freestall",
  row_configuration: "",
  freestall_count: "" as unknown as number,
  headlock_count: "" as unknown as number,
  loafing_area_sqft: "" as unknown as number,
  holding_pen_capacity: "" as unknown as number,
  stall_surface: "",
  bedding_type: "",
  stall_length_ft: "" as unknown as number,
  stall_width_in: "" as unknown as number,
  neck_rail_height_in: "" as unknown as number,
  bunk_type: "",
  bunk_total_linear_ft: "" as unknown as number,
  floor_type: "",
  manure_handling: "",
  ventilation_type: "",
  fan_count: "" as unknown as number,
  fan_diameter_in: "" as unknown as number,
  soaker_lines_present: false,
  soaker_nozzle_height_in: "" as unknown as number,
  sprinklers: false,
  fans_over_stalls: false,
  brushes_count: "" as unknown as number,
  footbath_present: false,
  parlor_type: "",
  parlor_stalls: "" as unknown as number,
  robot_count: "" as unknown as number,
  notes: "",
};

function toSubmit(locationId: string, values: FormValues) {
  return {
    location_id: locationId,
    name: values.name,
    barn_code: values.barn_code || null,
    type: values.type,
    row_configuration: values.row_configuration || null,
    freestall_count: typeof values.freestall_count === "number" ? values.freestall_count : null,
    headlock_count: typeof values.headlock_count === "number" ? values.headlock_count : null,
    loafing_area_sqft:
      typeof values.loafing_area_sqft === "number" ? values.loafing_area_sqft : null,
    holding_pen_capacity:
      typeof values.holding_pen_capacity === "number" ? values.holding_pen_capacity : null,
    stall_surface: values.stall_surface || null,
    bedding_type: values.bedding_type || null,
    stall_length_ft: typeof values.stall_length_ft === "number" ? values.stall_length_ft : null,
    stall_width_in: typeof values.stall_width_in === "number" ? values.stall_width_in : null,
    neck_rail_height_in:
      typeof values.neck_rail_height_in === "number" ? values.neck_rail_height_in : null,
    bunk_type: values.bunk_type || null,
    bunk_total_linear_ft:
      typeof values.bunk_total_linear_ft === "number" ? values.bunk_total_linear_ft : null,
    floor_type: values.floor_type || null,
    manure_handling: values.manure_handling || null,
    ventilation_type: values.ventilation_type || null,
    fan_count: typeof values.fan_count === "number" ? values.fan_count : null,
    fan_diameter_in:
      typeof values.fan_diameter_in === "number" ? values.fan_diameter_in : null,
    soaker_lines_present: values.soaker_lines_present,
    soaker_nozzle_height_in:
      typeof values.soaker_nozzle_height_in === "number"
        ? values.soaker_nozzle_height_in
        : null,
    sprinklers: values.sprinklers,
    fans_over_stalls: values.fans_over_stalls,
    brushes_count: typeof values.brushes_count === "number" ? values.brushes_count : null,
    footbath_present: values.footbath_present,
    parlor_type: values.parlor_type || null,
    parlor_stalls: typeof values.parlor_stalls === "number" ? values.parlor_stalls : null,
    robot_count: typeof values.robot_count === "number" ? values.robot_count : null,
    notes: values.notes || null,
  };
}

export function BarnsTable({
  locationId,
  rows,
  planTotalStalls,
}: {
  locationId: string;
  rows: Barn[];
  planTotalStalls: number;
}) {
  const [editing, setEditing] = useState<Barn | null>(null);
  const [deleting, setDeleting] = useState<Barn | null>(null);

  const totalStalls = rows.reduce(
    (s, r) => s + (r.freestall_count ?? 0),
    0,
  );
  const gauge = planTotalStalls > 0 ? Math.round((totalStalls / planTotalStalls) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      {planTotalStalls > 0 ? (
        <div className="ring-1 ring-foreground/10 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span>
              Stalls {totalStalls} / {planTotalStalls} of plan
            </span>
            <span className="font-mono text-muted-foreground">{gauge}%</span>
          </div>
          <div className="h-1.5 bg-foreground/10 overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, gauge)}%` }}
            />
          </div>
        </div>
      ) : null}
      <div className="flex justify-end">
        <CreateDialog locationId={locationId} />
      </div>
      <div className="ring-1 ring-foreground/10 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Rows</TableHead>
              <TableHead className="text-right">Freestalls</TableHead>
              <TableHead className="text-right">Headlocks</TableHead>
              <TableHead>Vent</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  No barns yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{BarnTypeView[b.type] ?? b.type}</TableCell>
                  <TableCell>
                    {b.row_configuration
                      ? RowConfigView[b.row_configuration]
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {b.freestall_count ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {b.headlock_count ?? "—"}
                  </TableCell>
                  <TableCell className="capitalize">
                    {b.ventilation_type ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(b)}
                      >
                        <HugeiconsIcon icon={PencilEdit02Icon} />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleting(b)}
                      >
                        <HugeiconsIcon icon={Delete02Icon} />
                        Delete
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

function BarnFormBody({ form }: { form: ReturnType<typeof useForm<FormValues>> }) {
  const showParlor = form.watch("type") === "parlor" || form.watch("type") === "robotic";
  return (
    <div className="flex flex-col gap-4">
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
          name="barn_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Barn code (optional)</FormLabel>
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
              <FormLabel>Type</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BarnTypes.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
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
          name="row_configuration"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Row configuration</FormLabel>
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
                      <span className="italic text-muted-foreground">Not applicable</span>
                    </SelectItem>
                    {RowConfigurations.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
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

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t pt-3">
        {numericFields([
          ["freestall_count", "Freestalls"],
          ["headlock_count", "Headlocks"],
          ["loafing_area_sqft", "Loafing (sq ft)"],
          ["holding_pen_capacity", "Holding pen cap"],
        ], form)}
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3 border-t pt-3">
        <FormField
          control={form.control}
          name="stall_surface"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Stall surface</FormLabel>
              <FormControl>
                <Input placeholder="sand / mattress / pack" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bedding_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Bedding type</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {numericFields([
          ["stall_length_ft", "Stall length (ft)"],
          ["stall_width_in", "Stall width (in)"],
          ["neck_rail_height_in", "Neck rail (in)"],
        ], form)}
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t pt-3">
        <FormField
          control={form.control}
          name="bunk_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Bunk type</FormLabel>
              <FormControl>
                <Input placeholder="drive-thru / feed-alley / fenceline" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {numericFields([["bunk_total_linear_ft", "Bunk total (ft)"]], form)}
        <FormField
          control={form.control}
          name="floor_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Floor</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="manure_handling"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Manure</FormLabel>
              <FormControl>
                <Input placeholder="scrape / flush / vacuum" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2 border-t pt-3">
        <FormField
          control={form.control}
          name="ventilation_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Ventilation</FormLabel>
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
                      <span className="italic text-muted-foreground">—</span>
                    </SelectItem>
                    {VentilationTypes.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-3">
          {numericFields([
            ["fan_count", "Fans"],
            ["fan_diameter_in", "Fan ⌀ (in)"],
          ], form)}
        </div>
        <SwitchRow
          control={form.control}
          name="soaker_lines_present"
          label="Soaker lines present"
        />
        {numericFields([["soaker_nozzle_height_in", "Soaker nozzle (in)"]], form)}
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t pt-3">
        <SwitchRow control={form.control} name="sprinklers" label="Sprinklers" />
        <SwitchRow
          control={form.control}
          name="fans_over_stalls"
          label="Fans over stalls"
        />
        {numericFields([["brushes_count", "Brushes"]], form)}
        <SwitchRow control={form.control} name="footbath_present" label="Footbath" />
      </fieldset>

      {showParlor ? (
        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-3 border-t pt-3">
          <FormField
            control={form.control}
            name="parlor_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Parlor type</FormLabel>
                <FormControl>
                  <Select
                    value={field.value || "__none"}
                    onValueChange={(v) =>
                      field.onChange(v === "__none" ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">
                        <span className="italic text-muted-foreground">—</span>
                      </SelectItem>
                      {ParlorTypes.map((p) => (
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
          {numericFields([
            ["parlor_stalls", "Parlor stalls"],
            ["robot_count", "Robots"],
          ], form)}
        </fieldset>
      ) : null}

      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem className="border-t pt-3">
            <FormLabel className="text-xs">Notes</FormLabel>
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

function numericFields(
  fields: [keyof FormValues, string][],
  form: ReturnType<typeof useForm<FormValues>>,
) {
  return fields.map(([name, label]) => (
    <FormField
      key={name as string}
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={
                field.value === null || field.value === undefined
                  ? ""
                  : (field.value as number | string)
              }
              onChange={(e) =>
                field.onChange(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  ));
}

function SwitchRow({
  control,
  name,
  label,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  name: keyof FormValues;
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between gap-2 ring-1 ring-foreground/10 p-2">
          <FormLabel className="text-xs font-normal">{label}</FormLabel>
          <FormControl>
            <Switch checked={!!field.value} onCheckedChange={field.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

function CreateDialog({ locationId }: { locationId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyValues,
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await createBarn(toSubmit(locationId, values));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Barn created.");
      form.reset(emptyValues);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <HugeiconsIcon icon={PlusSignIcon} />
          New Barn
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Barn</DialogTitle>
          <DialogDescription>Physical structure that houses animals.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <BarnFormBody form={form} />
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
  row: Barn | null;
  locationId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: row
      ? ({
          ...emptyValues,
          name: row.name,
          barn_code: row.barn_code ?? "",
          type: row.type as FormValues["type"],
          row_configuration: row.row_configuration ?? "",
          freestall_count: row.freestall_count ?? ("" as unknown as number),
          headlock_count: row.headlock_count ?? ("" as unknown as number),
          loafing_area_sqft: row.loafing_area_sqft ?? ("" as unknown as number),
          holding_pen_capacity:
            row.holding_pen_capacity ?? ("" as unknown as number),
          stall_surface: row.stall_surface ?? "",
          bedding_type: row.bedding_type ?? "",
          stall_length_ft: row.stall_length_ft ?? ("" as unknown as number),
          stall_width_in: row.stall_width_in ?? ("" as unknown as number),
          neck_rail_height_in:
            row.neck_rail_height_in ?? ("" as unknown as number),
          bunk_type: row.bunk_type ?? "",
          bunk_total_linear_ft:
            row.bunk_total_linear_ft ?? ("" as unknown as number),
          floor_type: row.floor_type ?? "",
          manure_handling: row.manure_handling ?? "",
          ventilation_type: row.ventilation_type ?? "",
          fan_count: row.fan_count ?? ("" as unknown as number),
          fan_diameter_in: row.fan_diameter_in ?? ("" as unknown as number),
          soaker_lines_present: row.soaker_lines_present,
          soaker_nozzle_height_in:
            row.soaker_nozzle_height_in ?? ("" as unknown as number),
          sprinklers: row.sprinklers,
          fans_over_stalls: row.fans_over_stalls,
          brushes_count: row.brushes_count ?? ("" as unknown as number),
          footbath_present: row.footbath_present,
          parlor_type: row.parlor_type ?? "",
          parlor_stalls: row.parlor_stalls ?? ("" as unknown as number),
          robot_count: row.robot_count ?? ("" as unknown as number),
          notes: row.notes ?? "",
        } as FormValues)
      : emptyValues,
  });
  if (!row) return null;

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await updateBarn({ id: row.id, ...toSubmit(locationId, values) });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Barn updated.");
      onClose();
    });
  };

  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Barn</DialogTitle>
          <DialogDescription>{row.name}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <BarnFormBody form={form} />
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
  row: Barn | null;
  locationId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  if (!row) return null;
  const onConfirm = () => {
    startTransition(async () => {
      const result = await deleteBarn({ id: row.id, location_id: locationId });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Barn deleted.");
      onClose();
    });
  };
  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Barn</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{row.name}</strong>. Pens
            inside this barn will be deleted too.
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
