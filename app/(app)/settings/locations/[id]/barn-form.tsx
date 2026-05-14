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
  BeddingTypes,
  BunkTypes,
  DrinkerTypes,
  FloorTypes,
  ManureHandlingTypes,
  ParlorTypes,
  RowConfigurations,
  StallSurfaces,
  VentilationTypes,
  type Barn,
} from "@/lib/barns";

// ---------------------------------------------------------------------
// Shared schema + form body used by both Settings → Infrastructure and
// /pen-moves. Categorical fields are strict dropdowns so two people
// describing the same barn don't end up with "rubber" vs "rubber mat"
// vs "rubber matting".
// ---------------------------------------------------------------------

const numOrEmpty = z.union([z.number(), z.literal("")]);

export const barnFormSchema = z.object({
  // Identity
  name: z.string().trim().min(1, "Name is required."),
  barn_code: z.string().trim(),
  type: z.enum(BarnTypes.map((b) => b.value) as [string, ...string[]]),
  row_configuration: z.string(),
  notes: z.string(),

  // Geometry & layout
  length_ft: numOrEmpty,
  width_ft: numOrEmpty,
  layout: z.enum(["single_side", "double_side", "free"]),
  alley_width_ft: numOrEmpty,

  // Stalls
  freestall_count: numOrEmpty,
  headlock_count: numOrEmpty,
  loafing_area_sqft: numOrEmpty,
  holding_pen_capacity: numOrEmpty,
  stall_surface: z.string(),
  bedding_type: z.string(),
  stall_length_ft: numOrEmpty,
  stall_width_in: numOrEmpty,
  neck_rail_height_in: numOrEmpty,

  // Feeding
  bunk_type: z.string(),
  bunk_total_linear_ft: numOrEmpty,

  // Water
  drinker_count: numOrEmpty,
  drinker_type: z.string(),
  drinker_linear_ft: numOrEmpty,

  // Floor & manure
  floor_type: z.string(),
  manure_handling: z.string(),

  // Ventilation & cooling
  ventilation_type: z.string(),
  fan_count: numOrEmpty,
  fan_diameter_in: numOrEmpty,
  soaker_lines_present: z.boolean(),
  soaker_nozzle_height_in: numOrEmpty,
  sprinklers: z.boolean(),
  fans_over_stalls: z.boolean(),

  // Cow comfort
  brushes_count: numOrEmpty,
  footbath_present: z.boolean(),

  // Parlor / robotic only
  parlor_type: z.string(),
  parlor_stalls: numOrEmpty,
  robot_count: numOrEmpty,
});

export type BarnFormValues = z.infer<typeof barnFormSchema>;

export const emptyBarnValues: BarnFormValues = {
  name: "",
  barn_code: "",
  type: "freestall",
  row_configuration: "",
  notes: "",
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
  drinker_count: "" as unknown as number,
  drinker_type: "",
  drinker_linear_ft: "" as unknown as number,
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
};

export function barnRowToFormValues(row: Barn): BarnFormValues {
  return {
    ...emptyBarnValues,
    name: row.name,
    barn_code: row.barn_code ?? "",
    type: row.type as BarnFormValues["type"],
    row_configuration: row.row_configuration ?? "",
    notes: row.notes ?? "",
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
    drinker_count: row.drinker_count ?? ("" as unknown as number),
    drinker_type: row.drinker_type ?? "",
    drinker_linear_ft: row.drinker_linear_ft ?? ("" as unknown as number),
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
    notes: values.notes || null,
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
    drinker_count: numOrNull(values.drinker_count),
    drinker_type: values.drinker_type || null,
    drinker_linear_ft: numOrNull(values.drinker_linear_ft),
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
  };
}

// ---------------------------------------------------------------------
// Form body — grouped into clear sections.
// ---------------------------------------------------------------------

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3 border-t pt-3">
      <legend className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        {hint ? (
          <span className="text-[11px] text-muted-foreground">{hint}</span>
        ) : null}
      </legend>
      {children}
    </fieldset>
  );
}

