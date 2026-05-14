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
  VaccineIcon,
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

import {
  createVaccinationEvent,
  deleteVaccinationEvent,
} from "./actions";

export type VaccinationRow = {
  id: string;
  occurred_at: string;
  animal_label: string | null;
  group_label: string | null;
  medicine_name: string | null;
  dose_ml: number | null;
  route: string | null;
  withdrawal_milk_until: string | null;
  withdrawal_meat_until: string | null;
  note: string | null;
};
export type AnimalOption = { id: string; label: string };
export type GroupOption = { id: string; label: string };
export type VetOption = {
  id: string;
  name: string;
  default_dose: string | null;
  route: string | null;
  withdrawal_milk_hours: number | null;
  withdrawal_meat_days: number | null;
};

const NONE = "__none__";

const formSchema = z.object({
  animal_id: z.string(),
  group_id: z.string(),
  vet_medicine_id: z.string().min(1, "Pick a vet medicine."),
  dose_ml: z.number().nullable().optional(),
  route: z.string().optional(),
  occurred_at: z.string().min(1),
  note: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

function nowLocalIso(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function VaccinationsClient({
  locationId,
  rows,
  animals,
  groups,
  vetMeds,
}: {
  locationId: string;
  rows: VaccinationRow[];
  animals: AnimalOption[];
  groups: GroupOption[];
  vetMeds: VetOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {rows.length} vaccination{rows.length === 1 ? "" : "s"} on file. Doses
          deduct from vet-medicine stock; milk/meat withdrawal end dates roll
          up to Withdrawals.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          disabled={vetMeds.length === 0}
        >
          <HugeiconsIcon icon={PlusSignIcon} />
          Record vaccination
        </Button>
      </div>

      {vetMeds.length === 0 ? (
        <div className="ring-1 ring-foreground/10 p-3 text-xs text-muted-foreground">
          No vet medicines yet. Add one in Settings → Organization → Catalogs.
        </div>
      ) : null}

      <VaccinationsTable rows={rows} />

      <AddVaccinationDialog
        open={open}
        onOpenChange={setOpen}
        locationId={locationId}
        animals={animals}
        groups={groups}
        vetMeds={vetMeds}
      />
    </>
  );
}

function VaccinationsTable({ rows }: { rows: VaccinationRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const onDelete = (id: string) => {
    if (!confirm("Delete this vaccination event? Stock will be restored.")) return;
    setBusyId(id);
    startTransition(async () => {
      const r = await deleteVaccinationEvent(id);
      setBusyId(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Vaccination deleted.");
      router.refresh();
    });
  };

  return (
    <div className="ring-1 ring-foreground/10 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-foreground/5">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Target</th>
            <th className="px-3 py-2 font-medium">Medicine</th>
            <th className="px-3 py-2 font-medium text-right">Dose (mL)</th>
            <th className="px-3 py-2 font-medium">Route</th>
            <th className="px-3 py-2 font-medium">Milk WD until</th>
            <th className="px-3 py-2 font-medium">Meat WD until</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">
                No vaccinations yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-t border-foreground/10">
                <td className="px-3 py-2">{new Date(r.occurred_at).toLocaleString()}</td>
                <td className="px-3 py-2">{r.animal_label ?? r.group_label ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1">
                    <HugeiconsIcon icon={VaccineIcon} className="size-3" />
                    {r.medicine_name ?? "—"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.dose_ml ?? "—"}
                </td>
                <td className="px-3 py-2">{r.route ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {r.withdrawal_milk_until
                    ? new Date(r.withdrawal_milk_until).toLocaleString()
                    : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {r.withdrawal_meat_until ?? "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(r.id)}
                    disabled={busyId === r.id}
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

function AddVaccinationDialog({
  open,
  onOpenChange,
  locationId,
  animals,
  groups,
  vetMeds,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  locationId: string;
  animals: AnimalOption[];
  groups: GroupOption[];
  vetMeds: VetOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      animal_id: NONE,
      group_id: NONE,
      vet_medicine_id: vetMeds[0]?.id ?? "",
      dose_ml: null,
      route: vetMeds[0]?.route ?? "",
      occurred_at: nowLocalIso(),
      note: "",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedMedId = form.watch("vet_medicine_id");
  const med = vetMeds.find((m) => m.id === watchedMedId);

  const onSubmit = (v: FormValues) => {
    if (v.animal_id === NONE && v.group_id === NONE) {
      toast.error("Pick an animal or a group.");
      return;
    }
    startTransition(async () => {
      const r = await createVaccinationEvent({
        location_id: locationId,
        animal_id: v.animal_id === NONE ? null : v.animal_id,
        group_id: v.group_id === NONE ? null : v.group_id,
        vet_medicine_id: v.vet_medicine_id,
        dose_ml: v.dose_ml ?? null,
        route: v.route || null,
        occurred_at: new Date(v.occurred_at).toISOString(),
        note: v.note ?? null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Vaccination recorded.");
      form.reset({
        animal_id: NONE,
        group_id: NONE,
        vet_medicine_id: vetMeds[0]?.id ?? "",
        dose_ml: null,
        route: vetMeds[0]?.route ?? "",
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
          <DialogTitle>Record vaccination</DialogTitle>
          <DialogDescription>
            Pick an animal or a group. Withdrawal end-dates are computed from
            the catalog&apos;s milk/meat hours.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="animal_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Animal</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>— none —</SelectItem>
                        {animals.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="group_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group (bulk)</FormLabel>
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
                name="vet_medicine_id"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Vet medicine</FormLabel>
                    <Select
                      onValueChange={(v) => {
                        field.onChange(v);
                        const next = vetMeds.find((m) => m.id === v);
                        if (next?.route) form.setValue("route", next.route);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a vet medicine" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vetMeds.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                            {m.default_dose ? ` · ${m.default_dose}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dose_ml"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dose (mL)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
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
                        placeholder="IM / SC / IV / IMM / PO"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="occurred_at"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>When</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {med ? (
                <div className="col-span-2 text-[10px] text-muted-foreground">
                  Catalog withdrawal: milk{" "}
                  {med.withdrawal_milk_hours
                    ? `${med.withdrawal_milk_hours} h`
                    : "—"}{" "}
                  · meat{" "}
                  {med.withdrawal_meat_days
                    ? `${med.withdrawal_meat_days} d`
                    : "—"}
                </div>
              ) : null}
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
