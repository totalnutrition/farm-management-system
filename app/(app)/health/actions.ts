"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathHealth, PathSupply } from "@/lib/misc";
import { TREAT_EC } from "@/lib/derive/health";
import {
  applySupplyMovement,
  checkSupplyShortages,
  shortageMessage,
} from "@/lib/supply-usage";

type Result = { error?: string; success?: boolean };

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Drugs are Supply Chain items (category "Veterinary Drugs &
// Vaccines"). Health no longer creates or deletes them — it owns
// only the clinical layer: milk/meat withhold days and route, which
// it writes back onto the Supply item's attrs.
const clinicalSchema = z.object({
  id: z.uuid(),
  milkDays: z.coerce.number().int().min(0),
  meatDays: z.coerce.number().int().min(0),
  route: z.string().trim().optional(),
});

export async function updateDrugClinical(
  input: z.infer<typeof clinicalSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = clinicalSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { id, milkDays, meatDays, route } = parsed.data;

  const admin = createAdminClient();
  const { data: item } = await admin
    .from("subjects")
    .select("attrs")
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("subject_type", "supply_item")
    .maybeSingle();
  if (!item) return { error: "Drug not found in Supply Chain." };
  const attrs = (item.attrs ?? {}) as Record<string, unknown>;

  const { error } = await admin
    .from("subjects")
    .update({
      attrs: {
        ...attrs,
        milk_days: milkDays,
        meat_days: meatDays,
        route: route ?? null,
      },
    })
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("subject_type", "supply_item");
  if (error) return { error: error.message };
  revalidatePath(PathHealth);
  revalidatePath(PathSupply);
  return { success: true };
}

const treatSchema = z.object({
  animalId: z.string().trim().min(1),
  drug: z.string().trim().min(1),
  date: z.string().trim().min(1),
  dose: z.string().trim().optional(),
  qty: z.coerce.number().positive().optional(),
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
  const { animalId, drug, date, dose, qty } = parsed.data;

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
    .eq("subject_type", "supply_item")
    .eq("natural_key", drug)
    .maybeSingle();
  if (!dr) return { error: `Drug “${drug}” not found in Supply Chain.` };
  const a = (dr.attrs ?? {}) as Record<string, unknown>;
  const milkDays = typeof a.milk_days === "number" ? a.milk_days : 0;
  const meatDays = typeof a.meat_days === "number" ? a.meat_days : 0;

  const need = qty ?? 1;
  const short = await checkSupplyShortages(admin, orgId, [
    { itemName: drug, qty: need },
  ]);
  if (short.length) return { error: shortageMessage(short) };

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

  // Auto-deduct the drug from Supply Chain stock so on-hand stays
  // correct without a second manual entry. Defaults to 1 unit.
  await applySupplyMovement(admin, orgId, {
    itemName: drug,
    qty: need,
    date,
    direction: "use",
    ref: { treatment_animal: animalId },
  });

  revalidatePath(PathHealth);
  revalidatePath(PathSupply);
  return { success: true };
}
