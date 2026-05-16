"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathCommercial } from "@/lib/misc";

type Result = { error?: string; success?: boolean };
const SALE_EC = 204;
const BUY_EC = 205;

type Admin = ReturnType<typeof createAdminClient>;

async function ensureBooks(admin: Admin, orgId: string, userId: string) {
  const { data } = await admin
    .from("subjects")
    .select("id")
    .eq("organization_id", orgId)
    .eq("subject_type", "ledger")
    .eq("natural_key", "BOOKS")
    .maybeSingle();
  if (data) return data.id;
  const { data: created, error } = await admin
    .from("subjects")
    .insert({
      organization_id: orgId,
      subject_type: "ledger",
      natural_key: "BOOKS",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "books");
  return created.id;
}

const catalogSchema = z.object({
  kind: z.enum(["vendor", "customer"]),
  name: z.string().trim().min(1, "Name is required."),
});

export async function createParty(
  input: z.infer<typeof catalogSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const parsed = catalogSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { kind, name } = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin.from("subjects").insert({
    organization_id: orgId,
    subject_type: kind,
    natural_key: name,
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `${kind} “${name}” already exists.` };
    return { error: error.message };
  }
  revalidatePath(PathCommercial);
  return { success: true };
}

export async function deleteParty(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .in("subject_type", ["vendor", "customer"]);
  if (error) return { error: error.message };
  revalidatePath(PathCommercial);
  return { success: true };
}

const txnSchema = z.object({
  kind: z.enum(["sale", "purchase"]),
  category: z.string().trim().min(1),
  amount: z.coerce.number().positive("Amount must be > 0."),
  party: z.string().trim().optional(),
  date: z.string().trim().min(1),
});

export async function recordTxn(
  input: z.infer<typeof txnSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const parsed = txnSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { kind, category, amount, party, date } = parsed.data;

  const admin = createAdminClient();
  let books: string;
  try {
    books = await ensureBooks(admin, orgId, user.id);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { error } = await admin.from("events").insert({
    organization_id: orgId,
    subject_id: books,
    event_code: kind === "sale" ? SALE_EC : BUY_EC,
    event_date: date,
    payload: { category, amount, party: party ?? null },
    source: "user",
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(PathCommercial);
  return { success: true };
}
