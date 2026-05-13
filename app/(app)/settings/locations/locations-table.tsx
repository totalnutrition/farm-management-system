"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  PencilEdit02Icon,
  Delete02Icon,
  ArrowRight01Icon,
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
  FormDescription,
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
  FarmTypeDairy,
  FarmTypeOther,
  FarmTypePoultry,
  FarmTypeSheepGoat,
  FarmTypeView,
  FarmTypes,
  LocationStatusActive,
  LocationStatusArchived,
  pathLocationSetup,
} from "@/lib/misc";
import { CommonTimezones } from "@/lib/timezones";
import {
  createLocation,
  deleteLocation,
  updateLocation,
} from "./actions";

export type LocationRow = {
  id: string;
  organization_id: string;
  name: string;
  short_code: string;
  farm_type: string;
  country: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  manages_livestock: boolean;
  manages_crops: boolean;
  livestock_area_hectares: number | null;
  arable_area_hectares: number | null;
  timezone: string | null;
};

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required."),
    short_code: z
      .string()
      .trim()
      .min(2, "Short code must be at least 2 characters.")
      .max(8, "Short code must be at most 8 characters."),
    farm_type: z.enum([
      FarmTypeDairy,
      FarmTypeSheepGoat,
      FarmTypePoultry,
      FarmTypeOther,
    ]),
    country: z.string().trim(),
    province: z.string().trim(),
    city: z.string().trim(),
    address: z.string().trim(),
    latitude: z.string().trim(),
    longitude: z.string().trim(),
    status: z.enum([LocationStatusActive, LocationStatusArchived]),
    manages_livestock: z.boolean(),
    manages_crops: z.boolean(),
    livestock_area_hectares: z.string().trim(),
    arable_area_hectares: z.string().trim(),
    timezone: z.string().trim(),
  })
  .refine((v) => v.manages_livestock || v.manages_crops, {
    path: ["manages_livestock"],
    message: "Enable at least one module.",
  });
type FormValues = z.infer<typeof formSchema>;

const emptyValues: FormValues = {
  name: "",
  short_code: "",
  farm_type: FarmTypeDairy,
  country: "",
  province: "",
  city: "",
  address: "",
  latitude: "",
  longitude: "",
  status: LocationStatusActive,
  manages_livestock: true,
  manages_crops: false,
  livestock_area_hectares: "",
  arable_area_hectares: "",
  timezone: "",
};

