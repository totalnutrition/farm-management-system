"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  PencilEdit02Icon,
  AlarmClockIcon,
  ReceiptDollarIcon,
  UserGroup02Icon,
  CheckmarkCircle02Icon,
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
  upsertWorker,
  deleteWorker,
  upsertAttendance,
  deleteAttendance,
  createPayrollRun,
  updatePayrollLine,
  setPayrollRunStatus,
  deletePayrollRun,
  type WorkerInput,
} from "./actions";

// =============================================================================
// Types
// =============================================================================
export type WorkerRow = {
  id: string;
  full_name: string;
  national_id: string | null;
  phone: string | null;
  role: string | null;
  hire_date: string | null;
  end_date: string | null;
  base_wage_amount: number | null;
  wage_period: string;
  is_active: boolean;
};

export type AttendanceRow = {
  id: string;
  worker_id: string;
  worker_label: string;
  occurred_date: string;
  status: string;
  hours_worked: number | null;
  shift: string | null;
  note: string | null;
};

export type PayrollRunRow = {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  note: string | null;
  total_gross: number;
  total_net: number;
  line_count: number;
};

export type PayrollLineRow = {
  id: string;
  payroll_run_id: string;
  worker_id: string;
  worker_label: string;
  days_present: number | null;
  hours_worked: number | null;
  gross_amount: number;
  deductions_amount: number;
  advances_amount: number;
  net_amount: number;
};

const TABS = [
  { key: "today", label: "Today" },
  { key: "workers", label: "Workers" },
  { key: "attendance", label: "Attendance" },
  { key: "payroll", label: "Payroll" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function periodDefaults(): { start: string; end: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function PeopleHub({
  locationId,
  workers,
  attendance,
  todayAttendance,
  payrollRuns,
  payrollLinesByRun,
  currency,
}: {
  locationId: string;
  workers: WorkerRow[];
  attendance: AttendanceRow[];
  todayAttendance: AttendanceRow[];
  payrollRuns: PayrollRunRow[];
  payrollLinesByRun: Record<string, PayrollLineRow[]>;
  currency: string;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const active = (params.get("tab") as TabKey) ?? "today";

  const [openWorker, setOpenWorker] = useState<null | { initial: WorkerRow | null }>(null);
  const [openAttendance, setOpenAttendance] = useState(false);
  const [openPayrollRun, setOpenPayrollRun] = useState(false);

  const setTab = (k: TabKey) => {
    const q = new URLSearchParams(params.toString());
    q.set("tab", k);
    router.push(`/people?${q.toString()}`);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpenWorker({ initial: null })}>
          <HugeiconsIcon icon={UserGroup02Icon} />
          Add worker
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpenAttendance(true)}
          disabled={workers.length === 0}
        >
          <HugeiconsIcon icon={AlarmClockIcon} />
          Log attendance
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpenPayrollRun(true)}
          disabled={workers.length === 0}
        >
          <HugeiconsIcon icon={ReceiptDollarIcon} />
          New payroll run
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
          workers={workers}
          todayAttendance={todayAttendance}
        />
      ) : null}
      {active === "workers" ? (
        <WorkersTable
          rows={workers}
          onEdit={(w) => setOpenWorker({ initial: w })}
        />
      ) : null}
      {active === "attendance" ? <AttendanceTable rows={attendance} /> : null}
      {active === "payroll" ? (
        <PayrollTab
          runs={payrollRuns}
          linesByRun={payrollLinesByRun}
          currency={currency}
        />
      ) : null}

      <WorkerDialog
        open={!!openWorker}
        onOpenChange={(o) => !o && setOpenWorker(null)}
        locationId={locationId}
        initial={openWorker?.initial ?? null}
      />
      <AttendanceDialog
        open={openAttendance}
        onOpenChange={setOpenAttendance}
        workers={workers}
      />
      <PayrollRunDialog
        open={openPayrollRun}
        onOpenChange={setOpenPayrollRun}
        locationId={locationId}
      />
    </>
  );
}

