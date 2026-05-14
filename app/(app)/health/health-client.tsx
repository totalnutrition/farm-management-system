"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  MedicalFileIcon,
  GivePillIcon,
  VaccineIcon,
  AlertCircleIcon,
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
  createHealthEvent,
  deleteHealthEvent,
  type HealthEventInput,
} from "./actions";
import { createVaccinationEvent } from "@/app/(app)/vaccinations/actions";

// =============================================================================
// Types
// =============================================================================
export type AnimalOpt = {
  id: string;
  animal_id: string;
  name: string | null;
  life_stage: string | null;
};
export type DiagnosisOpt = { code: string; name: string };
export type RouteOpt = { code: string; name: string };
export type VetOpt = {
  id: string;
  name: string;
  default_dose: string | null;
  route: string | null;
  withdrawal_milk_hours: number | null;
  withdrawal_meat_days: number | null;
};
export type GroupOpt = { id: string; label: string };

export type HealthRow = {
  id: string;
  event_date: string;
  animal_label: string;
  event_type: string;
  diagnosis: string | null;
  severity: number | null;
  drug_name: string | null;
  dose: string | null;
  route: string | null;
  milk_wd_end: string | null;
  meat_wd_end: string | null;
  notes: string | null;
};

export type VaxRow = {
  id: string;
  occurred_at: string;
  animal_label: string | null;
  group_label: string | null;
  medicine_name: string | null;
  dose_ml: number | null;
  route: string | null;
  milk_wd: string | null;
  meat_wd: string | null;
};

export type WithdrawalRow = {
  animal_id: string;
  animal_label: string;
  drug: string;
  source: "health" | "vaccination";
  event_date: string;
  milk_wd_end: string | null;
  meat_wd_end: string | null;
  hours_until_milk: number | null;
  days_until_meat: number | null;
};

