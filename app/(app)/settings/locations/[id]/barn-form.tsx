"use client";

import type { Control, FieldPath } from "react-hook-form";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  BarnTypes,
  ParlorTypes,
  RowConfigurations,
  VentilationTypes,
  type Barn,
} from "@/lib/barns";

// ---------------------------------------------------------------------
// Shared schema + form body used by both Settings → Infrastructure and
// /pen-moves so users get the full barn questionnaire (structure +
// facilities) wherever they declare a barn from.
// ---------------------------------------------------------------------

const numOrEmpty = z.union([z.number(), z.literal("")]);

export const barnFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  barn_code: z.string().trim(),
  type: z.enum(BarnTypes.map((b) => b.value) as [string, ...string[]]),
  row_configuration: z.string(),
  length_ft: numOrEmpty,
  width_ft: numOrEmpty,
  layout: z.enum(["single_side", "double_side", "free"]),
  alley_width_ft: numOrEmpty,
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

export type BarnFormValues = z.infer<typeof barnFormSchema>;

export const emptyBarnValues: BarnFormValues = {
  name: "",
  barn_code: "",
  type: "freestall",
  row_configuration: "",
  length_ft: "" as unknown as number,
  width_ft: "" as unknown as number,
  layout: "double_side",
  alley_width_ft: "" as unknown as number,
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

export function barnRowToFormValues(row: Barn): BarnFormValues {
  return {
    ...emptyBarnValues,
    name: row.name,
    barn_code: row.barn_code ?? "",
    type: row.type as BarnFormValues["type"],
    row_configuration: row.row_configuration ?? "",
    length_ft: row.length_ft ?? ("" as unknown as number),
    width_ft: row.width_ft ?? ("" as unknown as number),
    layout: (row.layout as BarnFormValues["layout"]) ?? "double_side",
    alley_width_ft: row.alley_width_ft ?? ("" as unknown as number),
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
  };
}

export function barnFormValuesToSubmit(
  locationId: string,
  values: BarnFormValues,
) {
  const numOrNull = (v: BarnFormValues[keyof BarnFormValues]) =>
    typeof v === "number" ? v : null;
  return {
    location_id: locationId,
    name: values.name,
    barn_code: values.barn_code || null,
    type: values.type,
    row_configuration: values.row_configuration || null,
    length_ft: numOrNull(values.length_ft),
    width_ft: numOrNull(values.width_ft),
    layout: values.layout,
    alley_width_ft: numOrNull(values.alley_width_ft),
    freestall_count: numOrNull(values.freestall_count),
    headlock_count: numOrNull(values.headlock_count),
    loafing_area_sqft: numOrNull(values.loafing_area_sqft),
    holding_pen_capacity: numOrNull(values.holding_pen_capacity),
    stall_surface: values.stall_surface || null,
    bedding_type: values.bedding_type || null,
    stall_length_ft: numOrNull(values.stall_length_ft),
    stall_width_in: numOrNull(values.stall_width_in),
    neck_rail_height_in: numOrNull(values.neck_rail_height_in),
    bunk_type: values.bunk_type || null,
    bunk_total_linear_ft: numOrNull(values.bunk_total_linear_ft),
    floor_type: values.floor_type || null,
    manure_handling: values.manure_handling || null,
    ventilation_type: values.ventilation_type || null,
    fan_count: numOrNull(values.fan_count),
    fan_diameter_in: numOrNull(values.fan_diameter_in),
    soaker_lines_present: values.soaker_lines_present,
    soaker_nozzle_height_in: numOrNull(values.soaker_nozzle_height_in),
    sprinklers: values.sprinklers,
    fans_over_stalls: values.fans_over_stalls,
    brushes_count: numOrNull(values.brushes_count),
    footbath_present: values.footbath_present,
    parlor_type: values.parlor_type || null,
    parlor_stalls: numOrNull(values.parlor_stalls),
    robot_count: numOrNull(values.robot_count),
    notes: values.notes || null,
  };
}

export function BarnFormBody({
  form,
}: {
  form: ReturnType<typeof useForm<BarnFormValues>>;
}) {
  const showParlor =
    form.watch("type") === "parlor" || form.watch("type") === "robotic";
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
          name="length_ft"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Length (ft, long axis)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={
                    field.value === "" || field.value === undefined
                      ? ""
                      : (field.value as number)
                  }
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
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
              <FormLabel>Width (ft, short axis)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={
                    field.value === "" || field.value === undefined
                      ? ""
                      : (field.value as number)
                  }
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="layout"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Layout</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_side">
                      Single-side (pens on one side of feed alley)
                    </SelectItem>
                    <SelectItem value="double_side">
                      Double-side (pens on both sides of central feed alley)
                    </SelectItem>
                    <SelectItem value="free">Free (custom)</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="alley_width_ft"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Feed alley width (ft)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 14"
                  value={
                    field.value === "" || field.value === undefined
                      ? ""
                      : (field.value as number)
                  }
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                />
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
                  onValueChange={(v) =>
                    field.onChange(v === "__none" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">
                      <span className="italic text-muted-foreground">
                        Not applicable
                      </span>
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
        {numericFields(
          [
            ["freestall_count", "Freestalls"],
            ["headlock_count", "Headlocks"],
            ["loafing_area_sqft", "Loafing (sq ft)"],
            ["holding_pen_capacity", "Holding pen cap"],
          ],
          form,
        )}
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
        {numericFields(
          [
            ["stall_length_ft", "Stall length (ft)"],
            ["stall_width_in", "Stall width (in)"],
            ["neck_rail_height_in", "Neck rail (in)"],
          ],
          form,
        )}
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t pt-3">
        <FormField
          control={form.control}
          name="bunk_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Bunk type</FormLabel>
              <FormControl>
                <Input
                  placeholder="drive-thru / feed-alley / fenceline"
                  {...field}
                />
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
          {numericFields(
            [
              ["fan_count", "Fans"],
              ["fan_diameter_in", "Fan ⌀ (in)"],
            ],
            form,
          )}
        </div>
        <SwitchRow
          control={form.control}
          name="soaker_lines_present"
          label="Soaker lines present"
        />
        {numericFields(
          [["soaker_nozzle_height_in", "Soaker nozzle (in)"]],
          form,
        )}
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t pt-3">
        <SwitchRow
          control={form.control}
          name="sprinklers"
          label="Sprinklers"
        />
        <SwitchRow
          control={form.control}
          name="fans_over_stalls"
          label="Fans over stalls"
        />
        {numericFields([["brushes_count", "Brushes"]], form)}
        <SwitchRow
          control={form.control}
          name="footbath_present"
          label="Footbath"
        />
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
          {numericFields(
            [
              ["parlor_stalls", "Parlor stalls"],
              ["robot_count", "Robots"],
            ],
            form,
          )}
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
  fields: [FieldPath<BarnFormValues>, string][],
  form: ReturnType<typeof useForm<BarnFormValues>>,
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
                field.onChange(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
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
  control: Control<BarnFormValues>;
  name: FieldPath<BarnFormValues>;
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
            <Switch
              checked={!!field.value}
              onCheckedChange={field.onChange}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
