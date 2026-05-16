"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathHealth } from "@/lib/misc";
import { TREAT_EC } from "@/lib/derive/health";

type Result = { error?: string; success?: boolean };

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const drugSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  milkDays: z.coerce.number().int().min(0),
  meatDays: z.coerce.number().int().min(0),
  route: z.string().trim().optional(),
});

export async function createDrug(
  input: z.infer<typeof drugSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = drugSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { name, milkDays, meatDays, route } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.from("subjects").insert({
    organization_id: orgId,
    subject_type: "drug",
    natural_key: name,
    attrs: { milk_days: milkDays, meat_days: meatDays, route: route ?? null },
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `Drug “${name}” already exists.` };
    return { error: error.message };
  }
  revalidatePath(PathHealth);
  return { success: true };
}

export async function deleteDrug(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("subject_type", "drug");
  if (error) return { error: error.message };
  revalidatePath(PathHealth);
  return { success: true };
}

const treatSchema = z.object({
  animalId: z.string().trim().min(1),
  drug: z.string().trim().min(1),
  date: z.string().trim().min(1),
  dose: z.string().trim().optional(),
});

export async function recordTreatment(
  input: z.infer<typeof treatSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = treatSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { animalId, drug, date, dose } = parsed.data;

  const admin = createAdminClient();
  const { data: animal } = await admin
    .from("subjects")
    .select("id")
    .eq("organization_id", orgId)
    .eq("subject_type", "animal")
    .eq("natural_key", animalId)
    .maybeSingle();
  if (!animal) return { error: `Animal ${animalId} not found.` };

  const { data: dr } = await admin
    .from("subjects")
    .select("attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "drug")
    .eq("natural_key", drug)
    .maybeSingle();
  if (!dr) return { error: `Drug “${drug}” not found.` };
  const a = (dr.attrs ?? {}) as Record<string, unknown>;
  const milkDays = typeof a.milk_days === "number" ? a.milk_days : 0;
  const meatDays = typeof a.meat_days === "number" ? a.meat_days : 0;

  const { error } = await admin.from("events").insert({
    organization_id: orgId,
    subject_id: animal.id,
    event_code: TREAT_EC,
    event_date: date,
    payload: {
      drug,
      dose: dose ?? null,
      mwUntil: addDays(date, milkDays),
      bwUntil: addDays(date, meatDays),
    },
    source: "user",
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(PathHealth);
  return { success: true };
}
