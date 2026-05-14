"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole } from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const milkingSchema = z.object({
  location_id: z.string().uuid(),
  animal_id: z.string().uuid(),
  milking_at: z.string().min(1),
  milking_session: z.number().int().min(1).max(6).nullable().optional(),
  yield_kg: z.number().nonnegative(),
  conductivity: z.number().nullable().optional(),
  fat_pct: z.number().nullable().optional(),
  protein_pct: z.number().nullable().optional(),
});
export type MilkingInput = z.infer<typeof milkingSchema>;

export async function createMilking(input: MilkingInput): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = milkingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const { error } = await admin.from("milkings").insert({
    location_id: parsed.data.location_id,
    animal_id: parsed.data.animal_id,
    milking_at: parsed.data.milking_at,
    milking_session: parsed.data.milking_session ?? null,
    yield_kg: parsed.data.yield_kg,
    conductivity: parsed.data.conductivity ?? null,
    fat_pct: parsed.data.fat_pct ?? null,
    protein_pct: parsed.data.protein_pct ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/milk");
  return { success: true };
}

export async function deleteMilking(id: string): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const admin = createAdminClient();
  const { error } = await admin.from("milkings").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/milk");
  return { success: true };
}

const testDaySchema = z.object({
  animal_id: z.string().uuid(),
  test_date: z.string().min(1),
  milk_kg: z.number().nonnegative(),
  fat_pct: z.number().nullable().optional(),
  protein_pct: z.number().nullable().optional(),
  lactose_pct: z.number().nullable().optional(),
  scc: z.number().int().nullable().optional(),
  mun: z.number().nullable().optional(),
  test_plan: z.string().max(40).nullable().optional(),
  milkings_per_day: z.number().int().min(1).max(6).nullable().optional(),
});
export type TestDayInput = z.infer<typeof testDaySchema>;

export async function createTestDay(input: TestDayInput): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = testDaySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const { error } = await admin.from("test_days").upsert(
    {
      animal_id: parsed.data.animal_id,
      test_date: parsed.data.test_date,
      milk_kg: parsed.data.milk_kg,
      fat_pct: parsed.data.fat_pct ?? null,
      protein_pct: parsed.data.protein_pct ?? null,
      lactose_pct: parsed.data.lactose_pct ?? null,
      scc: parsed.data.scc ?? null,
      mun: parsed.data.mun ?? null,
      test_plan: parsed.data.test_plan ?? null,
      milkings_per_day: parsed.data.milkings_per_day ?? null,
    },
    { onConflict: "animal_id,test_date" },
  );
  if (error) return { error: error.message };
  revalidatePath("/milk");
  return { success: true };
}

export async function deleteTestDay(id: string): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const admin = createAdminClient();
  const { error } = await admin.from("test_days").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/milk");
  return { success: true };
}