// =============================================================================
// Today
// =============================================================================
function TodayTab({
  workers,
  todayAttendance,
}: {
  workers: WorkerRow[];
  todayAttendance: AttendanceRow[];
}) {
  const activeWorkers = workers.filter((w) => w.is_active);
  const presentMap = new Map(todayAttendance.map((a) => [a.worker_id, a]));
  const present = activeWorkers.filter((w) => presentMap.get(w.id)?.status === "present").length;
  const absent = activeWorkers.filter((w) => presentMap.get(w.id)?.status === "absent").length;
  const halfDay = activeWorkers.filter((w) => presentMap.get(w.id)?.status === "half_day").length;
  const unmarked = activeWorkers.filter((w) => !presentMap.has(w.id)).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Active workers" value={activeWorkers.length} />
        <Stat label="Present" value={present} accent />
        <Stat label="Absent / leave" value={absent} />
        <Stat label="Half-day" value={halfDay} />
      </div>
      <section className="ring-1 ring-foreground/10 flex flex-col">
        <header className="px-3 py-2 bg-foreground/5 flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-medium">
              Today&apos;s board
              <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                {unmarked} unmarked
              </span>
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Active roster with today&apos;s status — unmarked workers haven&apos;t been logged yet.
            </p>
          </div>
        </header>
        {activeWorkers.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            No active workers.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-foreground/[0.025]">
                <tr className="text-left">
                  <th className="px-3 py-1.5 font-medium">Name</th>
                  <th className="px-3 py-1.5 font-medium">Role</th>
                  <th className="px-3 py-1.5 font-medium">Status today</th>
                  <th className="px-3 py-1.5 font-medium text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                {activeWorkers.map((w) => {
                  const a = presentMap.get(w.id);
                  return (
                    <tr key={w.id} className="border-t border-foreground/10">
                      <td className="px-3 py-1.5 font-medium">{w.full_name}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{w.role ?? "—"}</td>
                      <td className="px-3 py-1.5">
                        {a ? (
                          <StatusBadge status={a.status} />
                        ) : (
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            unmarked
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {a?.hours_worked ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="ring-1 ring-foreground/10 p-3 flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={`text-lg font-medium tabular-nums ${accent ? "text-primary" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "present" ? "text-primary" : status === "absent" ? "text-destructive" : "";
  return (
    <span className={`text-[10px] font-medium uppercase tracking-wide ${tone}`}>
      {status.replace("_", " ")}
    </span>
  );
}

// =============================================================================
// Workers table
// =============================================================================
function WorkersTable({
  rows,
  onEdit,
}: {
  rows: WorkerRow[];
  onEdit: (w: WorkerRow) => void;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const onDelete = (w: WorkerRow) => {
    if (!confirm(`Delete worker "${w.full_name}"? Their attendance + payroll lines will go too.`)) return;
    setBusyId(w.id);
    startTransition(async () => {
      const r = await deleteWorker(w.id);
      setBusyId(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Worker deleted.");
      router.refresh();
    });
  };

  return (
    <div className="ring-1 ring-foreground/10 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-foreground/5">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Role</th>
            <th className="px-3 py-2 font-medium">Phone</th>
            <th className="px-3 py-2 font-medium">National ID</th>
            <th className="px-3 py-2 font-medium">Hired</th>
            <th className="px-3 py-2 font-medium text-right">Wage</th>
            <th className="px-3 py-2 font-medium">Period</th>
            <th className="px-3 py-2 font-medium">Active</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-3 py-4 text-center text-muted-foreground">
                No workers yet. Add one with the button above.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-t border-foreground/10">
                <td className="px-3 py-2 font-medium">{r.full_name}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.role ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.phone ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground font-mono">{r.national_id ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.hire_date ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.base_wage_amount === null ? "—" : r.base_wage_amount.toFixed(0)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.wage_period}</td>
                <td className="px-3 py-2">
                  {r.is_active ? (
                    <span className="text-[10px] uppercase tracking-wide text-primary">active</span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      inactive
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(r)}>
                    <HugeiconsIcon icon={PencilEdit02Icon} />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(r)}
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
// Attendance table
// =============================================================================
function AttendanceTable({ rows }: { rows: AttendanceRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const onDelete = (id: string) => {
    if (!confirm("Delete this attendance entry?")) return;
    setBusyId(id);
    startTransition(async () => {
      const r = await deleteAttendance(id);
      setBusyId(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Attendance deleted.");
      router.refresh();
    });
  };

  return (
    <div className="ring-1 ring-foreground/10 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-foreground/5">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Worker</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Shift</th>
            <th className="px-3 py-2 font-medium text-right">Hours</th>
            <th className="px-3 py-2 font-medium">Note</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">
                No attendance entries yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-t border-foreground/10">
                <td className="px-3 py-2">{r.occurred_date}</td>
                <td className="px-3 py-2 font-medium">{r.worker_label}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.shift ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.hours_worked ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.note ?? ""}</td>
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
// Payroll
// =============================================================================
function PayrollTab({
  runs,
  linesByRun,
  currency,
}: {
  runs: PayrollRunRow[];
  linesByRun: Record<string, PayrollLineRow[]>;
  currency: string;
}) {
  const [openId, setOpenId] = useState<string | null>(runs[0]?.id ?? null);
  return (
    <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
      <aside className="ring-1 ring-foreground/10 flex flex-col">
        <header className="px-3 py-2 bg-foreground/5 text-xs font-medium">Runs</header>
        {runs.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            No payroll runs yet.
          </div>
        ) : (
          <ul className="flex flex-col">
            {runs.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  className={`w-full text-left px-3 py-2 text-xs border-t border-foreground/10 hover:bg-foreground/5 ${
                    openId === r.id ? "bg-foreground/5" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {r.period_start} → {r.period_end}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {r.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {r.line_count} workers · gross {currency} {r.total_gross.toFixed(0)} · net {currency} {r.total_net.toFixed(0)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <div className="flex flex-col">
        {openId ? (
          <PayrollRunDetail
            run={runs.find((r) => r.id === openId)!}
            lines={linesByRun[openId] ?? []}
            currency={currency}
          />
        ) : (
          <div className="ring-1 ring-foreground/10 p-4 text-center text-xs text-muted-foreground">
            Pick a run on the left.
          </div>
        )}
      </div>
    </div>
  );
}

function PayrollRunDetail({
  run,
  lines,
  currency,
}: {
  run: PayrollRunRow;
  lines: PayrollLineRow[];
  currency: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const isEditable = run.status === "draft";

  const onPost = () => {
    if (!confirm("Post this run? Lines won't be editable after.")) return;
    startTransition(async () => {
      const r = await setPayrollRunStatus(run.id, "posted");
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Run posted.");
      router.refresh();
    });
  };
  const onMarkPaid = () =>
    startTransition(async () => {
      const r = await setPayrollRunStatus(run.id, "paid");
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Run marked paid.");
      router.refresh();
    });
  const onDelete = () => {
    if (!confirm(`Delete the ${run.period_start} → ${run.period_end} run? Lines go too.`)) return;
    startTransition(async () => {
      const r = await deletePayrollRun(run.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Run deleted.");
      router.refresh();
    });
  };

  return (
    <section className="ring-1 ring-foreground/10 flex flex-col">
      <header className="px-3 py-2 bg-foreground/5 flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-medium">
            {run.period_start} → {run.period_end}
            <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              {run.status}
            </span>
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {run.line_count} workers · gross {currency} {run.total_gross.toFixed(0)} · net {currency} {run.total_net.toFixed(0)}
          </p>
        </div>
        <div className="flex gap-2">
          {run.status === "draft" ? (
            <Button type="button" size="sm" variant="outline" onClick={onPost}>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} />
              Post
            </Button>
          ) : null}
          {run.status === "posted" ? (
            <Button type="button" size="sm" variant="outline" onClick={onMarkPaid}>
              Mark paid
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" onClick={onDelete}>
            <HugeiconsIcon icon={Delete02Icon} />
          </Button>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-foreground/[0.025]">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Worker</th>
              <th className="px-3 py-2 font-medium text-right">Days</th>
              <th className="px-3 py-2 font-medium text-right">Hours</th>
              <th className="px-3 py-2 font-medium text-right">Gross</th>
              <th className="px-3 py-2 font-medium text-right">Deductions</th>
              <th className="px-3 py-2 font-medium text-right">Advances</th>
              <th className="px-3 py-2 font-medium text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">
                  No lines on this run.
                </td>
              </tr>
            ) : (
              lines.map((l) => (
                <PayrollLineRowEditor key={l.id} line={l} editable={isEditable} currency={currency} />
              ))
            )}
          </tbody>
          {lines.length > 0 ? (
            <tfoot>
              <tr className="border-t border-foreground/20 bg-foreground/[0.025]">
                <td className="px-3 py-2 font-medium" colSpan={3}>Totals</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {currency} {lines.reduce((s, l) => s + l.gross_amount, 0).toFixed(0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {currency} {lines.reduce((s, l) => s + l.deductions_amount, 0).toFixed(0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {currency} {lines.reduce((s, l) => s + l.advances_amount, 0).toFixed(0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {currency} {lines.reduce((s, l) => s + l.net_amount, 0).toFixed(0)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}

function PayrollLineRowEditor({
  line,
  editable,
  currency,
}: {
  line: PayrollLineRow;
  editable: boolean;
  currency: string;
}) {
  const router = useRouter();
  const [gross, setGross] = useState(String(line.gross_amount));
  const [deductions, setDeductions] = useState(String(line.deductions_amount));
  const [advances, setAdvances] = useState(String(line.advances_amount));
  const [, startTransition] = useTransition();

  const commit = () => {
    const g = Number(gross || 0);
    const d = Number(deductions || 0);
    const a = Number(advances || 0);
    if (
      g === line.gross_amount &&
      d === line.deductions_amount &&
      a === line.advances_amount
    )
      return;
    startTransition(async () => {
      const r = await updatePayrollLine({
        id: line.id,
        gross_amount: g,
        deductions_amount: d,
        advances_amount: a,
        note: null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  };

  if (!editable) {
    return (
      <tr className="border-t border-foreground/10">
        <td className="px-3 py-2 font-medium">{line.worker_label}</td>
        <td className="px-3 py-2 text-right tabular-nums">{line.days_present ?? "—"}</td>
        <td className="px-3 py-2 text-right tabular-nums">{line.hours_worked ?? "—"}</td>
        <td className="px-3 py-2 text-right tabular-nums">{currency} {line.gross_amount.toFixed(0)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{currency} {line.deductions_amount.toFixed(0)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{currency} {line.advances_amount.toFixed(0)}</td>
        <td className="px-3 py-2 text-right tabular-nums font-medium">{currency} {line.net_amount.toFixed(0)}</td>
      </tr>
    );
  }

  const net = (Number(gross || 0) - Number(deductions || 0) - Number(advances || 0)).toFixed(0);

  return (
    <tr className="border-t border-foreground/10">
      <td className="px-3 py-2 font-medium">{line.worker_label}</td>
      <td className="px-3 py-2 text-right tabular-nums">{line.days_present ?? "—"}</td>
      <td className="px-3 py-2 text-right tabular-nums">{line.hours_worked ?? "—"}</td>
      <td className="px-3 py-1">
        <Input
          type="number"
          step="any"
          min={0}
          value={gross}
          onChange={(e) => setGross(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-7 w-24 ml-auto text-right tabular-nums"
        />
      </td>
      <td className="px-3 py-1">
        <Input
          type="number"
          step="any"
          min={0}
          value={deductions}
          onChange={(e) => setDeductions(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-7 w-24 ml-auto text-right tabular-nums"
        />
      </td>
      <td className="px-3 py-1">
        <Input
          type="number"
          step="any"
          min={0}
          value={advances}
          onChange={(e) => setAdvances(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-7 w-24 ml-auto text-right tabular-nums"
        />
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-medium">{currency} {net}</td>
    </tr>
  );
}

// =============================================================================
// Dialogs
// =============================================================================
const workerFormSchema = z.object({
  full_name: z.string().min(1, "Required."),
  national_id: z.string().optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
  hire_date: z.string().optional(),
  end_date: z.string().optional(),
  base_wage_amount: z.number().min(0).nullable().optional(),
  wage_period: z.enum(["daily", "weekly", "monthly"]),
  is_active: z.boolean(),
});
type WorkerFormValues = z.infer<typeof workerFormSchema>;

function WorkerDialog({
  open,
  onOpenChange,
  locationId,
  initial,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  locationId: string;
  initial: WorkerRow | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<WorkerFormValues>({
    resolver: zodResolver(workerFormSchema),
    values: {
      full_name: initial?.full_name ?? "",
      national_id: initial?.national_id ?? "",
      phone: initial?.phone ?? "",
      role: initial?.role ?? "",
      hire_date: initial?.hire_date ?? "",
      end_date: initial?.end_date ?? "",
      base_wage_amount: initial?.base_wage_amount ?? null,
      wage_period: (initial?.wage_period as WorkerFormValues["wage_period"]) ?? "monthly",
      is_active: initial?.is_active ?? true,
    },
  });

  const onSubmit = (v: WorkerFormValues) =>
    startTransition(async () => {
      const payload: WorkerInput = {
        id: initial?.id,
        location_id: locationId,
        full_name: v.full_name,
        national_id: v.national_id || null,
        phone: v.phone || null,
        role: v.role || null,
        hire_date: v.hire_date || null,
        end_date: v.end_date || null,
        base_wage_amount: v.base_wage_amount ?? null,
        wage_period: v.wage_period,
        is_active: v.is_active,
      };
      const r = await upsertWorker(payload);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(initial ? "Worker updated." : "Worker added.");
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit worker" : "Add worker"}</DialogTitle>
          <DialogDescription>
            Workers don&apos;t need to be app users. Base wage + period drive
            payroll-line gross calculation.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <Input placeholder="Milker / feeder / AI tech / manager" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="national_id"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>National ID / CNIC</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hire_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hire date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="base_wage_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base wage</FormLabel>
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
                name="wage_period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wage period</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="col-span-2 flex items-center gap-2">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Active</FormLabel>
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

const attendanceFormSchema = z.object({
  worker_id: z.string().uuid("Pick a worker."),
  occurred_date: z.string().min(1),
  status: z.enum(["present", "absent", "leave", "half_day"]),
  hours_worked: z.number().nullable().optional(),
  shift: z.string().optional(),
  note: z.string().optional(),
});
type AttendanceFormValues = z.infer<typeof attendanceFormSchema>;

function AttendanceDialog({
  open,
  onOpenChange,
  workers,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  workers: WorkerRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: {
      worker_id: "",
      occurred_date: todayIso(),
      status: "present",
      hours_worked: null,
      shift: "",
      note: "",
    },
  });

  const onSubmit = (v: AttendanceFormValues) =>
    startTransition(async () => {
      const r = await upsertAttendance({
        worker_id: v.worker_id,
        occurred_date: v.occurred_date,
        status: v.status,
        hours_worked: v.hours_worked ?? null,
        shift: v.shift || null,
        note: v.note || null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Attendance saved.");
      onOpenChange(false);
      form.reset({
        worker_id: "",
        occurred_date: todayIso(),
        status: "present",
        hours_worked: null,
        shift: "",
        note: "",
      });
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log attendance</DialogTitle>
          <DialogDescription>
            One row per worker / date / shift. Re-saving the same combo
            updates in place.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormField
              control={form.control}
              name="worker_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Worker</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a worker" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {workers
                        .filter((w) => w.is_active)
                        .map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.full_name}
                            {w.role ? ` · ${w.role}` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="occurred_date"
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
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="present">Present</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                        <SelectItem value="leave">Leave</SelectItem>
                        <SelectItem value="half_day">Half day</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shift"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shift</FormLabel>
                    <FormControl>
                      <Input placeholder="morning / evening / night" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hours_worked"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours worked</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        max={24}
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
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
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

const payrollRunFormSchema = z.object({
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  note: z.string().optional(),
});
type PayrollRunFormValues = z.infer<typeof payrollRunFormSchema>;

function PayrollRunDialog({
  open,
  onOpenChange,
  locationId,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  locationId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const defaults = periodDefaults();
  const form = useForm<PayrollRunFormValues>({
    resolver: zodResolver(payrollRunFormSchema),
    defaultValues: {
      period_start: defaults.start,
      period_end: defaults.end,
      note: "",
    },
  });

  const onSubmit = (v: PayrollRunFormValues) =>
    startTransition(async () => {
      const r = await createPayrollRun({
        location_id: locationId,
        period_start: v.period_start,
        period_end: v.period_end,
        note: v.note || null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Run created. Lines pre-filled from attendance.");
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New payroll run</DialogTitle>
          <DialogDescription>
            One line per active worker is created with days_present and
            hours_worked aggregated from attendance in the period. Gross is
            estimated from base_wage × days; you can edit each line before
            posting.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="period_start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period start</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="period_end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period end</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
