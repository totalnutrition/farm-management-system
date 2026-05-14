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
  upsertFeedMaterial,
  deleteFeedMaterial,
  upsertVetMedicine,
  deleteVetMedicine,
  upsertReproProtocol,
  deleteReproProtocol,
  upsertVaccinationProtocol,
  deleteVaccinationProtocol,
  upsertTreatmentProtocol,
  deleteTreatmentProtocol,
} from "./actions";

// -------------------------------------------------------------------
// Shared bits
// -------------------------------------------------------------------
const numOrEmpty = z.number().nullable().optional();

function DialogShell({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function RowActions({
  isSeed,
  onEdit,
  onDelete,
  busy,
}: {
  isSeed: boolean;
  onEdit: () => void;
  onDelete: () => void;
  busy?: boolean;
}) {
  if (isSeed) {
    return (
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        seed (read-only)
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <Button type="button" size="sm" variant="ghost" onClick={onEdit} disabled={busy}>
        <HugeiconsIcon icon={PencilEdit02Icon} />
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDelete} disabled={busy}>
        <HugeiconsIcon icon={Delete02Icon} />
      </Button>
    </span>
  );
}

export function AddButton({
  label = "Add",
  onClick,
}: {
  label?: string;
  onClick: () => void;
}) {
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick}>
      <HugeiconsIcon icon={PlusSignIcon} />
      {label}
    </Button>
  );
}

// -------------------------------------------------------------------
// Feed materials
// -------------------------------------------------------------------
const feedFormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Required."),
  category: z.enum([
    "forage",
    "grain",
    "protein",
    "byproduct",
    "mineral",
    "vitamin",
    "water",
    "fat",
    "additive",
  ]),
  dm_pct: numOrEmpty,
  ne_l_mcal_per_kg: numOrEmpty,
  cp_pct: numOrEmpty,
  ndf_pct: numOrEmpty,
  starch_pct: numOrEmpty,
  notes: z.string().max(500).optional().nullable(),
});
type FeedFormValues = z.infer<typeof feedFormSchema>;
export type FeedRow = {
  id: string;
  name: string;
  category: string;
  dm_pct: number | null;
  ne_l_mcal_per_kg: number | null;
  cp_pct: number | null;
  ndf_pct: number | null;
  starch_pct: number | null;
  is_seed: boolean;
};

export function FeedMaterialActions({ row }: { row: FeedRow }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const onDelete = () => {
    if (!confirm(`Delete "${row.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteFeedMaterial(row.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Feed material deleted.");
      router.refresh();
    });
  };
  return (
    <>
      <RowActions
        isSeed={row.is_seed}
        onEdit={() => setOpen(true)}
        onDelete={onDelete}
        busy={isPending}
      />
      <FeedMaterialDialog open={open} onOpenChange={setOpen} initial={row} />
    </>
  );
}

export function FeedMaterialDialog({
  open,
  onOpenChange,
  initial,
  trigger,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  initial?: Partial<FeedRow>;
  trigger?: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<FeedFormValues>({
    resolver: zodResolver(feedFormSchema),
    values: {
      id: initial?.id,
      name: initial?.name ?? "",
      category: (initial?.category as FeedFormValues["category"]) ?? "forage",
      dm_pct: initial?.dm_pct ?? null,
      ne_l_mcal_per_kg: initial?.ne_l_mcal_per_kg ?? null,
      cp_pct: initial?.cp_pct ?? null,
      ndf_pct: initial?.ndf_pct ?? null,
      starch_pct: initial?.starch_pct ?? null,
      notes: null,
    },
  });

  const onSubmit = (v: FeedFormValues) => {
    startTransition(async () => {
      const r = await upsertFeedMaterial(v);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(initial?.id ? "Feed material updated." : "Feed material added.");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title={initial?.id ? "Edit feed material" : "Add feed material"}
      description="Used in TMR recipes and feeding events. Nutritionals are per kg DM."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Corn silage" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[
                        "forage",
                        "grain",
                        "protein",
                        "byproduct",
                        "mineral",
                        "vitamin",
                        "fat",
                        "additive",
                        "water",
                      ].map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <NumberField form={form} name="dm_pct" label="DM %" />
            <NumberField form={form} name="ne_l_mcal_per_kg" label="NEL Mcal/kg" />
            <NumberField form={form} name="cp_pct" label="CP %" />
            <NumberField form={form} name="ndf_pct" label="NDF %" />
            <NumberField form={form} name="starch_pct" label="Starch %" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogShell>
  );
}

export function AddFeedMaterialButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AddButton label="Add feed material" onClick={() => setOpen(true)} />
      <FeedMaterialDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

// -------------------------------------------------------------------
// Vet medicines
// -------------------------------------------------------------------
const vetFormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Required."),
  brand: z.string().optional().nullable(),
  active_ingredient: z.string().optional().nullable(),
  category: z.enum([
    "antibiotic",
    "anti-inflammatory",
    "hormone",
    "vaccine",
    "parasiticide",
    "mineral",
    "fluid",
    "other",
  ]),
  route: z.string().optional().nullable(),
  default_dose: z.string().optional().nullable(),
  withdrawal_milk_hours: numOrEmpty,
  withdrawal_meat_days: numOrEmpty,
});
type VetFormValues = z.infer<typeof vetFormSchema>;
export type VetRow = {
  id: string;
  name: string;
  brand: string | null;
  active_ingredient: string | null;
  category: string;
  route: string | null;
  default_dose: string | null;
  withdrawal_milk_hours: number | null;
  withdrawal_meat_days: number | null;
  is_seed: boolean;
};

export function VetMedicineActions({ row }: { row: VetRow }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const onDelete = () => {
    if (!confirm(`Delete "${row.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteVetMedicine(row.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Vet medicine deleted.");
      router.refresh();
    });
  };
  return (
    <>
      <RowActions
        isSeed={row.is_seed}
        onEdit={() => setOpen(true)}
        onDelete={onDelete}
        busy={isPending}
      />
      <VetMedicineDialog open={open} onOpenChange={setOpen} initial={row} />
    </>
  );
}

