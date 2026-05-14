import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import { resolveLocationSettings } from "@/lib/settings-resolver";
import {
  PeopleHub,
  type WorkerRow,
  type AttendanceRow,
  type PayrollRunRow,
  type PayrollLineRow,
} from "./people-client";

export const metadata = { title: "People" };
export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const active = await getActiveLocation();
  if (!active) {
    return <NoLocationSelected title="No location selected" hint="People are scoped to the active location." />;
  }

  const admin = createAdminClient();
  const todayDate = new Date().toISOString().slice(0, 10);

  type W = {
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

  const [workerRows, attendanceRows, runRows, orgRow] = await Promise.all([
    admin
      .from("workers")
      .select(
        "id, full_name, national_id, phone, role, hire_date, end_date, base_wage_amount, wage_period, is_active",
      )
      .eq("location_id", active.id)
      .order("is_active", { ascending: false })
      .order("full_name")
      .then(({ data }) => (data ?? []) as W[]),
    admin
      .from("attendance_events")
      .select("id, worker_id, occurred_date, status, hours_worked, shift, note")
      .order("occurred_date", { ascending: false })
      .limit(500)
      .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
    admin
      .from("payroll_runs")
      .select("id, period_start, period_end, status, note")
      .eq("location_id", active.id)
      .order("period_end", { ascending: false })
      .limit(50)
      .then(({ data }) => (data ?? []) as Record<string, unknown>[]),
    admin
      .from("organizations")
      .select(
        "default_currency, default_units, default_timezone, default_land_area_unit",
      )
      .limit(1)
      .maybeSingle()
      .then(({ data }) => data),
  ]);

  // Filter attendance to this location's workers.
  const ownedIds = new Set(workerRows.map((w) => w.id));
  const ownedAttendance = attendanceRows.filter((a) => ownedIds.has(a.worker_id as string));
  const workerLabel = new Map(workerRows.map((w) => [w.id, w.full_name] as const));

  const workers: WorkerRow[] = workerRows.map((w) => ({
    id: w.id,
    full_name: w.full_name,
    national_id: w.national_id,
    phone: w.phone,
    role: w.role,
    hire_date: w.hire_date,
    end_date: w.end_date,
    base_wage_amount: w.base_wage_amount !== null && w.base_wage_amount !== undefined
      ? Number(w.base_wage_amount)
      : null,
    wage_period: w.wage_period,
    is_active: w.is_active,
  }));

  const attendance: AttendanceRow[] = ownedAttendance.map((a) => ({
    id: a.id as string,
    worker_id: a.worker_id as string,
    worker_label: workerLabel.get(a.worker_id as string) ?? "—",
    occurred_date: a.occurred_date as string,
    status: a.status as string,
    hours_worked: a.hours_worked !== null && a.hours_worked !== undefined ? Number(a.hours_worked) : null,
    shift: (a.shift as string | null) ?? null,
    note: (a.note as string | null) ?? null,
  }));

  const todayAttendance = attendance.filter((a) => a.occurred_date === todayDate);

  // Payroll runs + lines
  const runIds = runRows.map((r) => r.id as string);
  let lineRows: Record<string, unknown>[] = [];
  if (runIds.length > 0) {
    const { data } = await admin
      .from("payroll_lines")
      .select(
        "id, payroll_run_id, worker_id, days_present, hours_worked, gross_amount, deductions_amount, advances_amount, net_amount",
      )
      .in("payroll_run_id", runIds);
    lineRows = (data ?? []) as Record<string, unknown>[];
  }

  const linesByRun: Record<string, PayrollLineRow[]> = {};
  const totalsByRun: Record<string, { gross: number; net: number; count: number }> = {};
  for (const l of lineRows) {
    const rid = l.payroll_run_id as string;
    const line: PayrollLineRow = {
      id: l.id as string,
      payroll_run_id: rid,
      worker_id: l.worker_id as string,
      worker_label: workerLabel.get(l.worker_id as string) ?? "—",
      days_present: l.days_present !== null && l.days_present !== undefined ? Number(l.days_present) : null,
      hours_worked: l.hours_worked !== null && l.hours_worked !== undefined ? Number(l.hours_worked) : null,
      gross_amount: Number(l.gross_amount ?? 0),
      deductions_amount: Number(l.deductions_amount ?? 0),
      advances_amount: Number(l.advances_amount ?? 0),
      net_amount: Number(l.net_amount ?? 0),
    };
    (linesByRun[rid] ??= []).push(line);
    const t = (totalsByRun[rid] ??= { gross: 0, net: 0, count: 0 });
    t.gross += line.gross_amount;
    t.net += line.net_amount;
    t.count += 1;
  }
  for (const rid of Object.keys(linesByRun)) {
    linesByRun[rid].sort((a, b) => a.worker_label.localeCompare(b.worker_label));
  }

  const payrollRuns: PayrollRunRow[] = runRows.map((r) => {
    const t = totalsByRun[r.id as string] ?? { gross: 0, net: 0, count: 0 };
    return {
      id: r.id as string,
      period_start: r.period_start as string,
      period_end: r.period_end as string,
      status: r.status as string,
      note: (r.note as string | null) ?? null,
      total_gross: t.gross,
      total_net: t.net,
      line_count: t.count,
    };
  });

  const settings = resolveLocationSettings(
    {
      currency_override: null,
      units_override: null,
      timezone: null,
      land_area_unit_override: null,
    },
    orgRow
      ? {
          default_currency: (orgRow.default_currency as string) ?? "PKR",
          default_units: ((orgRow.default_units as string) ?? "metric") as "metric" | "imperial",
          default_timezone: (orgRow.default_timezone as string) ?? "Asia/Karachi",
          default_land_area_unit: ((orgRow.default_land_area_unit as string) ?? "acre") as
            | "hectare"
            | "acre"
            | "square_meter"
            | "square_foot"
            | "marla"
            | "kanal"
            | "murabba",
        }
      : null,
  );

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">People</h1>
        <p className="text-xs text-muted-foreground">
          {active.name} · workers, daily attendance, and payroll runs.
          Payroll lines are pre-filled from attendance, then editable
          before posting.
        </p>
      </header>

      <PeopleHub
        locationId={active.id}
        workers={workers}
        attendance={attendance}
        todayAttendance={todayAttendance}
        payrollRuns={payrollRuns}
        payrollLinesByRun={linesByRun}
        currency={settings.currency.value}
      />
    </div>
  );
}
