"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ClipboardClockIcon,
  TaskDaily01Icon,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  createMilking,
  deleteMilking,
  createTestDay,
  deleteTestDay,
  type MilkingInput,
  type TestDayInput,
} from "./actions";

export type AnimalOpt = {
  id: string;
  animal_id: string;
  name: string | null;
  current_lactation: number | null;
  last_calving_date: string | null;
};

export type MilkingRow = {
  id: string;
  milking_at: string;
  animal_label: string;
  session: number | null;
  yield_kg: number;
  conductivity: number | null;
  fat_pct: number | null;
  protein_pct: number | null;
};

export type TestDayRow = {
  id: string;
  test_date: string;
  animal_label: string;
  dim: number | null;
  milk_kg: number;
  fat_pct: number | null;
  protein_pct: number | null;
  scc: number | null;
  mun: number | null;
  test_plan: string | null;
};

export type TodayMilkRow = {
  animal_id: string;
  animal_label: string;
  dim: number | null;
  am_kg: number | null;
  pm_kg: number | null;
  total_kg: number;
  sessions: number;
};

const TABS = [
  { key: "today", label: "Today" },
  { key: "milkings", label: "Milkings" },
  { key: "test-days", label: "Test days" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function nowLocalIso(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function MilkHub({
  locationId,
  animals,
  milkings,
  testDays,
  todayRows,
  todayTotals,
}: {
  locationId: string;
  animals: AnimalOpt[];
  milkings: MilkingRow[];
  testDays: TestDayRow[];
  todayRows: TodayMilkRow[];
  todayTotals: { totalKg: number; cows: number; avgKg: number };
}) {
  const params = useSearchParams();
  const router = useRouter();
  const active = (params.get("tab") as TabKey) ?? "today";
  const [openDlg, setOpenDlg] = useState<null | "milking" | "test-day">(null);

  const setTab = (k: TabKey) => {
    const q = new URLSearchParams(params.toString());
    q.set("tab", k);
    router.push(`/milk?${q.toString()}`);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpenDlg("milking")}
          disabled={animals.length === 0}
        >
          <HugeiconsIcon icon={ClipboardClockIcon} />
          Record milking
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpenDlg("test-day")}
          disabled={animals.length === 0}
        >
          <HugeiconsIcon icon={TaskDaily01Icon} />
          Record test-day
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

      {active === "today" ? <TodayTab rows={todayRows} totals={todayTotals} /> : null}
      {active === "milkings" ? <MilkingsList rows={milkings} /> : null}
      {active === "test-days" ? <TestDaysList rows={testDays} /> : null}

      <MilkingDialog
        open={openDlg === "milking"}
        onOpenChange={(o) => !o && setOpenDlg(null)}
        locationId={locationId}
        animals={animals}
      />
      <TestDayDialog
        open={openDlg === "test-day"}
        onOpenChange={(o) => !o && setOpenDlg(null)}
        animals={animals}
      />
    </>
  );
}

// =============================================================================
// Today
// =============================================================================
function TodayTab({
  rows,
  totals,
}: {
  rows: TodayMilkRow[];
  totals: { totalKg: number; cows: number; avgKg: number };
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total milk today" value={`${totals.totalKg.toFixed(1)} kg`} />
        <Stat label="Cows milked" value={String(totals.cows)} />
        <Stat label="Avg per cow" value={`${totals.avgKg.toFixed(1)} kg`} />
      </div>
      <section className="ring-1 ring-foreground/10 flex flex-col">
        <header className="px-3 py-2 bg-foreground/5">
          <h3 className="text-sm font-medium">
            Today by cow
            <span className="ml-2 text-[10px] font-normal text-muted-foreground">
              {rows.length} cow{rows.length === 1 ? "" : "s"}
            </span>
          </h3>
        </header>
        {rows.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            No milkings today yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-foreground/[0.025]">
                <tr className="text-left">
                  <th className="px-3 py-1.5 font-medium">Cow</th>
                  <th className="px-3 py-1.5 font-medium text-right">DIM</th>
                  <th className="px-3 py-1.5 font-medium text-right">AM</th>
                  <th className="px-3 py-1.5 font-medium text-right">PM</th>
                  <th className="px-3 py-1.5 font-medium text-right">Total</th>
                  <th className="px-3 py-1.5 font-medium text-right">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.animal_id} className="border-t border-foreground/10">
                    <td className="px-3 py-1.5 font-medium">{r.animal_label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.dim ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {r.am_kg === null ? "—" : r.am_kg.toFixed(1)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {r.pm_kg === null ? "—" : r.pm_kg.toFixed(1)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                      {r.total_kg.toFixed(1)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.sessions}</td>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ring-1 ring-foreground/10 p-3 flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-lg font-medium tabular-nums">{value}</span>
    </div>
  );
}

// =============================================================================
// Milkings list
// =============================================================================
function MilkingsList({ rows }: { rows: MilkingRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const onDelete = (id: string) => {
    if (!confirm("Delete this milking?")) return;
    setBusyId(id);
    startTransition(async () => {
      const r = await deleteMilking(id);
      setBusyId(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Milking deleted.");
      router.refresh();
    });
  };

  return (
    <div className="ring-1 ring-foreground/10 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-foreground/5">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Cow</th>
            <th className="px-3 py-2 font-medium text-right">Session</th>
            <th className="px-3 py-2 font-medium text-right">Yield kg</th>
            <th className="px-3 py-2 font-medium text-right">EC</th>
            <th className="px-3 py-2 font-medium text-right">Fat %</th>
            <th className="px-3 py-2 font-medium text-right">Protein %</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">
                No milkings logged yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-t border-foreground/10">
                <td className="px-3 py-2">{new Date(r.milking_at).toLocaleString()}</td>
                <td className="px-3 py-2 font-medium">{r.animal_label}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.session ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {r.yield_kg.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {r.conductivity === null ? "—" : r.conductivity.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {r.fat_pct === null ? "—" : r.fat_pct.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {r.protein_pct === null ? "—" : r.protein_pct.toFixed(2)}
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

// =============================================================================
// Test days list
// =============================================================================
function TestDaysList({ rows }: { rows: TestDayRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const onDelete = (id: string) => {
    if (!confirm("Delete this test-day result?")) return;
    setBusyId(id);
    startTransition(async () => {
      const r = await deleteTestDay(id);
      setBusyId(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Test-day deleted.");
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
            <th className="px-3 py-2 font-medium text-right">DIM</th>
            <th className="px-3 py-2 font-medium text-right">Milk kg</th>
            <th className="px-3 py-2 font-medium text-right">Fat %</th>
            <th className="px-3 py-2 font-medium text-right">Protein %</th>
            <th className="px-3 py-2 font-medium text-right">SCC</th>
            <th className="px-3 py-2 font-medium text-right">MUN</th>
            <th className="px-3 py-2 font-medium">Plan</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-3 py-4 text-center text-muted-foreground">
                No test-day results yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-t border-foreground/10">
                <td className="px-3 py-2">{r.test_date}</td>
                <td className="px-3 py-2 font-medium">{r.animal_label}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.dim ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {r.milk_kg.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.fat_pct === null ? "—" : r.fat_pct.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.protein_pct === null ? "—" : r.protein_pct.toFixed(2)}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums ${
                    r.scc !== null && r.scc > 200000 ? "text-destructive font-medium" : ""
                  }`}
                >
                  {r.scc === null ? "—" : r.scc.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.mun === null ? "—" : r.mun.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.test_plan ?? "—"}</td>
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

// =============================================================================
// Dialogs
// =============================================================================
function AnimalPicker({
  animals,
  field,
  placeholder,
}: {
  animals: AnimalOpt[];
  field: { value: string; onChange: (v: string) => void };
  placeholder?: string;
}) {
  return (
    <Select onValueChange={field.onChange} value={field.value}>
      <FormControl>
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? "Pick a cow"} />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {animals.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.animal_id}
            {a.name ? ` · ${a.name}` : ""}
            {a.current_lactation ? ` · L${a.current_lactation}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const milkingFormSchema = z.object({
  animal_id: z.string().uuid("Pick a cow."),
  milking_at: z.string().min(1),
  milking_session: z.number().int().nullable().optional(),
  yield_kg: z.number().nonnegative(),
  conductivity: z.number().nullable().optional(),
  fat_pct: z.number().nullable().optional(),
  protein_pct: z.number().nullable().optional(),
});
type MilkingFormValues = z.infer<typeof milkingFormSchema>;

function MilkingDialog({
  open,
  onOpenChange,
  locationId,
  animals,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  locationId: string;
  animals: AnimalOpt[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<MilkingFormValues>({
    resolver: zodResolver(milkingFormSchema),
    defaultValues: {
      animal_id: "",
      milking_at: nowLocalIso(),
      milking_session: 1,
      yield_kg: 0,
      conductivity: null,
      fat_pct: null,
      protein_pct: null,
    },
  });

  const onSubmit = (v: MilkingFormValues) =>
    startTransition(async () => {
      const payload: MilkingInput = {
        location_id: locationId,
        animal_id: v.animal_id,
        milking_at: new Date(v.milking_at).toISOString(),
        milking_session: v.milking_session ?? null,
        yield_kg: v.yield_kg,
        conductivity: v.conductivity ?? null,
        fat_pct: v.fat_pct ?? null,
        protein_pct: v.protein_pct ?? null,
      };
      const r = await createMilking(payload);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Milking recorded.");
      onOpenChange(false);
      form.reset({
        animal_id: "",
        milking_at: nowLocalIso(),
        milking_session: 1,
        yield_kg: 0,
        conductivity: null,
        fat_pct: null,
        protein_pct: null,
      });
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record milking</DialogTitle>
          <DialogDescription>
            Per-cow per-session yield. Session 1 = AM, 2 = PM by convention.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormField
              control={form.control}
              name="animal_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cow</FormLabel>
                  <AnimalPicker animals={animals} field={field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="milking_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>When</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="milking_session"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Session #</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={6}
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
                name="yield_kg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Yield (kg)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(Number(e.target.value || 0))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="conductivity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conductivity (mS/cm)</FormLabel>
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
                name="fat_pct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fat %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        max={15}
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
                name="protein_pct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Protein %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        max={10}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
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

const testDayFormSchema = z.object({
  animal_id: z.string().uuid("Pick a cow."),
  test_date: z.string().min(1),
  milk_kg: z.number().nonnegative(),
  fat_pct: z.number().nullable().optional(),
  protein_pct: z.number().nullable().optional(),
  lactose_pct: z.number().nullable().optional(),
  scc: z.number().int().nullable().optional(),
  mun: z.number().nullable().optional(),
  test_plan: z.string().optional(),
  milkings_per_day: z.number().int().nullable().optional(),
});
type TestDayFormValues = z.infer<typeof testDayFormSchema>;

function TestDayDialog({
  open,
  onOpenChange,
  animals,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  animals: AnimalOpt[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<TestDayFormValues>({
    resolver: zodResolver(testDayFormSchema),
    defaultValues: {
      animal_id: "",
      test_date: todayIso(),
      milk_kg: 0,
      fat_pct: null,
      protein_pct: null,
      lactose_pct: null,
      scc: null,
      mun: null,
      test_plan: "",
      milkings_per_day: 2,
    },
  });

  const onSubmit = (v: TestDayFormValues) =>
    startTransition(async () => {
      const payload: TestDayInput = {
        animal_id: v.animal_id,
        test_date: v.test_date,
        milk_kg: v.milk_kg,
        fat_pct: v.fat_pct ?? null,
        protein_pct: v.protein_pct ?? null,
        lactose_pct: v.lactose_pct ?? null,
        scc: v.scc ?? null,
        mun: v.mun ?? null,
        test_plan: v.test_plan || null,
        milkings_per_day: v.milkings_per_day ?? null,
      };
      const r = await createTestDay(payload);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Test-day recorded.");
      onOpenChange(false);
      form.reset({
        animal_id: "",
        test_date: todayIso(),
        milk_kg: 0,
        fat_pct: null,
        protein_pct: null,
        lactose_pct: null,
        scc: null,
        mun: null,
        test_plan: "",
        milkings_per_day: 2,
      });
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record test-day result</DialogTitle>
          <DialogDescription>
            DHIA-style 24-hour result. One row per cow per test date —
            re-saving the same cow + date overwrites.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormField
              control={form.control}
              name="animal_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cow</FormLabel>
                  <AnimalPicker animals={animals} field={field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="test_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="milk_kg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Milk kg (24h)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(Number(e.target.value || 0))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fat_pct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fat %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        max={15}
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
                name="protein_pct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Protein %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        max={10}
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
                name="lactose_pct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lactose %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        max={10}
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
                name="scc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SCC (cells/mL)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
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
                name="mun"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MUN (mg/dL)</FormLabel>
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
                name="milkings_per_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Milkings / day</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={6}
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
                name="test_plan"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Test plan</FormLabel>
                    <FormControl>
                      <Input placeholder="DHIA / on-farm / lab" {...field} />
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