export function VetMedicineDialog({
  open,
  onOpenChange,
  initial,
  trigger,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  initial?: Partial<VetRow>;
  trigger?: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<VetFormValues>({
    resolver: zodResolver(vetFormSchema),
    values: {
      id: initial?.id,
      name: initial?.name ?? "",
      brand: initial?.brand ?? null,
      active_ingredient: initial?.active_ingredient ?? null,
      category: (initial?.category as VetFormValues["category"]) ?? "antibiotic",
      route: initial?.route ?? null,
      default_dose: initial?.default_dose ?? null,
      withdrawal_milk_hours: initial?.withdrawal_milk_hours ?? null,
      withdrawal_meat_days: initial?.withdrawal_meat_days ?? null,
    },
  });

  const onSubmit = (v: VetFormValues) => {
    startTransition(async () => {
      const r = await upsertVetMedicine(v);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(initial?.id ? "Vet medicine updated." : "Vet medicine added.");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title={initial?.id ? "Edit vet medicine" : "Add vet medicine"}
      description="Drives the Health and Vaccinations event forms. Withdrawal hours/days roll up to the Withdrawals report."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Pirsue" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Zoetis"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="active_ingredient"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Active ingredient</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Pirlimycin HCl"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[
                        "antibiotic",
                        "anti-inflammatory",
                        "hormone",
                        "vaccine",
                        "parasiticide",
                        "mineral",
                        "fluid",
                        "other",
                      ].map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="route"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Route</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="IM / IV / SC / IMM / PO"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="default_dose"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Default dose</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="50 mg per quarter"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <NumberField form={form} name="withdrawal_milk_hours" label="Milk WD (hours)" />
            <NumberField form={form} name="withdrawal_meat_days" label="Meat WD (days)" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogShell>
  );
}

export function AddVetMedicineButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AddButton label="Add vet medicine" onClick={() => setOpen(true)} />
      <VetMedicineDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

// -------------------------------------------------------------------
// Simple text-only protocol forms (repro / vaccination / treatment)
// -------------------------------------------------------------------
const simpleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Required."),
  description: z.string().max(500).optional().nullable(),
});

const reproFormSchema = simpleSchema.extend({
  protocol_type: z.string().min(1, "Type is required."),
});
type ReproFormValues = z.infer<typeof reproFormSchema>;
export type ReproRow = {
  id: string;
  name: string;
  description: string | null;
  protocol_type: string;
  is_seed: boolean;
};

export function ReproProtocolActions({ row }: { row: ReproRow }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const onDelete = () => {
    if (!confirm(`Delete "${row.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteReproProtocol(row.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Repro protocol deleted.");
      router.refresh();
    });
  };
  return (
    <>
      <RowActions
        isSeed={row.is_seed}
        onEdit={() => setOpen(true)}
        onDelete={onDelete}
        busy={isPending}
      />
      <ReproProtocolDialog open={open} onOpenChange={setOpen} initial={row} />
    </>
  );
}

export function ReproProtocolDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  initial?: Partial<ReproRow>;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<ReproFormValues>({
    resolver: zodResolver(reproFormSchema),
    values: {
      id: initial?.id,
      name: initial?.name ?? "",
      protocol_type: initial?.protocol_type ?? "sync",
      description: initial?.description ?? null,
    },
  });
  const onSubmit = (v: ReproFormValues) =>
    startTransition(async () => {
      const r = await upsertReproProtocol(v);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(initial?.id ? "Protocol updated." : "Protocol added.");
      onOpenChange(false);
      router.refresh();
    });

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={initial?.id ? "Edit repro protocol" : "Add repro protocol"}
      description="Steps (day/action/dose) are edited in the protocol detail page — coming next."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <NameField form={form} />
          <FormField
            control={form.control}
            name="protocol_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="sync / resync / fixed-time-AI / manual"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DescriptionField form={form} />
          <SubmitRow onCancel={() => onOpenChange(false)} pending={isPending} />
        </form>
      </Form>
    </DialogShell>
  );
}

export function AddReproProtocolButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AddButton label="Add repro protocol" onClick={() => setOpen(true)} />
      <ReproProtocolDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

const vaxFormSchema = simpleSchema.extend({
  target_class: z.enum(["calf", "heifer", "lactating", "dry", "bull"]),
});
type VaxFormValues = z.infer<typeof vaxFormSchema>;
export type VaxRow = {
  id: string;
  name: string;
  description: string | null;
  target_class: string;
  is_seed: boolean;
};

export function VaccinationProtocolActions({ row }: { row: VaxRow }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const onDelete = () => {
    if (!confirm(`Delete "${row.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteVaccinationProtocol(row.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Vaccination protocol deleted.");
      router.refresh();
    });
  };
  return (
    <>
      <RowActions
        isSeed={row.is_seed}
        onEdit={() => setOpen(true)}
        onDelete={onDelete}
        busy={isPending}
      />
      <VaccinationProtocolDialog open={open} onOpenChange={setOpen} initial={row} />
    </>
  );
}