export function LocationsTable({ rows }: { rows: LocationRow[] }) {
  const [editing, setEditing] = useState<LocationRow | null>(null);
  const [deleting, setDeleting] = useState<LocationRow | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <CreateDialog />
      </div>
      <div className="ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Modules</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground"
                >
                  No locations yet. Create your first one to get started.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.short_code}
                  </TableCell>
                  <TableCell>{FarmTypeView[r.farm_type] ?? r.farm_type}</TableCell>
                  <TableCell className="text-xs">
                    {[
                      r.manages_livestock ? "Livestock" : null,
                      r.manages_crops ? "Crops" : null,
                    ]
                      .filter(Boolean)
                      .join(" + ") || "—"}
                  </TableCell>
                  <TableCell>{r.city ?? "—"}</TableCell>
                  <TableCell>{r.country ?? "—"}</TableCell>
                  <TableCell className="capitalize">{r.status}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <Link href={pathLocationSetup(r.id)}>
                          Open
                          <HugeiconsIcon icon={ArrowRight01Icon} />
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(r)}
                      >
                        <HugeiconsIcon icon={PencilEdit02Icon} />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleting(r)}
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

      <EditDialog row={editing} onClose={() => setEditing(null)} />
      <DeleteDialog row={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function FarmTypeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select farm type" />
      </SelectTrigger>
      <SelectContent>
        {FarmTypes.map((f) => (
          <SelectItem
            key={f.value}
            value={f.value}
            disabled={!f.enabled}
            className={!f.enabled ? "opacity-40" : undefined}
          >
            {f.label}
            {!f.enabled ? " (coming soon)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={LocationStatusActive}>Active</SelectItem>
        <SelectItem value={LocationStatusArchived}>Archived</SelectItem>
      </SelectContent>
    </Select>
  );
}

function TimezoneField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value || "UTC"} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Timezone" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {CommonTimezones.map((t) => (
          <SelectItem key={t.value} value={t.value}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LocationFormBody({
  form,
}: {
  form: ReturnType<typeof useForm<FormValues>>;
}) {
  const manageslivestock = form.watch("manages_livestock");
  const managesCrops = form.watch("manages_crops");

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
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
          name="short_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Short Code</FormLabel>
              <FormControl>
                <Input
                  autoComplete="off"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="farm_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Farm Type</FormLabel>
              <FormControl>
                <FarmTypeField value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="province"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Province / State</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl>
                <Input {...field} />
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
                <StatusField value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Timezone</FormLabel>
              <FormControl>
                <TimezoneField value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="latitude"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Latitude</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. 31.5204"
                  inputMode="decimal"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="longitude"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Longitude</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. 74.3587"
                  inputMode="decimal"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>

      <section className="flex flex-col gap-3 border-t pt-4">
        <h3 className="text-sm font-medium">Modules &amp; Areas</h3>
        <p className="text-xs text-muted-foreground">
          Which side of the operation this location runs, and how much land
          is dedicated to each.
        </p>

        <FormField
          control={form.control}
          name="manages_livestock"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between gap-3 ring-1 ring-foreground/10 p-3">
              <div className="flex flex-col gap-0.5">
                <FormLabel className="font-normal">
                  Manages livestock
                </FormLabel>
                <FormDescription className="text-xs">
                  Animals, barns, pens, groups, milk recording.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="manages_crops"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between gap-3 ring-1 ring-foreground/10 p-3">
              <div className="flex flex-col gap-0.5">
                <FormLabel className="font-normal">Manages crops</FormLabel>
                <FormDescription className="text-xs">
                  Arable parcels, crop plans, crop events.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {manageslivestock ? (
            <FormField
              control={form.control}
              name="livestock_area_hectares"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Livestock area (ha)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 12.5"
                      inputMode="decimal"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Footprint of barns, offices, loafing yards.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
          {managesCrops ? (
            <FormField
              control={form.control}
              name="arable_area_hectares"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Arable area (ha)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 84.0"
                      inputMode="decimal"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Total area of all crop parcels.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function CreateDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyValues,
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await createLocation(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Location created. Setup wizard ready.");
      form.reset(emptyValues);
      setOpen(false);
      if (result.id) {
        router.push(pathLocationSetup(result.id));
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset(emptyValues);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">
          <HugeiconsIcon icon={PlusSignIcon} />
          New Location
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Location</DialogTitle>
          <DialogDescription>
            Add a farm or site to your organization. You&apos;ll continue
            into the setup wizard after this step.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <LocationFormBody form={form} />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create &amp; continue"}
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
  onClose,
}: {
  row: LocationRow | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: row
      ? {
          name: row.name,
          short_code: row.short_code,
          farm_type: row.farm_type as FormValues["farm_type"],
          country: row.country ?? "",
          province: row.province ?? "",
          city: row.city ?? "",
          address: row.address ?? "",
          latitude: row.latitude?.toString() ?? "",
          longitude: row.longitude?.toString() ?? "",
          status: row.status as FormValues["status"],
          manages_livestock: row.manages_livestock,
          manages_crops: row.manages_crops,
          livestock_area_hectares:
            row.livestock_area_hectares?.toString() ?? "",
          arable_area_hectares: row.arable_area_hectares?.toString() ?? "",
          timezone: row.timezone ?? "",
        }
      : emptyValues,
  });

  if (!row) return null;

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await updateLocation({ id: row.id, ...values });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Location updated.");
      onClose();
    });
  };

  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Location</DialogTitle>
          <DialogDescription>{row.name}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <LocationFormBody form={form} />
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
  row: LocationRow | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  if (!row) return null;

  const onConfirm = () => {
    startTransition(async () => {
      const result = await deleteLocation(row.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Location deleted.");
      onClose();
    });
  };

  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Location</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{row.name}</strong>. This
            cannot be undone.
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
