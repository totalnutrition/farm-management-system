"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const readingSchema = z.object({
  location_id: z.uuid(),
  reading_date: z.string().min(10),
  volume_kg: z.number().min(0).nullable(),
  fat_pct: z.number().min(0).max(20).nullable(),
  protein_pct: z.number().min(0).max(20).nullable(),
  scc: z.number().int().min(0).nullable(),
  notes: z.string().nullable(),
});

const diversionSchema = z.object({
  location_id: z.uuid(),
  diversion_date: z.string().min(10),
  kg: z.number().min(0),
  bucket: z.enum(["hospital", "calves", "waste", "dumped", "spilled", "other"]),
  notes: z.string().nullable(),
});

async function authorize(locationId: string) {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);
  const admin = createAdminClient();
  const { data } = await admin
    .from("locations")
    .select("id, organization_id")
    .eq("id", locationId)
    .single();
  if (!data) return { error: "Location not found." as const };
  if (role !== RoleSuperAdmin && data.organization_id !== orgId) {
    return { error: "Cross-org access denied." as const };
  }
  return { admin };
}

export type TankReading = {
  id: string;
  reading_date: string;
  volume_kg: number | null;
  fat_pct: number | null;
  protein_pct: number | null;
  scc: number | null;
  notes: string | null;
};

export type Diversion = {
  id: string;
  diversion_date: string;
  kg: number;
  bucket: string;
  notes: string | null;
};

export async function listTankReadings(locationId: string): Promise<TankReading[]> {
  const authz = await authorize(locationId);
  if ("error" in authz) return [];
  const { data } = await authz.admin
    .from("bulk_tank_readings")
    .select("id, reading_date, volume_kg, fat_pct, protein_pct, scc, notes")
    .eq("location_id", locationId)
    .order("reading_date", { ascending: false })
    .limit(60);
  return (data ?? []) as TankReading[];
}

export async function listDiversions(locationId: string): Promise<Diversion[]> {
  const authz = await authorize(locationId);
  if ("error" in authz) return [];
  const { data } = await authz.admin
    .from("milk_diversions")
    .select("id, diversion_date, kg, bucket, notes")
    .eq("location_id", locationId)
    .order("diversion_date", { ascending: false })
    .limit(60);
  return (data ?? []) as Diversion[];
}

export async function recordTankReading(
  input: z.infer<typeof readingSchema>,
): Promise<Result> {
  const parsed = readingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const authz = await authorize(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin.from("bulk_tank_readings").upsert(
    {
      location_id: parsed.data.location_id,
      reading_date: parsed.data.reading_date,
      volume_kg: parsed.data.volume_kg,
      fat_pct: parsed.data.fat_pct,
      protein_pct: parsed.data.protein_pct,
      scc: parsed.data.scc,
      notes: parsed.data.notes,
    },
    { onConflict: "location_id,reading_date" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/bulk-tank`);
  return { success: true };
}

export async function recordDiversion(
  input: z.infer<typeof diversionSchema>,
): Promise<Result> {
  const parsed = diversionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const authz = await authorize(parsed.data.location_id);
  if ("error" in authz) return { error: authz.error };
  const { error } = await authz.admin.from("milk_diversions").insert({
    location_id: parsed.data.location_id,
    diversion_date: parsed.data.diversion_date,
    kg: parsed.data.kg,
    bucket: parsed.data.bucket,
    notes: parsed.data.notes,
  });
  if (error) return { error: error.message };
  revalidatePath(`/settings/locations/${parsed.data.location_id}/bulk-tank`);
  return { success: true };
}
