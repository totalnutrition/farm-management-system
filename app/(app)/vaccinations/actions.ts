"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole } from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const inputSchema = z.object({
  location_id: z.string().uuid(),
  animal_id: z.string().uuid().nullable().optional(),
  group_id: z.string().uuid().nullable().optional(),
  vet_medicine_id: z.string().uuid(),
  dose_ml: z.number().positive().nullable().optional(),
  route: z.string().max(40).nullable().optional(),
  occurred_at: z.string().min(1),
  note: z.string().max(500).nullable().optional(),
}).refine((v) => v.animal_id || v.group_id, {
  message: "Pick an animal or a group.",
  path: ["animal_id"],
});
export type VaccinationInput = z.infer<typeof inputSchema>;

async function ensureVetStockItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  locationId: string,
  vetMedicineId: string,
): Promise<
  { id: string; milkH: number | null; meatD: number | null } | { error: string }
> {
  const { data: med, error: medErr } = await admin
    .from("org_vet_medicines")
    .select("name, withdrawal_milk_hours, withdrawal_meat_days")
    .eq("id", vetMedicineId)
    .maybeSingle();
  if (medErr || !med) return { error: "Vet medicine not found." };

  const { data: existing } = await admin
    .from("stock_items")
    .select("id")
    .eq("location_id", locationId)
    .eq("kind", "vet_medicine")
    .eq("vet_medicine_id", vetMedicineId)
    .maybeSingle();
  if (existing?.id)
    return {
      id: existing.id as string,
      milkH: (med.withdrawal_milk_hours as number | null) ?? null,
      meatD: (med.withdrawal_meat_days as number | null) ?? null,
    };

  const { data: created, error: insErr } = await admin
    .from("stock_items")
    .insert({
      location_id: locationId,
      kind: "vet_medicine",
      vet_medicine_id: vetMedicineId,
      display_name: med.name as string,
      unit: "mL",
    })
    .select("id")
    .single();
  if (insErr) return { error: insErr.message };
  return {
    id: created!.id as string,
    milkH: (med.withdrawal_milk_hours as number | null) ?? null,
    meatD: (med.withdrawal_meat_days as number | null) ?? null,
  };
}

export async function createVaccinationEvent(input: VaccinationInput): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const stock = await ensureVetStockItem(
    admin,
    parsed.data.location_id,
    parsed.data.vet_medicine_id,
  );
  if ("error" in stock) return { error: stock.error };

  const occurred = new Date(parsed.data.occurred_at);
  const milkUntil = stock.milkH
    ? new Date(occurred.getTime() + stock.milkH * 3600 * 1000).toISOString()
    : null;
  const meatUntil = stock.meatD
    ? new Date(occurred.getTime() + stock.meatD * 86400 * 1000)
        .toISOString()
        .slice(0, 10)
    : null;

  const { data: ev, error: evErr } = await admin
    .from("vaccination_events")
    .insert({
      location_id: parsed.data.location_id,
      animal_id: parsed.data.animal_id ?? null,
      group_id: parsed.data.group_id ?? null,
      vet_medicine_id: parsed.data.vet_medicine_id,
      stock_item_id: stock.id,
      dose_ml: parsed.data.dose_ml ?? null,
      route: parsed.data.route ?? null,
      occurred_at: parsed.data.occurred_at,
      withdrawal_milk_until: milkUntil,
      withdrawal_meat_until: meatUntil,
      operator_user_id: user.id,
      note: parsed.data.note ?? null,
    })
    .select("id")
    .single();
  if (evErr) return { error: evErr.message };

  if (parsed.data.dose_ml && parsed.data.dose_ml > 0) {
    const { error: mvErr } = await admin.from("stock_movements").insert({
      stock_item_id: stock.id,
      kind: "consumption",
      qty_delta: -parsed.data.dose_ml,
      occurred_at: parsed.data.occurred_at,
      source_table: "vaccination_events",
      source_id: ev!.id,
      operator_user_id: user.id,
      note: parsed.data.note ?? null,
    });
    if (mvErr) return { error: mvErr.message };
  }

  revalidatePath("/vaccinations");
  revalidatePath("/stocks");
  revalidatePath("/withdrawals");
  return { success: true };
}

export async function deleteVaccinationEvent(id: string): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const admin = createAdminClient();
  await admin
    .from("stock_movements")
    .delete()
    .eq("source_table", "vaccination_events")
    .eq("source_id", id);
  const { error } = await admin.from("vaccination_events").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/vaccinations");
  revalidatePath("/stocks");
  return { success: true };
}
