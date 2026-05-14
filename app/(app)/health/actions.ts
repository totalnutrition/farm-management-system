"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole } from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

// -------------------------------------------------------------------
// Health event (diagnosis / treatment / hoof_trim).
// Vaccinations go through /vaccinations/actions.ts which writes to
// vaccination_events. Here we cover the catch-all health_events table.
// -------------------------------------------------------------------
const eventSchema = z.object({
  location_id: z.string().uuid(),
  animal_id: z.string().uuid(),
  event_date: z.string().min(1),
  event_type: z.enum(["diagnosis", "treatment", "hoof_trim"]),
  diagnosis_code: z.string().max(40).nullable().optional(),
  diagnosis_text: z.string().max(200).nullable().optional(),
  severity: z.number().int().min(1).max(5).nullable().optional(),
  quarter: z.string().max(20).nullable().optional(),
  vet_medicine_id: z.string().uuid().nullable().optional(),
  drug_dose_amount: z.number().min(0).nullable().optional(),
  drug_dose_unit: z.string().max(20).nullable().optional(),
  route_code: z.string().max(20).nullable().optional(),
  locomotion_score: z.number().int().min(1).max(5).nullable().optional(),
  prescribing_vet: z.string().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
export type HealthEventInput = z.infer<typeof eventSchema>;

async function ensureVetStockItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  locationId: string,
  vetMedicineId: string,
): Promise<
  { id: string; name: string; milkH: number | null; meatD: number | null } | { error: string }
> {
  const { data: med } = await admin
    .from("org_vet_medicines")
    .select("name, withdrawal_milk_hours, withdrawal_meat_days")
    .eq("id", vetMedicineId)
    .maybeSingle();
  if (!med) return { error: "Vet medicine not found." };
  const { data: existing } = await admin
    .from("stock_items")
    .select("id")
    .eq("location_id", locationId)
    .eq("kind", "vet_medicine")
    .eq("vet_medicine_id", vetMedicineId)
    .maybeSingle();
  if (existing?.id) {
    return {
      id: existing.id as string,
      name: med.name as string,
      milkH: (med.withdrawal_milk_hours as number | null) ?? null,
      meatD: (med.withdrawal_meat_days as number | null) ?? null,
    };
  }
  const { data: created, error } = await admin
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
  if (error) return { error: error.message };
  return {
    id: created!.id as string,
    name: med.name as string,
    milkH: (med.withdrawal_milk_hours as number | null) ?? null,
    meatD: (med.withdrawal_meat_days as number | null) ?? null,
  };
}

export async function createHealthEvent(input: HealthEventInput): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const data = parsed.data;

  let withdrawalMilkEnd: string | null = null;
  let withdrawalMeatEnd: string | null = null;
  let drugName: string | null = null;
  let stockItemId: string | null = null;

  if (data.vet_medicine_id) {
    const stock = await ensureVetStockItem(admin, data.location_id, data.vet_medicine_id);
    if ("error" in stock) return { error: stock.error };
    stockItemId = stock.id;
    drugName = stock.name;
    const occurred = new Date(data.event_date);
    if (stock.milkH) {
      withdrawalMilkEnd = new Date(occurred.getTime() + stock.milkH * 3600 * 1000).toISOString();
    }
    if (stock.meatD) {
      withdrawalMeatEnd = new Date(occurred.getTime() + stock.meatD * 86400 * 1000)
        .toISOString()
        .slice(0, 10);
    }
  }

  const { data: ev, error: evErr } = await admin
    .from("health_events")
    .insert({
      animal_id: data.animal_id,
      event_date: data.event_date,
      event_type: data.event_type,
      diagnosis_code: data.diagnosis_code ?? null,
      diagnosis_text: data.diagnosis_text ?? null,
      severity: data.severity ?? null,
      quarter: data.quarter ?? null,
      drug_name: drugName,
      drug_dose_amount: data.drug_dose_amount ?? null,
      drug_dose_unit: data.drug_dose_unit ?? null,
      route_code: data.route_code ?? null,
      withdrawal_milk_end: withdrawalMilkEnd,
      withdrawal_meat_end: withdrawalMeatEnd,
      prescribing_vet: data.prescribing_vet ?? null,
      locomotion_score: data.locomotion_score ?? null,
      notes: data.notes ?? null,
    })
    .select("id")
    .single();
  if (evErr) return { error: evErr.message };

  // Deduct dose from stock if a drug was given.
  if (stockItemId && data.drug_dose_amount && data.drug_dose_amount > 0) {
    await admin.from("stock_movements").insert({
      stock_item_id: stockItemId,
      kind: "consumption",
      qty_delta: -data.drug_dose_amount,
      occurred_at: data.event_date,
      source_table: "health_events",
      source_id: ev!.id,
      operator_user_id: user.id,
      note: data.notes ?? null,
    });
  }

  revalidatePath("/health");
  revalidatePath("/stocks");
  revalidatePath("/withdrawals");
  return { success: true };
}

export async function deleteHealthEvent(id: string): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const admin = createAdminClient();
  await admin
    .from("stock_movements")
    .delete()
    .eq("source_table", "health_events")
    .eq("source_id", id);
  const { error } = await admin.from("health_events").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/health");
  revalidatePath("/stocks");
  return { success: true };
}
