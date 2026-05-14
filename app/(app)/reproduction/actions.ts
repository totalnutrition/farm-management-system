"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole } from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const heatSchema = z.object({
  animal_id: z.string().uuid(),
  event_date: z.string().min(1),
  notes: z.string().max(500).nullable().optional(),
});

export async function createHeat(input: z.infer<typeof heatSchema>): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = heatSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const { error } = await admin.from("repro_events").insert({
    animal_id: parsed.data.animal_id,
    event_date: parsed.data.event_date,
    event_type: "heat",
    notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/reproduction");
  return { success: true };
}

const breedingSchema = z.object({
  animal_id: z.string().uuid(),
  event_date: z.string().min(1),
  sire_naab: z.string().max(40).nullable().optional(),
  semen_straw_id: z.string().uuid().nullable().optional(),
  service_sire_animal_id: z.string().uuid().nullable().optional(),
  technician: z.string().max(120).nullable().optional(),
  sync_protocol: z.string().max(120).nullable().optional(),
  service_number: z.number().int().min(1).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function createBreeding(input: z.infer<typeof breedingSchema>): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = breedingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  // If a semen straw is linked, ensure its stock line exists + write a movement.
  let movementId: string | null = null;
  let strawStockItemId: string | null = null;
  if (parsed.data.semen_straw_id) {
    const { data: straw } = await admin
      .from("semen_straws")
      .select("id, stock_item_id, naab")
      .eq("id", parsed.data.semen_straw_id)
      .maybeSingle();
    if (!straw) return { error: "Semen straw not found." };
    strawStockItemId = straw.stock_item_id as string | null;
  }

  const { data: ev, error: evErr } = await admin
    .from("repro_events")
    .insert({
      animal_id: parsed.data.animal_id,
      event_date: parsed.data.event_date,
      event_type: "breeding",
      sire_naab: parsed.data.sire_naab ?? null,
      service_number: parsed.data.service_number ?? null,
      technician: parsed.data.technician ?? null,
      sync_protocol: parsed.data.sync_protocol ?? null,
      semen_straw_id: parsed.data.semen_straw_id ?? null,
      service_sire_animal_id: parsed.data.service_sire_animal_id ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();
  if (evErr) return { error: evErr.message };

  if (strawStockItemId) {
    const { data: mv, error: mvErr } = await admin
      .from("stock_movements")
      .insert({
        stock_item_id: strawStockItemId,
        kind: "consumption",
        qty_delta: -1,
        occurred_at: parsed.data.event_date,
        source_table: "repro_events",
        source_id: ev!.id,
        operator_user_id: user.id,
      })
      .select("id")
      .single();
    if (mvErr) return { error: mvErr.message };
    movementId = mv!.id as string;
    await admin
      .from("repro_events")
      .update({ stock_movement_id: movementId })
      .eq("id", ev!.id);
  }

  revalidatePath("/reproduction");
  revalidatePath("/stocks");
  return { success: true };
}

const pregCheckSchema = z.object({
  animal_id: z.string().uuid(),
  event_date: z.string().min(1),
  result: z.enum(["pregnant", "open", "recheck"]),
  preg_check_method: z.string().max(40).nullable().optional(),
  days_pregnant: z.number().int().min(1).max(400).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function createPregCheck(input: z.infer<typeof pregCheckSchema>): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = pregCheckSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const { error } = await admin.from("repro_events").insert({
    animal_id: parsed.data.animal_id,
    event_date: parsed.data.event_date,
    event_type: "preg_check",
    result: parsed.data.result,
    preg_check_method: parsed.data.preg_check_method ?? null,
    days_pregnant: parsed.data.days_pregnant ?? null,
    notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/reproduction");
  return { success: true };
}

const calvingSchema = z.object({
  dam_animal_id: z.string().uuid(),
  calving_date: z.string().min(1),
  parity: z.number().int().min(1).max(20),
  calving_ease: z.number().int().min(1).max(5).nullable().optional(),
  twin_flag: z.boolean().optional().default(false),
  stillborn: z.boolean().optional().default(false),
  calf_sex: z.enum(["male", "female"]).nullable().optional(),
  calf_birth_weight_kg: z.number().min(0).max(80).nullable().optional(),
  retained_placenta: z.boolean().optional().default(false),
  notes: z.string().max(500).nullable().optional(),
});

export async function createCalving(input: z.infer<typeof calvingSchema>): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = calvingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const { error } = await admin.from("calvings").insert({
    dam_animal_id: parsed.data.dam_animal_id,
    calving_date: parsed.data.calving_date,
    parity: parsed.data.parity,
    calving_ease: parsed.data.calving_ease ?? null,
    twin_flag: parsed.data.twin_flag ?? false,
    stillborn: parsed.data.stillborn ?? false,
    calf_sex: parsed.data.calf_sex ?? null,
    calf_birth_weight_kg: parsed.data.calf_birth_weight_kg ?? null,
    retained_placenta: parsed.data.retained_placenta ?? false,
    notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message };
  // Bump animal: current_lactation, last_calving_date, life_stage.
  await admin
    .from("animals")
    .update({
      last_calving_date: parsed.data.calving_date,
      current_lactation: parsed.data.parity,
      life_stage: "lactating",
    })
    .eq("id", parsed.data.dam_animal_id);

  // Insert a "fresh" repro_event for tracking.
  await admin.from("repro_events").insert({
    animal_id: parsed.data.dam_animal_id,
    event_date: parsed.data.calving_date,
    event_type: "fresh",
    parity_at_event: parsed.data.parity,
  });

  revalidatePath("/reproduction");
  revalidatePath("/animals");
  return { success: true };
}

const strawSchema = z.object({
  id: z.string().uuid().optional(),
  location_id: z.string().uuid(),
  naab: z.string().min(1, "NAAB code is required.").max(40),
  sire_name: z.string().max(120).nullable().optional(),
  breed_code: z.string().max(20).nullable().optional(),
  lot: z.string().max(60).nullable().optional(),
  tank_position: z.string().max(80).nullable().optional(),
  vendor_id: z.string().uuid().nullable().optional(),
  initial_doses: z.number().int().min(0).nullable().optional(),
  unit_cost: z.number().min(0).nullable().optional(),
});
export type SemenStrawInput = z.infer<typeof strawSchema>;

export async function upsertSemenStraw(input: SemenStrawInput): Promise<Result> {
  const user = await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = strawSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const data = parsed.data;
  const displayName = `${data.naab}${data.sire_name ? ` · ${data.sire_name}` : ""}`;

  if (data.id) {
    const { error } = await admin
      .from("semen_straws")
      .update({
        naab: data.naab,
        sire_name: data.sire_name ?? null,
        breed_code: data.breed_code ?? null,
        lot: data.lot ?? null,
        tank_position: data.tank_position ?? null,
        vendor_id: data.vendor_id ?? null,
      })
      .eq("id", data.id);
    if (error) return { error: error.message };
    revalidatePath("/reproduction");
    return { success: true };
  }

  // Provision a paired stock_items line (kind=semen_straw, unit=dose).
  const { data: stockRow, error: stockErr } = await admin
    .from("stock_items")
    .insert({
      location_id: data.location_id,
      kind: "semen_straw",
      display_name: displayName,
      unit: "dose",
      unit_cost_current: data.unit_cost ?? null,
    })
    .select("id")
    .single();
  if (stockErr) return { error: stockErr.message };

  const { data: strawRow, error: strawErr } = await admin
    .from("semen_straws")
    .insert({
      location_id: data.location_id,
      naab: data.naab,
      sire_name: data.sire_name ?? null,
      breed_code: data.breed_code ?? null,
      lot: data.lot ?? null,
      tank_position: data.tank_position ?? null,
      vendor_id: data.vendor_id ?? null,
      stock_item_id: stockRow!.id,
    })
    .select("id")
    .single();
  if (strawErr) return { error: strawErr.message };

  if (data.initial_doses && data.initial_doses > 0) {
    await admin.from("stock_movements").insert({
      stock_item_id: stockRow!.id,
      kind: "opening",
      qty_delta: data.initial_doses,
      unit_cost: data.unit_cost ?? null,
      occurred_at: new Date().toISOString(),
      source_table: "semen_straws",
      source_id: strawRow!.id,
      operator_user_id: user.id,
    });
  }

  revalidatePath("/reproduction");
  revalidatePath("/stocks");
  return { success: true };
}

export async function deleteSemenStraw(id: string): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const admin = createAdminClient();
  const { data: straw } = await admin
    .from("semen_straws")
    .select("stock_item_id")
    .eq("id", id)
    .maybeSingle();
  const { error } = await admin.from("semen_straws").delete().eq("id", id);
  if (error) return { error: error.message };
  if (straw?.stock_item_id) {
    await admin.from("stock_items").delete().eq("id", straw.stock_item_id);
  }
  revalidatePath("/reproduction");
  revalidatePath("/stocks");
  return { success: true };
}
