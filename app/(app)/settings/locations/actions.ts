"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
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
} from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const farmTypeSchema = z.enum([
  FarmTypeDairy,
  FarmTypeSheepGoat,
  FarmTypePoultry,
  FarmTypeOther,
]);

const statusSchema = z.enum([LocationStatusActive, LocationStatusArchived]);

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
  latitude: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => v === "" || !Number.isNaN(Number(v)), "Latitude must be a number.")
    .refine(
      (v) => v === "" || (Number(v) >= -90 && Number(v) <= 90),
      "Latitude must be between -90 and 90.",
    ),
  longitude: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => v === "" || !Number.isNaN(Number(v)), "Longitude must be a number.")
    .refine(
      (v) => v === "" || (Number(v) >= -180 && Number(v) <= 180),
      "Longitude must be between -180 and 180.",
    ),
  status: statusSchema.default(LocationStatusActive),
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
  };
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

  const admin = createAdminClient();
  const { error } = await admin.from("locations").insert({
    organization_id: orgId,
    ...toRow(parsed.data),
  });
  if (error) return { error: error.message };

  revalidatePath(PathSettingsLocations);
  return { success: true };
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