const TABS = [
  { key: "today", label: "Today" },
  { key: "diagnoses", label: "Diagnoses & Treatments" },
  { key: "vaccinations", label: "Vaccinations" },
  { key: "withdrawals", label: "Withdrawals" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const NONE = "__none__";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function nowLocalIso(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function HealthHub({
  locationId,
  animals,
  groups,
  diagnoses,
  routes,
  vetMeds,
  healthRows,
  vaxRows,
  withdrawals,
}: {
  locationId: string;
  animals: AnimalOpt[];
  groups: GroupOpt[];
  diagnoses: DiagnosisOpt[];
  routes: RouteOpt[];
  vetMeds: VetOpt[];
  healthRows: HealthRow[];
  vaxRows: VaxRow[];
  withdrawals: WithdrawalRow[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const active = (params.get("tab") as TabKey) ?? "today";

  const [openDlg, setOpenDlg] = useState<null | "diagnosis" | "treatment" | "vaccination">(null);

  const setTab = (k: TabKey) => {
    const q = new URLSearchParams(params.toString());
    q.set("tab", k);
    router.push(`/health?${q.toString()}`);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpenDlg("diagnosis")}>
          <HugeiconsIcon icon={MedicalFileIcon} />
          Log diagnosis
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpenDlg("treatment")}>
          <HugeiconsIcon icon={GivePillIcon} />
          Log treatment
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpenDlg("vaccination")}>
          <HugeiconsIcon icon={VaccineIcon} />
          Log vaccination
        </Button>
      </div>

      <nav className="ring-1 ring-foreground/10 flex overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs whitespace-nowrap border-b-2 -mb-px ${
              active === t.key
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {active === "today" ? (
        <TodayTab
          activeWithdrawals={withdrawals}
          recentDiagnoses={healthRows.filter((h) => h.event_type === "diagnosis").slice(0, 10)}
        />
      ) : null}
      {active === "diagnoses" ? <HealthList rows={healthRows} /> : null}
      {active === "vaccinations" ? <VaccinationList rows={vaxRows} /> : null}
      {active === "withdrawals" ? <WithdrawalList rows={withdrawals} /> : null}

      <HealthEventDialog
        open={openDlg === "diagnosis"}
        onOpenChange={(o) => !o && setOpenDlg(null)}
        kind="diagnosis"
        locationId={locationId}
        animals={animals}
        diagnoses={diagnoses}
        routes={routes}
        vetMeds={vetMeds}
      />
      <HealthEventDialog
        open={openDlg === "treatment"}
        onOpenChange={(o) => !o && setOpenDlg(null)}
        kind="treatment"
        locationId={locationId}
        animals={animals}
        diagnoses={diagnoses}
        routes={routes}
        vetMeds={vetMeds}
      />
      <VaccinationDialog
        open={openDlg === "vaccination"}
        onOpenChange={(o) => !o && setOpenDlg(null)}
        locationId={locationId}
        animals={animals}
        groups={groups}
        vetMeds={vetMeds}
      />
    </>
  );
}

// =============================================================================
// Today tab
// =============================================================================
function TodayTab({
  activeWithdrawals,
  recentDiagnoses,
}: {
  activeWithdrawals: WithdrawalRow[];
  recentDiagnoses: HealthRow[];
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="ring-1 ring-foreground/10 flex flex-col">
        <header className="px-3 py-2 bg-foreground/5 flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-medium">
              Active withdrawals
              <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                {activeWithdrawals.length} cow{activeWithdrawals.length === 1 ? "" : "s"}
              </span>
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Milk or meat hold from a treatment or vaccination still in effect.
            </p>
          </div>
        </header>
        {activeWithdrawals.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            No active withdrawals.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-foreground/[0.025]">
                <tr className="text-left">
                  <th className="px-3 py-1.5 font-medium">Cow</th>
                  <th className="px-3 py-1.5 font-medium">Drug</th>
                  <th className="px-3 py-1.5 font-medium text-right">Milk left</th>
                  <th className="px-3 py-1.5 font-medium text-right">Meat left</th>
                </tr>
              </thead>
              <tbody>
                {activeWithdrawals.slice(0, 12).map((w, i) => (
                  <tr key={i} className="border-t border-foreground/10">
                    <td className="px-3 py-1.5 font-medium">{w.animal_label}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{w.drug}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${w.hours_until_milk && w.hours_until_milk > 0 ? "text-destructive font-medium" : ""}`}>
                      {w.hours_until_milk !== null && w.hours_until_milk > 0
                        ? `${w.hours_until_milk}h`
                        : "—"}
                    </td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${w.days_until_meat && w.days_until_meat > 0 ? "text-destructive font-medium" : ""}`}>
                      {w.days_until_meat !== null && w.days_until_meat > 0
                        ? `${w.days_until_meat}d`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ring-1 ring-foreground/10 flex flex-col">
        <header className="px-3 py-2 bg-foreground/5">
          <h3 className="text-sm font-medium">
            Recent diagnoses
            <span className="ml-2 text-[10px] font-normal text-muted-foreground">
              {recentDiagnoses.length}
            </span>
          </h3>
        </header>
        {recentDiagnoses.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            No diagnoses logged.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-foreground/[0.025]">
                <tr className="text-left">
                  <th className="px-3 py-1.5 font-medium">Date</th>
                  <th className="px-3 py-1.5 font-medium">Cow</th>
                  <th className="px-3 py-1.5 font-medium">Diagnosis</th>
                  <th className="px-3 py-1.5 font-medium text-right">Sev</th>
                </tr>
              </thead>
              <tbody>
                {recentDiagnoses.map((d) => (
                  <tr key={d.id} className="border-t border-foreground/10">
                    <td className="px-3 py-1.5">{d.event_date}</td>
                    <td className="px-3 py-1.5 font-medium">{d.animal_label}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{d.diagnosis ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{d.severity ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// =============================================================================
// Health (diagnoses + treatments) list
// =============================================================================
function HealthList({ rows }: { rows: HealthRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const onDelete = (id: string) => {
    if (!confirm("Delete this health event? Stock will be restored if a drug was deducted.")) return;
    setBusyId(id);
    startTransition(async () => {
      const r = await deleteHealthEvent(id);
      setBusyId(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Event deleted.");
      router.refresh();
    });
  };

  return (
    <div className="ring-1 ring-foreground/10 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-foreground/5">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Cow</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Diagnosis</th>
            <th className="px-3 py-2 font-medium text-right">Sev</th>
            <th className="px-3 py-2 font-medium">Drug · dose · route</th>
            <th className="px-3 py-2 font-medium">Milk WD end</th>
            <th className="px-3 py-2 font-medium">Meat WD end</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-3 py-4 text-center text-muted-foreground">
                No health events yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-t border-foreground/10">
                <td className="px-3 py-2">{r.event_date}</td>
                <td className="px-3 py-2 font-medium">{r.animal_label}</td>
                <td className="px-3 py-2">{r.event_type}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.diagnosis ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.severity ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {[r.drug_name, r.dose, r.route].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {r.milk_wd_end ? new Date(r.milk_wd_end).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.meat_wd_end ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(r.id)} disabled={busyId === r.id}>
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

// =============================================================================
// Vaccinations list (read-only — events created via dialog)
// =============================================================================
function VaccinationList({ rows }: { rows: VaxRow[] }) {
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
            <th className="px-3 py-2 font-medium">Milk WD end</th>
            <th className="px-3 py-2 font-medium">Meat WD end</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">
                No vaccinations yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-t border-foreground/10">
                <td className="px-3 py-2">{new Date(r.occurred_at).toLocaleString()}</td>
                <td className="px-3 py-2 font-medium">
                  {r.animal_label ?? r.group_label ?? "—"}
                </td>
                <td className="px-3 py-2">{r.medicine_name ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.dose_ml ?? "—"}</td>
                <td className="px-3 py-2">{r.route ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {r.milk_wd ? new Date(r.milk_wd).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.meat_wd ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Withdrawals list
// =============================================================================
function WithdrawalList({ rows }: { rows: WithdrawalRow[] }) {
  const active = rows.filter(
    (r) => (r.hours_until_milk ?? 0) > 0 || (r.days_until_meat ?? 0) > 0,
  );
  const cleared = rows.filter(
    (r) => !((r.hours_until_milk ?? 0) > 0 || (r.days_until_meat ?? 0) > 0),
  );
  return (
    <div className="flex flex-col gap-3">
      <section className="ring-1 ring-foreground/10 flex flex-col">
        <header className="px-3 py-2 bg-foreground/5">
          <h3 className="text-sm font-medium">
            Active holds
            <span className="ml-2 text-[10px] font-normal text-muted-foreground">
              {active.length}
            </span>
          </h3>
        </header>
        {active.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            No active holds.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-foreground/[0.025]">
              <tr className="text-left">
                <th className="px-3 py-1.5 font-medium">Cow</th>
                <th className="px-3 py-1.5 font-medium">Drug</th>
                <th className="px-3 py-1.5 font-medium">Source</th>
                <th className="px-3 py-1.5 font-medium">Given</th>
                <th className="px-3 py-1.5 font-medium text-right">Milk left</th>
                <th className="px-3 py-1.5 font-medium text-right">Meat left</th>
              </tr>
            </thead>
            <tbody>
              {active.map((w, i) => (
                <tr key={i} className="border-t border-foreground/10">
                  <td className="px-3 py-1.5 font-medium">{w.animal_label}</td>
                  <td className="px-3 py-1.5">{w.drug}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{w.source}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{w.event_date}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-destructive font-medium">
                    {w.hours_until_milk && w.hours_until_milk > 0 ? `${w.hours_until_milk}h` : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-destructive font-medium">
                    {w.days_until_meat && w.days_until_meat > 0 ? `${w.days_until_meat}d` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {cleared.length > 0 ? (
        <section className="ring-1 ring-foreground/10 flex flex-col">
          <header className="px-3 py-2 bg-foreground/5">
            <h3 className="text-sm font-medium text-muted-foreground">
              Cleared (recent)
              <span className="ml-2 text-[10px] font-normal">
                {cleared.length}
              </span>
            </h3>
          </header>
          <table className="w-full text-xs">
            <thead className="bg-foreground/[0.025]">
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-1.5 font-medium">Cow</th>
                <th className="px-3 py-1.5 font-medium">Drug</th>
                <th className="px-3 py-1.5 font-medium">Given</th>
                <th className="px-3 py-1.5 font-medium">Milk WD end</th>
                <th className="px-3 py-1.5 font-medium">Meat WD end</th>
              </tr>
            </thead>
            <tbody>
              {cleared.slice(0, 30).map((w, i) => (
                <tr key={i} className="border-t border-foreground/10 text-muted-foreground">
                  <td className="px-3 py-1.5">{w.animal_label}</td>
                  <td className="px-3 py-1.5">{w.drug}</td>
                  <td className="px-3 py-1.5">{w.event_date}</td>
                  <td className="px-3 py-1.5">{w.milk_wd_end ? new Date(w.milk_wd_end).toLocaleString() : "—"}</td>
                  <td className="px-3 py-1.5">{w.meat_wd_end ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

// =============================================================================
// Dialogs
// =============================================================================
const healthFormSchema = z.object({
  animal_id: z.string().uuid("Pick a cow."),
  event_date: z.string().min(1),
  diagnosis_code: z.string(),
  diagnosis_text: z.string().optional(),
  severity: z.number().int().nullable().optional(),
  quarter: z.string().optional(),
  vet_medicine_id: z.string(),
  drug_dose_amount: z.number().nullable().optional(),
  drug_dose_unit: z.string().optional(),
  route_code: z.string(),
  prescribing_vet: z.string().optional(),
  locomotion_score: z.number().int().nullable().optional(),
  notes: z.string().optional(),
});
type HealthFormValues = z.infer<typeof healthFormSchema>;

function HealthEventDialog({
  open,
  onOpenChange,
  kind,
  locationId,
  animals,
  diagnoses,
  routes,
  vetMeds,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  kind: "diagnosis" | "treatment";
  locationId: string;
  animals: AnimalOpt[];
  diagnoses: DiagnosisOpt[];
  routes: RouteOpt[];
  vetMeds: VetOpt[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<HealthFormValues>({
    resolver: zodResolver(healthFormSchema),
    defaultValues: {
      animal_id: "",
      event_date: todayIso(),
      diagnosis_code: NONE,
      diagnosis_text: "",
      severity: null,
      quarter: "",
      vet_medicine_id: NONE,
      drug_dose_amount: null,
      drug_dose_unit: "mL",
      route_code: NONE,
      prescribing_vet: "",
      locomotion_score: null,
      notes: "",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const medId = form.watch("vet_medicine_id");
  const med = vetMeds.find((m) => m.id === medId);

  const onSubmit = (v: HealthFormValues) =>
    startTransition(async () => {
      const payload: HealthEventInput = {
        location_id: locationId,
        animal_id: v.animal_id,
        event_date: v.event_date,
        event_type: kind,
        diagnosis_code: v.diagnosis_code === NONE ? null : v.diagnosis_code,
        diagnosis_text: v.diagnosis_text || null,
        severity: v.severity ?? null,
        quarter: v.quarter || null,
        vet_medicine_id: v.vet_medicine_id === NONE ? null : v.vet_medicine_id,
        drug_dose_amount: v.drug_dose_amount ?? null,
        drug_dose_unit: v.drug_dose_unit || null,
        route_code: v.route_code === NONE ? null : v.route_code,
        prescribing_vet: v.prescribing_vet || null,
        locomotion_score: v.locomotion_score ?? null,
        notes: v.notes || null,
      };
      const r = await createHealthEvent(payload);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(kind === "diagnosis" ? "Diagnosis logged." : "Treatment logged.");
      onOpenChange(false);
      form.reset({
        animal_id: "",
        event_date: todayIso(),
        diagnosis_code: NONE,
        diagnosis_text: "",
        severity: null,
        quarter: "",
        vet_medicine_id: NONE,
        drug_dose_amount: null,
        drug_dose_unit: "mL",
        route_code: NONE,
        prescribing_vet: "",
        locomotion_score: null,
        notes: "",
      });
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {kind === "diagnosis" ? "Log diagnosis" : "Log treatment"}
          </DialogTitle>
          <DialogDescription>
            {kind === "diagnosis"
              ? "Health diagnosis per cow. Add a drug below to record an associated treatment in the same step."
              : "Drug + dose + route. Withdrawals are computed from the catalog hours/days."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="animal_id"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Cow</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a cow" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {animals.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.animal_id}
                            {a.name ? ` · ${a.name}` : ""}
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
                name="event_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity (1–5)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="diagnosis_code"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Diagnosis</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="— pick a code —" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>— none / free text —</SelectItem>
                        {diagnoses.map((d) => (
                          <SelectItem key={d.code} value={d.code}>
                            <span className="font-mono">{d.code}</span> · {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="diagnosis_text"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Diagnosis notes (free text)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Clinical signs / details" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quarter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quarter (mastitis)</FormLabel>
                    <FormControl>
                      <Input placeholder="LF / RF / LR / RR" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="locomotion_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Locomotion score (1–5)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vet_medicine_id"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Vet medicine (optional)</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val);
                        const next = vetMeds.find((m) => m.id === val);
                        if (next?.route) form.setValue("route_code", next.route);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>— none —</SelectItem>
                        {vetMeds.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                            {m.default_dose ? ` · ${m.default_dose}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="drug_dose_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dose</FormLabel>
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
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="drug_dose_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl>
                      <Input placeholder="mL / mg / bolus" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="route_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Route</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {routes.map((r) => (
                          <SelectItem key={r.code} value={r.code}>
                            <span className="font-mono">{r.code}</span> · {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prescribing_vet"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vet</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              {med ? (
                <div className="col-span-2 text-[10px] text-muted-foreground">
                  Catalog withdrawal: milk{" "}
                  {med.withdrawal_milk_hours ? `${med.withdrawal_milk_hours} h` : "—"} · meat{" "}
                  {med.withdrawal_meat_days ? `${med.withdrawal_meat_days} d` : "—"}
                </div>
              ) : null}
              <FormField
                control={form.control}
                name="notes"
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
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Vaccination dialog — uses the existing /vaccinations/actions.ts createVaccinationEvent
const vaxFormSchema = z.object({
  animal_id: z.string(),
  group_id: z.string(),
  vet_medicine_id: z.string().min(1, "Pick a vet medicine."),
  dose_ml: z.number().nullable().optional(),
  route: z.string().optional(),
  occurred_at: z.string().min(1),
  note: z.string().optional(),
});
type VaxFormValues = z.infer<typeof vaxFormSchema>;

function VaccinationDialog({
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
  animals: AnimalOpt[];
  groups: GroupOpt[];
  vetMeds: VetOpt[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<VaxFormValues>({
    resolver: zodResolver(vaxFormSchema),
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

  const onSubmit = (v: VaxFormValues) => {
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
        note: v.note || null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Vaccination logged.");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log vaccination</DialogTitle>
          <DialogDescription>
            Pick an animal or a group. Withdrawal end-dates compute from the
            catalog.
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
                            {a.animal_id}
                            {a.name ? ` · ${a.name}` : ""}
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
                      onValueChange={(val) => {
                        field.onChange(val);
                        const next = vetMeds.find((m) => m.id === val);
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
                      <Input {...field} value={field.value ?? ""} />
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
                {isPending ? "Saving…" : "Log vaccination"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Suppress unused import lint — AlertCircleIcon kept for symmetry/future use.
void AlertCircleIcon;
