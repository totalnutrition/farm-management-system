"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathViews } from "@/lib/misc";
import type { Query } from "@/lib/derive/query";
import { runQueryAction, type QueryResponse } from "../query/actions";

type Result = { error?: string; success?: boolean };

const saveSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  description: z.string().trim().optional(),
  query: z.any(),
});

export async function saveView(
  input: z.infer<typeof saveSchema>,
): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { name, description, query } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.from("views").insert({
    organization_id: orgId,
    name,
    description: description || null,
    query,
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `A view named “${name}” already exists.` };
    return { error: error.message };
  }

  revalidatePath(PathViews);
  return { success: true };
}

export async function deleteView(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("views")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };

  revalidatePath(PathViews);
  return { success: true };
}

export async function runView(query: Query): Promise<QueryResponse> {
  return runQueryAction(query);
}