export function VaccinationProtocolDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  initial?: Partial<VaxRow>;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<VaxFormValues>({
    resolver: zodResolver(vaxFormSchema),
    values: {
      id: initial?.id,
      name: initial?.name ?? "",
      target_class: (initial?.target_class as VaxFormValues["target_class"]) ?? "lactating",
      description: initial?.description ?? null,
    },
  });
  const onSubmit = (v: VaxFormValues) =>
    startTransition(async () => {
      const r = await upsertVaccinationProtocol(v);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(initial?.id ? "Protocol updated." : "Protocol added.");
      onOpenChange(false);
      router.refresh();
    });

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={initial?.id ? "Edit vaccination protocol" : "Add vaccination protocol"}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <NameField form={form} />
          <FormField
            control={form.control}
            name="target_class"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target class</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {["calf", "heifer", "lactating", "dry", "bull"].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <DescriptionField form={form} />
          <SubmitRow onCancel={() => onOpenChange(false)} pending={isPending} />
        </form>
      </Form>
    </DialogShell>
  );
}

export function AddVaccinationProtocolButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AddButton label="Add vaccination protocol" onClick={() => setOpen(true)} />
      <VaccinationProtocolDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

const txFormSchema = simpleSchema.extend({
  diagnosis_code: z.string().optional().nullable(),
});
type TxFormValues = z.infer<typeof txFormSchema>;
export type TxRow = {
  id: string;
  name: string;
  description: string | null;
  diagnosis_code: string | null;
  is_seed: boolean;
};

export function TreatmentProtocolActions({ row }: { row: TxRow }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const onDelete = () => {
    if (!confirm(`Delete "${row.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteTreatmentProtocol(row.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Treatment protocol deleted.");
      router.refresh();
    });
  };
  return (
    <>
      <RowActions
        isSeed={row.is_seed}
        onEdit={() => setOpen(true)}
        onDelete={onDelete}
        busy={isPending}
      />
      <TreatmentProtocolDialog open={open} onOpenChange={setOpen} initial={row} />
    </>
  );
}

export function TreatmentProtocolDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  initial?: Partial<TxRow>;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<TxFormValues>({
    resolver: zodResolver(txFormSchema),
    values: {
      id: initial?.id,
      name: initial?.name ?? "",
      diagnosis_code: initial?.diagnosis_code ?? null,
      description: initial?.description ?? null,
    },
  });
  const onSubmit = (v: TxFormValues) =>
    startTransition(async () => {
      const r = await upsertTreatmentProtocol(v);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(initial?.id ? "Protocol updated." : "Protocol added.");
      onOpenChange(false);
      router.refresh();
    });

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={initial?.id ? "Edit treatment protocol" : "Add treatment protocol"}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <NameField form={form} />
          <FormField
            control={form.control}
            name="diagnosis_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Diagnosis code</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. 4.1 (clinical mastitis)"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <DescriptionField form={form} />
          <SubmitRow onCancel={() => onOpenChange(false)} pending={isPending} />
        </form>
      </Form>
    </DialogShell>
  );
}

export function AddTreatmentProtocolButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AddButton label="Add treatment protocol" onClick={() => setOpen(true)} />
      <TreatmentProtocolDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

// -------------------------------------------------------------------
// Tiny field helpers
// -------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NumberField({ form, name, label }: { form: any; name: string; label: string }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              step="any"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NameField({ form }: { form: any }) {
  return (
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
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DescriptionField({ form }: { form: any }) {
  return (
    <FormField
      control={form.control}
      name="description"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Description</FormLabel>
          <FormControl>
            <Textarea
              rows={2}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value || null)}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

function SubmitRow({ onCancel, pending }: { onCancel: () => void; pending: boolean }) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </DialogFooter>
  );
}
