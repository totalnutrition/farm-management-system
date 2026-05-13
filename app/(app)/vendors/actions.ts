"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole } from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const inputSchema = z.object({
  id: z.string().uuid().optional(),
  location_id: z.string().uuid(),
  name: z.string().min(1, "Name is required.").max(120),
  category: z
    .enum(["feed", "vet", "semen", "equipment", "forage", "service", "other"])
    .nullable()
    .optional(),
  contact_email: z.string().max(200).nullable().optional(),
  contact_phone: z.string().max(60).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  payment_terms: z.string().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
export type VendorInput = z.infer<typeof inputSchema>;

export async function upsertVendor(input: VendorInput): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const row = {
    location_id: parsed.data.location_id,
    name: parsed.data.name,
    category: parsed.data.category ?? null,
    contact_email: parsed.data.contact_email ?? null,
    contact_phone: parsed.data.contact_phone ?? null,
    address: parsed.data.address ?? null,
    payment_terms: parsed.data.payment_terms ?? null,
    notes: parsed.data.notes ?? null,
  };
  const { error } = parsed.data.id
    ? await admin.from("location_suppliers").update(row).eq("id", parsed.data.id)
    : await admin.from("location_suppliers").insert(row);
  if (error) return { error: error.message };

  revalidatePath("/vendors");
  revalidatePath("/procurement");
  return { success: true };
}

export async function deleteVendor(id: string): Promise<Result> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const admin = createAdminClient();
  const { error } = await admin.from("location_suppliers").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/vendors");
  revalidatePath("/procurement");
  return { success: true };
}
