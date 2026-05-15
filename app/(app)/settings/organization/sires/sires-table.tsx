"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  PencilEdit02Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

import { upsertSire, deleteSire } from "./actions";

export type SireRow = {
  id: string;
  organization_id: string | null;
  naab: string;
  registered_name: string;
  short_name: string | null;
  breed_code: string | null;
  status: "active" | "inactive" | "dead" | "sold";
  country_of_origin: string | null;
  owner_company: string | null;
  ptam_milk_kg: number | null;
  ptam_fat_kg: number | null;
  ptam_protein_kg: number | null;
  ptam_scs: number | null;
  ptam_dpr: number | null;
  ptam_calving_ease_pct: number | null;
  ptam_productive_life: number | null;
  net_merit: number | null;
  photo_url: string | null;
  notes: string | null;
  is_seed: boolean;
  straw_batches?: number;
};

export type BreedOption = { code: string; name: string };

const STATUS_LABELS: Record<SireRow["status"], string> = {
  active: "Active",
  inactive: "Inactive",
  dead: "Dead",
  sold: "Sold",
};

const numOrEmpty = z.union([z.number(), z.literal("")]);
const formSchema = z.object({
  naab: z.string().trim().min(2, "NAAB / stud code required.").max(40),
  registered_name: z
    .string()
    .trim()
    .min(1, "Registered name required.")
    .max(160),
  short_name: z.string().trim().max(80),
  breed_code: z.string(),
  status: z.enum(["active", "inactive", "dead", "sold"]),
  country_of_origin: z.string().trim().max(2),
  owner_company: z.string().trim().max(120),
  photo_url: z.string().trim().max(500),
  notes: z.string().max(1000),
  ptam_milk_kg: numOrEmpty,
  ptam_fat_kg: numOrEmpty,
  ptam_protein_kg: numOrEmpty,
  ptam_scs: numOrEmpty,
  ptam_dpr: numOrEmpty,
  ptam_calving_ease_pct: numOrEmpty,
  ptam_productive_life: numOrEmpty,
  net_merit: numOrEmpty,
});
type FormValues = z.infer<typeof formSchema>;

const empty: FormValues = {
  naab: "",
  registered_name: "",
  short_name: "",
  breed_code: "",
  status: "active",
  country_of_origin: "",
  owner_company: "",
  photo_url: "",
  notes: "",
  ptam_milk_kg: "" as unknown as number,
  ptam_fat_kg: "" as unknown as number,
  ptam_protein_kg: "" as unknown as number,
  ptam_scs: "" as unknown as number,
  ptam_dpr: "" as unknown as number,
  ptam_calving_ease_pct: "" as unknown as number,
  ptam_productive_life: "" as unknown as number,
  net_merit: "" as unknown as number,
};

function rowToForm(r: SireRow): FormValues {
  const n = (v: number | null) => (v === null ? ("" as unknown as number) : v);
  return {
    naab: r.naab,
    registered_name: r.registered_name,
    short_name: r.short_name ?? "",
    breed_code: r.breed_code ?? "",
    status: r.status,
    country_of_origin: r.country_of_origin ?? "",
    owner_company: r.owner_company ?? "",
    photo_url: r.photo_url ?? "",
    notes: r.notes ?? "",
    ptam_milk_kg: n(r.ptam_milk_kg),
    ptam_fat_kg: n(r.ptam_fat_kg),
    ptam_protein_kg: n(r.ptam_protein_kg),
    ptam_scs: n(r.ptam_scs),
    ptam_dpr: n(r.ptam_dpr),
    ptam_calving_ease_pct: n(r.ptam_calving_ease_pct),
    ptam_productive_life: n(r.ptam_productive_life),
    net_merit: n(r.net_merit),
  };
}

function formToInput(v: FormValues, id?: string) {
  const num = (x: FormValues[keyof FormValues]) =>
    typeof x === "number" ? x : null;
  return {
    id,
    naab: v.naab,
    registered_name: v.registered_name,
    short_name: v.short_name || null,
    breed_code: v.breed_code || null,
    status: v.status,
    country_of_origin: v.country_of_origin || null,
    owner_company: v.owner_company || null,
    photo_url: v.photo_url || null,
    notes: v.notes || null,
    ptam_milk_kg: num(v.ptam_milk_kg),
    ptam_fat_kg: num(v.ptam_fat_kg),
    ptam_protein_kg: num(v.ptam_protein_kg),
    ptam_scs: num(v.ptam_scs),
    ptam_dpr: num(v.ptam_dpr),
    ptam_calving_ease_pct: num(v.ptam_calving_ease_pct),
    ptam_productive_life: num(v.ptam_productive_life),
    net_merit: num(v.net_merit),
  };
}

