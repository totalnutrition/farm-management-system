"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import {
  requireAnyRole,
  getOrganizationIdFromUser,
} from "@/lib/supabase-auth";

// ENTER reuses the existing safe write actions (recordEvent,
// recordMilking, recordTreatment, recordVaccination) — those need a
// subject id, but ENTER works in animal IDs. This is the only new
// server piece: a batched, org-scoped natural_key → id resolver so
// no write logic is duplicated.
export async function resolveAnimals(ids: string[]): Promise<
  | { map: Record<string, string>; missing: string[] }
  | { error: string }
> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const uniq = [
    ...new Set(ids.map((s) => s.trim()).filter(Boolean)),
  ];
  if (uniq.length === 0) return { map: {}, missing: [] };

  const admin = createAdminClient();
  const { data } = await admin
    .from("subjects")
    .select("id, natural_key")
    .eq("organization_id", orgId)
    .eq("subject_type", "animal")
    .in("natural_key", uniq);

  const map: Record<string, string> = {};
  for (const r of data ?? []) map[r.natural_key] = r.id;
  const missing = uniq.filter((k) => !(k in map));
  return { map, missing };
}
