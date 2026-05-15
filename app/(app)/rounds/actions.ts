"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";
import { getActiveLocation } from "@/lib/locations";

type Result = { error?: string; success?: boolean };
type StartRoundResult = Result & { round_id?: string };

async function authorize() {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const active = await getActiveLocation();
  if (!active) {
    return { error: "No active location selected." as const };
  }
  const admin = createAdminClient();
  return { admin, user, active };
}

// ---------------------------------------------------------------------
// Round lifecycle
// ---------------------------------------------------------------------

const startSchema = z.object({
  supervisor_name: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function startRound(
  input: z.infer<typeof startSchema>,
): Promise<StartRoundResult> {
  const ctx = await authorize();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = startSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const orgId = getOrganizationIdFromUser(ctx.user);
  void orgId;

  const { data, error } = await ctx.admin
    .from("farm_rounds")
    .insert({
      location_id: ctx.active.id,
      supervisor_name: parsed.data.supervisor_name ?? null,
      supervisor_user_id: ctx.user.id,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not start round." };

  revalidatePath("/rounds");
  return { success: true, round_id: data.id as string };
}

export async function completeRound(roundId: string): Promise<Result> {
  const ctx = await authorize();
  if ("error" in ctx) return { error: ctx.error };
  if (!roundId) return { error: "Missing round id." };

  const { error } = await ctx.admin
    .from("farm_rounds")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", roundId)
    .eq("location_id", ctx.active.id);
  if (error) return { error: error.message };
  revalidatePath("/rounds");
  revalidatePath(`/rounds/${roundId}`);
  return { success: true };
}

export async function abandonRound(roundId: string): Promise<Result> {
  const ctx = await authorize();
  if ("error" in ctx) return { error: ctx.error };
  if (!roundId) return { error: "Missing round id." };

  const { error } = await ctx.admin
    .from("farm_rounds")
    .update({ status: "abandoned", completed_at: new Date().toISOString() })
    .eq("id", roundId)
    .eq("location_id", ctx.active.id);
  if (error) return { error: error.message };
  revalidatePath("/rounds");
  return { success: true };
}

// ---------------------------------------------------------------------
// Observations — each writes into the right specialised table and
// stamps the round_id so the cow's timeline + the Hot list pick it up.
// ---------------------------------------------------------------------

const heatSchema = z.object({
  round_id: z.string().uuid(),
  animal_id: z.string().uuid(),
  notes: z.string().trim().max(500).nullable().optional(),
});
export async function logHeat(input: z.infer<typeof heatSchema>): Promise<Result> {
  const ctx = await authorize();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = heatSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await ctx.admin.from("repro_events").insert({
    animal_id: parsed.data.animal_id,
    event_date: today,
    event_type: "heat",
    notes: parsed.data.notes ?? null,
    round_id: parsed.data.round_id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/rounds/${parsed.data.round_id}`);
  return { success: true };
}

const sickSchema = z.object({
  round_id: z.string().uuid(),
  animal_id: z.string().uuid(),
  diagnosis_text: z.string().trim().max(200).nullable().optional(),
  severity: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});
export async function logSick(input: z.infer<typeof sickSchema>): Promise<Result> {
  const ctx = await authorize();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = sickSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await ctx.admin.from("health_events").insert({
    animal_id: parsed.data.animal_id,
    event_date: today,
    event_type: "diagnosis",
    diagnosis_text: parsed.data.diagnosis_text ?? "sick (round)",
    severity: parsed.data.severity ?? null,
    notes: parsed.data.notes ?? null,
    round_id: parsed.data.round_id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/rounds/${parsed.data.round_id}`);
  return { success: true };
}

const injurySchema = z.object({
  round_id: z.string().uuid(),
  animal_id: z.string().uuid(),
  severity: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});
export async function logInjury(input: z.infer<typeof injurySchema>): Promise<Result> {
  const ctx = await authorize();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = injurySchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await ctx.admin.from("health_events").insert({
    animal_id: parsed.data.animal_id,
    event_date: today,
    event_type: "diagnosis",
    diagnosis_text: "injury",
    severity: parsed.data.severity ?? null,
    notes: parsed.data.notes ?? null,
    round_id: parsed.data.round_id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/rounds/${parsed.data.round_id}`);
  return { success: true };
}

const lameSchema = z.object({
  round_id: z.string().uuid(),
  animal_id: z.string().uuid(),
  locomotion_score: z.number().int().min(1).max(5),
  notes: z.string().trim().max(500).nullable().optional(),
});
export async function logLame(input: z.infer<typeof lameSchema>): Promise<Result> {
  const ctx = await authorize();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = lameSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await ctx.admin.from("health_events").insert({
    animal_id: parsed.data.animal_id,
    event_date: today,
    event_type: "diagnosis",
    diagnosis_text: "lameness",
    locomotion_score: parsed.data.locomotion_score,
    severity: parsed.data.locomotion_score,
    notes: parsed.data.notes ?? null,
    round_id: parsed.data.round_id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/rounds/${parsed.data.round_id}`);
  return { success: true };
}

const noteSchema = z.object({
  round_id: z.string().uuid(),
  animal_id: z.string().uuid(),
  text: z.string().trim().min(1).max(500),
});
export async function logNote(input: z.infer<typeof noteSchema>): Promise<Result> {
  const ctx = await authorize();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await ctx.admin.from("health_events").insert({
    animal_id: parsed.data.animal_id,
    event_date: today,
    event_type: "diagnosis",
    diagnosis_text: "note",
    notes: parsed.data.text,
    round_id: parsed.data.round_id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/rounds/${parsed.data.round_id}`);
  return { success: true };
}
