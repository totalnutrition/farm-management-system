"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import {
  ActiveLocationCookie,
  FarmTypeDairy,
  FarmTypeOther,
  FarmTypePoultry,
  FarmTypeSheepGoat,
  LocationStatusActive,
  LocationStatusArchived,
  PathSettingsLocations,
  RoleAdmin,
  RoleSuperAdmin,
  SetupStepDone,
  SetupStepIdentity,
  SetupStepRecording,
  pathLocationDetail,
  pathLocationSetup,
} from "@/lib/misc";

type Result = { error?: string; success?: boolean; id?: string };

const farmTypeSchema = z.enum([
  FarmTypeDairy,
  FarmTypeSheepGoat,
  FarmTypePoultry,
  FarmTypeOther,
]);

const statusSchema = z.enum([LocationStatusActive, LocationStatusArchived]);

const optionalNumberString = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => v === "" || !Number.isNaN(Number(v)), `${label} must be a number.`)
    .refine(
      (v) => v === "" || (Number(v) >= min && Number(v) <= max),
      `${label} must be between ${min} and ${max}.`,
    );

const baseSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  short_code: z
    .string()
    .trim()
    .min(2, "Short code must be at least 2 characters.")
    .max(8, "Short code must be at most 8 characters.")
    .regex(/^[A-Z0-9_-]+$/i, "Use letters, numbers, dash, or underscore."),
  farm_type: farmTypeSchema,
  country: z.string().trim().optional().default(""),
  province: z.string().trim().optional().default(""),
  city: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
  latitude: optionalNumberString("Latitude", -90, 90),
  longitude: optionalNumberString("Longitude", -180, 180),
  status: statusSchema.default(LocationStatusActive),
  manages_livestock: z.boolean().default(true),
  manages_crops: z.boolean().default(false),
  livestock_area_hectares: optionalNumberString("Livestock area", 0, 1_000_000),
  arable_area_hectares: optionalNumberString("Arable area", 0, 1_000_000),
  timezone: z.string().trim().optional().default(""),
});

const updateSchema = baseSchema.extend({ id: z.uuid() });

function toRow(input: z.infer<typeof baseSchema>) {
  return {
    name: input.name,
    short_code: input.short_code.toUpperCase(),
    farm_type: input.farm_type,
    country: input.country || null,
    province: input.province || null,
    city: input.city || null,
    address: input.address || null,
    latitude: input.latitude ? Number(input.latitude) : null,
    longitude: input.longitude ? Number(input.longitude) : null,
    status: input.status,
    manages_livestock: input.manages_livestock,
    manages_crops: input.manages_crops,
    livestock_area_hectares: input.livestock_area_hectares
      ? Number(input.livestock_area_hectares)
      : null,
    arable_area_hectares: input.arable_area_hectares
      ? Number(input.arable_area_hectares)
      : null,
    timezone: input.timezone || null,
  };
}

function validateModules(input: z.infer<typeof baseSchema>): string | null {
  if (!input.manages_livestock && !input.manages_crops) {
    return "Select at least one module (livestock or crops).";
  }
  return null;
}

export async function createLocation(
  input: z.infer<typeof baseSchema>,
): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  if (role !== RoleSuperAdmin && !orgId) {
    return { error: "Your account is not linked to an organization." };
  }

  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  if (parsed.data.farm_type !== FarmTypeDairy) {
    return { error: "Only Dairy Farm is supported in this release." };
  }
  const moduleError = validateModules(parsed.data);
  if (moduleError) return { error: moduleError };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("locations")
    .insert({
      organization_id: orgId,
      ...toRow(parsed.data),
      setup_step: SetupStepRecording,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath(PathSettingsLocations);
  return { success: true, id: data?.id as string };
}

export async function updateLocation(
  input: z.infer<typeof updateSchema>,
): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  if (parsed.data.farm_type !== FarmTypeDairy) {
    return { error: "Only Dairy Farm is supported in this release." };
  }
  const moduleError = validateModules(parsed.data);
  if (moduleError) return { error: moduleError };

  const admin = createAdminClient();

  if (role !== RoleSuperAdmin) {
    const { data: existing } = await admin
      .from("locations")
      .select("organization_id")
      .eq("id", parsed.data.id)
      .single();
    if (!existing || existing.organization_id !== orgId) {
      return { error: "You can only edit your own organization's locations." };
    }
  }

  const { id, ...rest } = parsed.data;
  const { error } = await admin
    .from("locations")
    .update(toRow(rest))
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(PathSettingsLocations);
  revalidatePath(pathLocationDetail(id));
  return { success: true };
}

export async function deleteLocation(id: string): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  const admin = createAdminClient();
  if (role !== RoleSuperAdmin) {
    const { data: existing } = await admin
      .from("locations")
      .select("organization_id")
      .eq("id", id)
      .single();
    if (!existing || existing.organization_id !== orgId) {
      return { error: "You can only delete your own organization's locations." };
    }
  }

  const { error } = await admin.from("locations").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(PathSettingsLocations);
  return { success: true };
}

export async function setActiveLocation(id: string): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const jar = await cookies();
  jar.set(ActiveLocationCookie, id, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { success: true };
}

// ---------- Wizard ----------

const setupStepSchema = z.enum([
  SetupStepIdentity,
  SetupStepRecording,
  "import_choice",
  "import",
  "herd_profile",
  "group_strategy",
  "rules",
  "capacity_plan",
  "barns",
  "pens",
  "arable_parcels",
  SetupStepDone,
]);

async function loadLocationForAdmin(id: string) {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("locations")
    .select("id, organization_id")
    .eq("id", id)
    .single();

  if (!existing) return { error: "Location not found." as const };
  if (role !== RoleSuperAdmin && existing.organization_id !== orgId) {
    return { error: "You can only modify your own organization's locations." as const };
  }
  return { admin, location: existing };
}

export async function advanceSetupStep(input: {
  id: string;
  to: z.infer<typeof setupStepSchema>;
}): Promise<Result> {
  const parsed = z
    .object({ id: z.uuid(), to: setupStepSchema })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const loaded = await loadLocationForAdmin(parsed.data.id);
  if ("error" in loaded) return { error: loaded.error };

  const isDone = parsed.data.to === SetupStepDone;
  const { error } = await loaded.admin
    .from("locations")
    .update({
      setup_step: parsed.data.to,
      setup_completed_at: isDone ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath(pathLocationDetail(parsed.data.id));
  revalidatePath(pathLocationSetup(parsed.data.id));
  return { success: true };
}

export async function skipSetup(id: string): Promise<void> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return;

  const loaded = await loadLocationForAdmin(id);
  if ("error" in loaded) return;

  await loaded.admin
    .from("locations")
    .update({
      setup_step: SetupStepDone,
      setup_completed_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath(pathLocationDetail(id));
  redirect(pathLocationDetail(id));
}
