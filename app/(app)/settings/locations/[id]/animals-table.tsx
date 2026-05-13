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
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
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
  createAnimal,
  deleteAnimal,
  updateAnimal,
  type AnimalRow,
} from "./animals-actions";

type PenLite = { id: string; name: string };
type GroupLite = { id: string; label: string };
type BreedLite = { code: string; name: string };

const sexOptions = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "freemartin", label: "Freemartin" },
  { value: "castrated", label: "Castrated" },
] as const;

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "sold", label: "Sold" },
  { value: "dead", label: "Dead" },
  { value: "culled", label: "Culled" },
  { value: "reference", label: "Reference only" },
] as const;

const originOptions = [
  { value: "born_on_farm", label: "Born on farm" },
  { value: "purchased", label: "Purchased" },
  { value: "imported", label: "Imported" },
  { value: "leased", label: "Leased" },
  { value: "other", label: "Other" },
] as const;

const formSchema = z.object({
  animal_id: z.string().trim().min(1, "Animal ID required."),
  name: z.string(),
  official_id: z.string(),
  registration_number: z.string(),
  breed_code: z.string(),
  sex: z.enum(sexOptions.map((s) => s.value) as [string, ...string[]]),
  birth_date: z.string().min(10),
  entry_date: z.string().min(10),
  origin: z.enum(originOptions.map((o) => o.value) as [string, ...string[]]),
  source_farm: z.string(),
  status: z.enum(statusOptions.map((s) => s.value) as [string, ...string[]]),
  status_date: z.string(),
  current_pen_id: z.string(),
  current_group_id: z.string(),
  current_lactation: z.union([z.number(), z.literal("")]),
  last_calving_date: z.string(),
  sire_naab: z.string(),
  sire_name: z.string(),
  dam_tag_external: z.string(),
  notes: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

const today = () => new Date().toISOString().slice(0, 10);

const empty: FormValues = {
  animal_id: "",
  name: "",
  official_id: "",
  registration_number: "",
  breed_code: "",
  sex: "female",
  birth_date: today(),
  entry_date: today(),
  origin: "born_on_farm",
  source_farm: "",
  status: "active",
  status_date: "",
  current_pen_id: "",
  current_group_id: "",
  current_lactation: "" as unknown as number,
  last_calving_date: "",
  sire_naab: "",
  sire_name: "",
  dam_tag_external: "",
  notes: "",
};

function toSubmit(locationId: string, values: FormValues) {
  return {
    location_id: locationId,
    animal_id: values.animal_id,
    name: values.name || null,
    official_id: values.official_id || null,
    registration_number: values.registration_number || null,
    breed_code: values.breed_code || null,
    sex: values.sex as "female" | "male" | "freemartin" | "castrated",
    birth_date: values.birth_date,
    entry_date: values.entry_date,
    origin: values.origin as
      | "born_on_farm"
      | "purchased"
      | "imported"
      | "leased"
      | "other",
    source_farm: values.source_farm || null,
    status: values.status as
      | "active"
      | "sold"
      | "dead"
      | "culled"
      | "reference",
    status_date: values.status_date || null,
    current_pen_id: values.current_pen_id || null,
    current_group_id: values.current_group_id || null,
    current_lactation:
      typeof values.current_lactation === "number"
        ? values.current_lactation
        : null,
    last_calving_date: values.last_calving_date || null,
    sire_naab: values.sire_naab || null,
    sire_name: values.sire_name || null,
    dam_tag_external: values.dam_tag_external || null,
    notes: values.notes || null,
  };
}

export function AnimalsTable({
  locationId,
  rows,
  pens,
  groups,
  breeds,
  statusFilter,
  totalsByStatus,
}: {
  locationId: string;
  rows: AnimalRow[];
  pens: PenLite[];
  groups: GroupLite[];
  breeds: BreedLite[];
  statusFilter: string | null;
  totalsByStatus: Record<string, number>;
}) {
  const [editing, setEditing] = useState<AnimalRow | null>(null);
  const [deleting, setDeleting] = useState<AnimalRow | null>(null);
  const router = useRouter();

  const penLabel = (id: string | null) =>
    pens.find((p) => p.id === id)?.name ?? "—";
  const groupLabel = (id: string | null) =>
    groups.find((g) => g.id === id)?.label ?? "—";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <StatusFilter
          current={statusFilter}
          totals={totalsByStatus}
          onChange={(s) => {
            const url = new URL(window.location.href);
            if (s) url.searchParams.set("status", s);
            else url.searchParams.delete("status");
            router.push(url.pathname + (url.search ? url.search : ""));
          }}
        />
        <CreateDialog
          locationId={locationId}
          pens={pens}
          groups={groups}
          breeds={breeds}
        />
      </div>
      <div className="ring-1 ring-foreground/10 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Breed</TableHead>
              <TableHead>Sex</TableHead>
              <TableHead>Birth</TableHead>
              <TableHead>Lact #</TableHead>
              <TableHead>Last fresh</TableHead>
              <TableHead>Pen</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground">
                  No animals yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    <Link
                      href={`/settings/locations/${locationId}/animals/${a.id}`}
                      className="hover:underline"
                    >
                      {a.animal_id}
                    </Link>
                  </TableCell>
                  <TableCell>{a.name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {a.breed_code ?? "—"}
                  </TableCell>
                  <TableCell className="capitalize text-xs">{a.sex}</TableCell>
                  <TableCell className="text-xs">{a.birth_date}</TableCell>
                  <TableCell className="text-right">
                    {a.current_lactation ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {a.last_calving_date ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {penLabel(a.current_pen_id)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {groupLabel(a.current_group_id)}
                  </TableCell>
                  <TableCell className="capitalize text-xs">{a.status}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <Link
                          href={`/settings/locations/${locationId}/animals/${a.id}`}
                        >
                          <HugeiconsIcon icon={ArrowRight01Icon} />
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(a)}
                      >
                        <HugeiconsIcon icon={PencilEdit02Icon} />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleting(a)}
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

      <EditDialog
        row={editing}
        locationId={locationId}
        pens={pens}
        groups={groups}
        breeds={breeds}
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

function StatusFilter({
  current,
  totals,
  onChange,
}: {
  current: string | null;
  totals: Record<string, number>;
  onChange: (s: string | null) => void;
}) {
  const options: { value: string | null; label: string }[] = [
    { value: null, label: `All (${Object.values(totals).reduce((a, b) => a + b, 0)})` },
    ...statusOptions.map((s) => ({
      value: s.value,
      label: `${s.label} (${totals[s.value] ?? 0})`,
    })),
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const active = (o.value ?? null) === current;
        return (
          <button
            key={o.value ?? "__all"}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-2.5 py-1 text-xs ring-1 ${
              active
                ? "bg-primary/10 ring-primary/30 text-primary"
                : "ring-foreground/10 hover:ring-foreground/20"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function AnimalFormBody({
  form,
  pens,
  groups,
  breeds,
}: {
  form: ReturnType<typeof useForm<FormValues>>;
  pens: PenLite[];
  groups: GroupLite[];
  breeds: BreedLite[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="animal_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Animal ID</FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="breed_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Breed</FormLabel>
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
                    {breeds.map((b) => (
                      <SelectItem key={b.code} value={b.code}>
                        {b.code} — {b.name}
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
          name="sex"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sex</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sexOptions.map((s) => (
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
          name="birth_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Birth date</FormLabel>
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
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3 border-t pt-3">
        <FormField
          control={form.control}
          name="official_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Official ID (840/ISO)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="registration_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reg #</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="origin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Origin</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {originOptions.map((o) => (
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
        <FormField
          control={form.control}
          name="source_farm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Source farm</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="entry_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Entry date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t pt-3">
        <FormField
          control={form.control}
          name="current_pen_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pen</FormLabel>
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
                    {pens.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
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
          name="current_group_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Group</FormLabel>
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
        <FormField
          control={form.control}
          name="current_lactation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current lactation</FormLabel>
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
          name="last_calving_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last calving date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3 border-t pt-3">
        <FormField
          control={form.control}
          name="sire_naab"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sire NAAB</FormLabel>
              <FormControl>
                <Input placeholder="014HO07419" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sire_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sire name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dam_tag_external"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dam tag (external)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </fieldset>

      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem className="border-t pt-3">
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
  pens,
  groups,
  breeds,
}: {
  locationId: string;
  pens: PenLite[];
  groups: GroupLite[];
  breeds: BreedLite[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: empty,
  });
  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await createAnimal(toSubmit(locationId, values));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Animal created.");
      form.reset(empty);
      setOpen(false);
      router.refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <HugeiconsIcon icon={PlusSignIcon} />
          New animal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create animal</DialogTitle>
          <DialogDescription>
            Identity + current state. Time-bound events (lactations, repro,
            health, etc) are added on the animal&apos;s detail page.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <AnimalFormBody form={form} pens={pens} groups={groups} breeds={breeds} />
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
  pens,
  groups,
  breeds,
  onClose,
}: {
  row: AnimalRow | null;
  locationId: string;
  pens: PenLite[];
  groups: GroupLite[];
  breeds: BreedLite[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: row
      ? ({
          ...empty,
          animal_id: row.animal_id,
          name: row.name ?? "",
          official_id: row.official_id ?? "",
          registration_number: row.registration_number ?? "",
          breed_code: row.breed_code ?? "",
          sex: row.sex as FormValues["sex"],
          birth_date: row.birth_date,
          entry_date: row.entry_date,
          origin: row.origin as FormValues["origin"],
          source_farm: row.source_farm ?? "",
          status: row.status as FormValues["status"],
          status_date: row.status_date ?? "",
          current_pen_id: row.current_pen_id ?? "",
          current_group_id: row.current_group_id ?? "",
          current_lactation: row.current_lactation ?? ("" as unknown as number),
          last_calving_date: row.last_calving_date ?? "",
          sire_naab: row.sire_naab ?? "",
          sire_name: row.sire_name ?? "",
          dam_tag_external: row.dam_tag_external ?? "",
          notes: row.notes ?? "",
        } as FormValues)
      : empty,
  });
  if (!row) return null;
  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await updateAnimal({ id: row.id, ...toSubmit(locationId, values) });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Animal updated.");
      onClose();
      router.refresh();
    });
  };
  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit animal</DialogTitle>
          <DialogDescription>
            {row.animal_id}
            {row.name ? ` — ${row.name}` : ""}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <AnimalFormBody form={form} pens={pens} groups={groups} breeds={breeds} />
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
  row: AnimalRow | null;
  locationId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  if (!row) return null;
  const onConfirm = () => {
    startTransition(async () => {
      const result = await deleteAnimal({ id: row.id, location_id: locationId });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Animal deleted.");
      onClose();
      router.refresh();
    });
  };
  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete animal</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{row.animal_id}</strong> and
            cascade-delete all of her events (lactations, milkings, repro,
            health, etc).
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
