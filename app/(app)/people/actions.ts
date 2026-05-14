"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole } from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";

type Result = { error?: string; success?: boolean; id?: string };

// -------------------------------------------------------------------
// Workers CRUD
// -------------------------------------------------------------------
const workerSchema = z.object({
  id: z.string().uuid().optional(),
  location_id: z.string().uuid(),
  full_name: z.string().min(1, "Name required.").max(120),
  national_id: z.string().max(60).nullable().optional(),
  phone: z.string().max(60).nullable().optional(),
  role: z.string().max(60).nullable().optional(),
  hire_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  base_wage_amount: z.number().min(0).nullable().optional(),
  wage_period: z.enum(["daily", "weekly", "monthly"]).optional(),
  is_active: z.boolean().optional(),
});
export type WorkerInput = z.infer<typeof workerSchema>;

export async function upsertWorker(input: WorkerInput): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = workerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const row = {
    location_id: parsed.data.location_id,
    full_name: parsed.data.full_name,
    national_id: parsed.data.national_id ?? null,
    phone: parsed.data.phone ?? null,
    role: parsed.data.role ?? null,
    hire_date: parsed.data.hire_date ?? null,
    end_date: parsed.data.end_date ?? null,
    base_wage_amount: parsed.data.base_wage_amount ?? null,
    wage_period: parsed.data.wage_period ?? "monthly",
    is_active: parsed.data.is_active ?? true,
  };
  const { error, data } = parsed.data.id
    ? await admin.from("workers").update(row).eq("id", parsed.data.id).select("id").single()
    : await admin.from("workers").insert(row).select("id").single();
  if (error) return { error: error.message };

  revalidatePath("/people");
  return { success: true, id: data?.id as string };
}

export async function deleteWorker(id: string): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const admin = createAdminClient();
  const { error } = await admin.from("workers").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/people");
  return { success: true };
}

// -------------------------------------------------------------------
// Attendance
// -------------------------------------------------------------------
const attendanceSchema = z.object({
  worker_id: z.string().uuid(),
  occurred_date: z.string().min(1),
  status: z.enum(["present", "absent", "leave", "half_day"]),
  hours_worked: z.number().min(0).max(24).nullable().optional(),
  shift: z.string().max(40).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});
export type AttendanceInput = z.infer<typeof attendanceSchema>;

export async function upsertAttendance(input: AttendanceInput): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = attendanceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  // unique on (worker_id, occurred_date, shift) — null shift uses single row.
  const { error } = await admin.from("attendance_events").upsert(
    {
      worker_id: parsed.data.worker_id,
      occurred_date: parsed.data.occurred_date,
      status: parsed.data.status,
      hours_worked: parsed.data.hours_worked ?? null,
      shift: parsed.data.shift ?? null,
      note: parsed.data.note ?? null,
    },
    { onConflict: "worker_id,occurred_date,shift" },
  );
  if (error) return { error: error.message };
  revalidatePath("/people");
  return { success: true };
}

export async function deleteAttendance(id: string): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const admin = createAdminClient();
  const { error } = await admin.from("attendance_events").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/people");
  return { success: true };
}

// -------------------------------------------------------------------
// Payroll runs (with auto-derived lines from attendance)
// -------------------------------------------------------------------
const payrollRunSchema = z.object({
  location_id: z.string().uuid(),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  note: z.string().max(500).nullable().optional(),
});
export type PayrollRunInput = z.infer<typeof payrollRunSchema>;

/**
 * Creates a draft payroll_run for the period and pre-fills payroll_lines for
 * every active worker, computing days_present and hours_worked from
 * attendance_events. Gross/deductions/advances start at 0; the user can
 * edit each line before posting.
 */
export async function createPayrollRun(input: PayrollRunInput): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = payrollRunSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  if (parsed.data.period_end < parsed.data.period_start) {
    return { error: "End date must be on or after start date." };
  }

  const admin = createAdminClient();
  const { data: run, error: runErr } = await admin
    .from("payroll_runs")
    .insert({
      location_id: parsed.data.location_id,
      period_start: parsed.data.period_start,
      period_end: parsed.data.period_end,
      status: "draft",
      note: parsed.data.note ?? null,
    })
    .select("id")
    .single();
  if (runErr) return { error: runErr.message };

  // Pull active workers + their attendance in window.
  const [{ data: workers }, { data: events }] = await Promise.all([
    admin
      .from("workers")
      .select("id, base_wage_amount, wage_period")
      .eq("location_id", parsed.data.location_id)
      .eq("is_active", true),
    admin
      .from("attendance_events")
      .select("worker_id, occurred_date, status, hours_worked")
      .gte("occurred_date", parsed.data.period_start)
      .lte("occurred_date", parsed.data.period_end),
  ]);

  type Agg = { days: number; hours: number };
  const aggByWorker = new Map<string, Agg>();
  for (const e of events ?? []) {
    const agg = aggByWorker.get(e.worker_id as string) ?? { days: 0, hours: 0 };
    if (e.status === "present") agg.days += 1;
    else if (e.status === "half_day") agg.days += 0.5;
    if (e.hours_worked) agg.hours += Number(e.hours_worked);
    aggByWorker.set(e.worker_id as string, agg);
  }

  const periodStart = new Date(parsed.data.period_start);
  const periodEnd = new Date(parsed.data.period_end);
  const periodDays = Math.max(
    1,
    Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1,
  );

  const lines = (workers ?? []).map((w) => {
    const agg = aggByWorker.get(w.id as string) ?? { days: 0, hours: 0 };
    const baseWage = w.base_wage_amount !== null && w.base_wage_amount !== undefined
      ? Number(w.base_wage_amount)
      : 0;
    const period = (w.wage_period as string | null) ?? "monthly";
    let gross = 0;
    if (baseWage > 0 && agg.days > 0) {
      if (period === "daily") gross = baseWage * agg.days;
      else if (period === "weekly") gross = (baseWage / 7) * agg.days;
      else gross = (baseWage / periodDays) * agg.days;
    }
    return {
      payroll_run_id: run!.id,
      worker_id: w.id as string,
      days_present: agg.days,
      hours_worked: agg.hours,
      gross_amount: Number(gross.toFixed(2)),
      deductions_amount: 0,
      advances_amount: 0,
    };
  });

  if (lines.length > 0) {
    const { error: linesErr } = await admin.from("payroll_lines").insert(lines);
    if (linesErr) return { error: linesErr.message };
  }

  void user; // operator-tracking is a follow-up
  revalidatePath("/people");
  return { success: true, id: run!.id as string };
}

const payrollLineSchema = z.object({
  id: z.string().uuid(),
  gross_amount: z.number().min(0),
  deductions_amount: z.number().min(0),
  advances_amount: z.number().min(0),
  note: z.string().max(500).nullable().optional(),
});
export type PayrollLineInput = z.infer<typeof payrollLineSchema>;

export async function updatePayrollLine(input: PayrollLineInput): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = payrollLineSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("payroll_lines")
    .update({
      gross_amount: parsed.data.gross_amount,
      deductions_amount: parsed.data.deductions_amount,
      advances_amount: parsed.data.advances_amount,
      note: parsed.data.note ?? null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };
  revalidatePath("/people");
  return { success: true };
}

export async function setPayrollRunStatus(
  id: string,
  status: "draft" | "posted" | "paid",
): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const admin = createAdminClient();
  const { error } = await admin.from("payroll_runs").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/people");
  return { success: true };
}

export async function deletePayrollRun(id: string): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const admin = createAdminClient();
  const { error } = await admin.from("payroll_runs").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/people");
  return { success: true };
}