export function SiresTable({
  rows,
  breeds,
  canEdit,
  ownerOrgId,
}: {
  rows: SireRow[];
  breeds: BreedOption[];
  canEdit: boolean;
  ownerOrgId: string | null;
}) {
  void ownerOrgId;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SireRow["status"]>(
    "all",
  );
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SireRow | null>(null);
  const [deleting, setDeleting] = useState<SireRow | null>(null);

  const breedNameByCode = useMemo(
    () => new Map(breeds.map((b) => [b.code, b.name] as const)),
    [breeds],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.naab.toLowerCase().includes(q) ||
        r.registered_name.toLowerCase().includes(q) ||
        (r.short_name?.toLowerCase().includes(q) ?? false) ||
        (r.owner_company?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rows, query, statusFilter]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search NAAB, name, owner…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64"
          />
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="dead">Dead</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {filtered.length} of {rows.length}
          </span>
        </div>
        {canEdit ? (
          <Button type="button" onClick={() => setCreating(true)}>
            <HugeiconsIcon icon={PlusSignIcon} />
            New sire
          </Button>
        ) : null}
      </div>

      <div className="ring-1 ring-foreground/10 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>NAAB</TableHead>
              <TableHead>Registered name</TableHead>
              <TableHead>Breed</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">PTA milk</TableHead>
              <TableHead className="text-right">NM$</TableHead>
              <TableHead className="text-right">Straws</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-muted-foreground text-xs py-8"
                >
                  {rows.length === 0
                    ? "No sires yet. Add the bulls whose straws you keep in your tank."
                    : "No matches for the current filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-[11px]">{r.naab}</TableCell>
                  <TableCell className="font-medium">
                    {r.registered_name}
                    {r.short_name ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {r.short_name}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {r.breed_code
                      ? breedNameByCode.get(r.breed_code) ?? r.breed_code
                      : "—"}
                  </TableCell>
                  <TableCell>{r.owner_company ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.ptam_milk_kg !== null ? r.ptam_milk_kg : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.net_merit !== null ? r.net_merit : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.straw_batches ?? 0}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-[10px] uppercase tracking-wide ${
                        r.status === "active"
                          ? "text-primary"
                          : r.status === "inactive"
                            ? "text-muted-foreground"
                            : "text-destructive"
                      }`}
                    >
                      {STATUS_LABELS[r.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canEdit && !r.is_seed ? (
                        <>
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
                        </>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">
                          {r.is_seed ? "seed" : "read-only"}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <FormDialog
        open={creating}
        onOpenChange={(o) => setCreating(o)}
        mode="create"
        breeds={breeds}
      />
      <FormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        mode="edit"
        row={editing}
        breeds={breeds}
      />
      <DeleteDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        row={deleting}
      />
    </div>
  );
}

function FormDialog({
  open,
  onOpenChange,
  mode,
  row,
  breeds,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "create" | "edit";
  row?: SireRow | null;
  breeds: BreedOption[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {open ? (
          <FormBody
            mode={mode}
            row={row ?? null}
            breeds={breeds}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FormBody({
  mode,
  row,
  breeds,
  onClose,
}: {
  mode: "create" | "edit";
  row: SireRow | null;
  breeds: BreedOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: row ? rowToForm(row) : empty,
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const r = await upsertSire(formToInput(values, row?.id));
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(mode === "create" ? "Sire added." : "Sire updated.");
      onClose();
      router.refresh();
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "Add sire" : "Edit sire"}</DialogTitle>
        <DialogDescription>
          NAAB stud code is the international identifier. Performance
          traits (PTAs) are optional but power the cull / mating decision
          tools.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <Section title="Identity">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="naab"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NAAB / stud code</FormLabel>
                    <FormControl>
                      <Input
                        autoFocus
                        autoComplete="off"
                        placeholder="014HO07419"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="registered_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registered name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="short_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short name (optional)</FormLabel>
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
                              —
                            </span>
                          </SelectItem>
                          {breeds.map((b) => (
                            <SelectItem key={b.code} value={b.code}>
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
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="dead">Dead</SelectItem>
                          <SelectItem value="sold">Sold</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country_of_origin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country (ISO 2-letter)</FormLabel>
                    <FormControl>
                      <Input placeholder="US" maxLength={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="owner_company"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Owner / stud company</FormLabel>
                    <FormControl>
                      <Input placeholder="ABS / Genex / CRV / Semex…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="photo_url"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Photo URL (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://…"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Section>

          <Section
            title="Performance traits (PTAs)"
            hint="Predicted Transmitting Abilities — what this sire adds to the herd average. Leave blank if unknown."
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {NUM_FIELDS.map((f) => (
                <NumericField key={f.name} control={form.control} {...f} />
              ))}
            </div>
          </Section>

          <Section title="Notes">
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : mode === "create" ? "Add sire" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}

function DeleteDialog({
  open,
  onOpenChange,
  row,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: SireRow | null;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  if (!row) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {row.registered_name}?</DialogTitle>
          <DialogDescription>
            This removes the sire from the catalog. Existing semen-straw
            batches that reference it will be blocked from deletion —
            move or sell those first.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                const r = await deleteSire(row.id);
                if (r.error) {
                  toast.error(r.error);
                  return;
                }
                toast.success(`${row.registered_name} deleted.`);
                onOpenChange(false);
                router.refresh();
              })
            }
          >
            <HugeiconsIcon icon={Delete02Icon} />
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
    <fieldset className="flex flex-col gap-2 border-t pt-3">
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

const NUM_FIELDS: { name: keyof FormValues; label: string }[] = [
  { name: "ptam_milk_kg", label: "PTA milk (kg)" },
  { name: "ptam_fat_kg", label: "PTA fat (kg)" },
  { name: "ptam_protein_kg", label: "PTA protein (kg)" },
  { name: "ptam_scs", label: "PTA SCS" },
  { name: "ptam_dpr", label: "PTA DPR" },
  { name: "ptam_calving_ease_pct", label: "PTA calving ease %" },
  { name: "ptam_productive_life", label: "PTA prod. life (mo)" },
  { name: "net_merit", label: "Net merit ($)" },
];

function NumericField({
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
        <FormItem>
          <FormLabel className="text-xs">{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              step="any"
              inputMode="decimal"
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
