"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import {
  RoleAdmin,
  RoleSuperAdmin,
  SetupStepRecording,
  pathLocationSetupStep,
} from "@/lib/misc";
import {
  BulkTankFrequencies,
  ComponentSamplingMethods,
  MilkingsPerDay,
  RecordingMethods,
  RecordingProfileDefaults,
  TestDayFrequencies,
  type RecordingProfile,
} from "@/lib/recording-profile";

type Result = { error?: string; success?: boolean };

const recordingSchema = z.object({
  location_id: z.uuid(),
  test_day_frequency: z.enum(TestDayFrequencies.map((t) => t.value) as [string, ...string[]]),
  daily_recording_enabled: z.boolean(),
  milkings_per_day: z.enum(MilkingsPerDay.map((m) => m.value) as [string, ...string[]]),
  recording_method: z.enum(RecordingMethods.map((m) => m.value) as [string, ...string[]]),
  bulk_tank_recording: z.enum(BulkTankFrequencies.map((b) => b.value) as [string, ...string[]]),
  component_sampling: z.enum(ComponentSamplingMethods.map((c) => c.value) as [string, ...string[]]),
  notes: z.string().trim().optional().default(""),
});

async function authorizeForLocation(locationId: string) {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  const admin = createAdminClient();
  const { data } = await admin
    .from("locations")
    .select("id, organization_id, setup_step")
    .eq("id", locationId)
    .single();

  if (!data) return { error: "Location not found." as const };
  if (role !== RoleSuperAdmin && data.organization_id !== orgId) {
    return { error: "You can only modify your own organization's locations." as const };
  }
  return { admin, location: data };
}

export async function getRecordingProfile(
  locationId: string,
): Promise<RecordingProfile> {
  const authz = await authorizeForLocation(locationId);
  if ("error" in authz) return RecordingProfileDefaults;

  const { data } = await authz.admin
    .from("recording_profiles")
    .select(
      "test_day_frequency, daily_recording_enabled, milkings_per_day, recording_method, bulk_tank_recording, component_sampling, notes",
    )
    .eq("location_id", locationId)
    .maybeSingle();

  if (!data) return RecordingProfileDefaults;

  return {
    test_day_frequency: data.test_day_frequency as RecordingProfile["test_day_frequency"],
    daily_recording_enabled: data.daily_recording_enabled as boolean,
    milkings_per_day: data.milkings_per_day as RecordingProfile["milkings_per_day"],
    recording_method: data.recording_method as RecordingProfile["recording_method"],
    bulk_tank_recording: data.bulk_tank_recording as RecordingProfile["bulk_tank_recording"],
    component_sampling: data.component_sampling as RecordingProfile["component_sampling"],
    notes: (data.notes as string | null) ?? null,
  };
}

export async function upsertRecordingProfile(
  input: z.infer<typeof recordingSchema>,
): Promise<Result> {
  const parsed = recordingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const authz = await authorizeForLocation(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };

  const payload = {
    location_id: parsed.data.location_id,
    test_day_frequency: parsed.data.test_day_frequency,
    daily_recording_enabled: parsed.data.daily_recording_enabled,
    milkings_per_day: parsed.data.milkings_per_day,
    recording_method: parsed.data.recording_method,
    bulk_tank_recording: parsed.data.bulk_tank_recording,
    component_sampling: parsed.data.component_sampling,
    notes: parsed.data.notes || null,
  };

  const { error } = await authz.admin
    .from("recording_profiles")
    .upsert(payload, { onConflict: "location_id" });
  if (error) return { error: error.message };

  revalidatePath(`/settings/locations/${parsed.data.location_id}/recording`);
  revalidatePath(
    pathLocationSetupStep(parsed.data.location_id, SetupStepRecording),
  );
  return { success: true };
}

/**
 * Wizard variant: save the profile, advance the setup_step pointer to
 * the next step, and redirect there.
 */
export async function upsertRecordingProfileAndAdvance(
  input: z.infer<typeof recordingSchema> & { nextStep: string },
): Promise<void> {
  const { nextStep, ...rest } = input;
  const result = await upsertRecordingProfile(rest);
  if (result.error) {
    throw new Error(result.error);
  }

  const authz = await authorizeForLocation(rest.location_id);
  if ("error" in authz) return;

  await authz.admin
    .from("locations")
    .update({
      setup_step: nextStep,
      setup_completed_at: nextStep === "done" ? new Date().toISOString() : null,
    })
    .eq("id", rest.location_id);

  if (nextStep === "done") {
    redirect(`/settings/locations/${rest.location_id}`);
  }
  redirect(`/settings/locations/${rest.location_id}/setup/${nextStep}`);
}