export function BarnFormBody({
  form,
}: {
  form: ReturnType<typeof useForm<BarnFormValues>>;
}) {
  const barnType = form.watch("type");
  const showParlor = barnType === "parlor" || barnType === "robotic";

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Identity"
        hint="What this structure is and how to recognise it on reports."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Barn name</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    placeholder="e.g. Main lactating barn"
                    {...field}
                  />
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
                <FormLabel>Short code (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. B1" {...field} />
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
                <FormLabel>What kind of barn is this?</FormLabel>
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
          <DropdownField
            control={form.control}
            name="row_configuration"
            label="Row configuration"
            placeholder="Not applicable"
            options={RowConfigurations}
          />
        </div>
      </Section>

      <Section
        title="Dimensions & layout"
        hint="Drives the top-down sketch and sizes the pens inside."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumericField
            control={form.control}
            name="length_ft"
            label="Length (ft, long axis)"
          />
          <NumericField
            control={form.control}
            name="width_ft"
            label="Width (ft, short axis)"
          />
          <FormField
            control={form.control}
            name="layout"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pen layout</FormLabel>
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
                        Double-side (pens both sides of central alley)
                      </SelectItem>
                      <SelectItem value="free">Free / custom</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <NumericField
            control={form.control}
            name="alley_width_ft"
            label="Feed-alley width (ft)"
            placeholder="e.g. 14"
          />
        </div>
      </Section>

      <Section
        title="Stalls & resting space"
        hint="Where cows lie down. Drives comfort + capacity audits."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumericField
            control={form.control}
            name="freestall_count"
            label="Freestalls (count)"
          />
          <NumericField
            control={form.control}
            name="headlock_count"
            label="Headlocks (count)"
          />
          <NumericField
            control={form.control}
            name="loafing_area_sqft"
            label="Loafing area (sq ft)"
          />
          <NumericField
            control={form.control}
            name="holding_pen_capacity"
            label="Holding-pen capacity (head)"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <DropdownField
            control={form.control}
            name="stall_surface"
            label="Stall surface"
            options={StallSurfaces}
          />
          <DropdownField
            control={form.control}
            name="bedding_type"
            label="Bedding material"
            options={BeddingTypes}
          />
          <NumericField
            control={form.control}
            name="stall_length_ft"
            label="Stall length (ft)"
          />
          <NumericField
            control={form.control}
            name="stall_width_in"
            label="Stall width (in)"
          />
          <NumericField
            control={form.control}
            name="neck_rail_height_in"
            label="Neck-rail height (in)"
          />
        </div>
      </Section>

      <Section
        title="Feeding"
        hint="The bunk. Cows that can't all eat at once milk less."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <DropdownField
            control={form.control}
            name="bunk_type"
            label="Bunk style"
            options={BunkTypes}
          />
          <NumericField
            control={form.control}
            name="bunk_total_linear_ft"
            label="Total bunk length (ft)"
          />
        </div>
      </Section>

      <Section
        title="Water"
        hint="Drinkers — under-watering is the most-missed cause of intake drops."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumericField
            control={form.control}
            name="drinker_count"
            label="Drinkers (count)"
          />
          <DropdownField
            control={form.control}
            name="drinker_type"
            label="Drinker style"
            options={DrinkerTypes}
          />
          <NumericField
            control={form.control}
            name="drinker_linear_ft"
            label="Total trough access (ft)"
          />
        </div>
      </Section>

      <Section
        title="Floor & manure"
        hint="What cows walk on and how the barn stays clean."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DropdownField
            control={form.control}
            name="floor_type"
            label="Floor surface"
            options={FloorTypes}
          />
          <DropdownField
            control={form.control}
            name="manure_handling"
            label="Manure removal method"
            options={ManureHandlingTypes}
          />
        </div>
      </Section>

      <Section
        title="Ventilation & cooling"
        hint="Heat-abatement gear — temperature-humidity stress hits yields above 22°C."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DropdownField
            control={form.control}
            name="ventilation_type"
            label="Ventilation type"
            options={VentilationTypes}
          />
          <NumericField
            control={form.control}
            name="fan_count"
            label="Fans (count)"
          />
          <NumericField
            control={form.control}
            name="fan_diameter_in"
            label="Fan diameter (in)"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SwitchRow
            control={form.control}
            name="soaker_lines_present"
            label="Soaker lines installed"
          />
          <NumericField
            control={form.control}
            name="soaker_nozzle_height_in"
            label="Soaker nozzle height (in)"
          />
          <SwitchRow
            control={form.control}
            name="sprinklers"
            label="Sprinklers in holding pen"
          />
          <SwitchRow
            control={form.control}
            name="fans_over_stalls"
            label="Fans positioned over stalls"
          />
        </div>
      </Section>

      <Section
        title="Cow comfort"
        hint="Optional fixtures that show up in welfare audits."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumericField
            control={form.control}
            name="brushes_count"
            label="Mechanical cow brushes (count)"
          />
          <SwitchRow
            control={form.control}
            name="footbath_present"
            label="Footbath at exit"
          />
        </div>
      </Section>

      {showParlor ? (
        <Section
          title="Parlor / robotic milking"
          hint="Only relevant for parlor and robotic barns."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <DropdownField
              control={form.control}
              name="parlor_type"
              label="Parlor type"
              options={ParlorTypes}
            />
            <NumericField
              control={form.control}
              name="parlor_stalls"
              label="Parlor stalls (count)"
            />
            <NumericField
              control={form.control}
              name="robot_count"
              label="Milking robots (count)"
            />
          </div>
        </Section>
      ) : null}

      <Section title="Notes" hint="Anything else worth recording.">
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea rows={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------
// Reusable field renderers.
// ---------------------------------------------------------------------

function NumericField({
  control,
  name,
  label,
  placeholder,
}: {
  control: Control<BarnFormValues>;
  name: FieldPath<BarnFormValues>;
  label: string;
  placeholder?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder={placeholder}
              value={
                field.value === null ||
                field.value === undefined ||
                field.value === ""
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
  );
}

function DropdownField({
  control,
  name,
  label,
  placeholder = "—",
  options,
}: {
  control: Control<BarnFormValues>;
  name: FieldPath<BarnFormValues>;
  label: string;
  placeholder?: string;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Select
              value={(field.value as string) || "__none"}
              onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">
                  <span className="italic text-muted-foreground">
                    {placeholder}
                  </span>
                </SelectItem>
                {options.map((o) => (
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
  );
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
