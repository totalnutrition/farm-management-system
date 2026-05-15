"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole } from "@/lib/supabase-auth";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";
import { getActiveLocation } from "@/lib/locations";

// ---------------------------------------------------------------------
// findAnimalByCode — single lookup entry point for both keyboard typing
// and RFID scanners. Scanners emit the ISO 11784/11785 / USDA-840
// number, which we store in animals.official_id; herdsmen also type
// the on-farm management number stored in animals.animal_id. We try
// official_id first (scanner-typical), then fall back to animal_id.
//
// Scoped to the user's active location so two cows in different
// locations sharing the same on-farm tag don't collide on lookup.
// ---------------------------------------------------------------------

export type AnimalLookupHit = {
  id: string;
  animal_id: string;
  official_id: string | null;
  name: string | null;
  sex: string;
  status: string;
  current_group_id: string | null;
  current_pen_id: string | null;
  /** Which column matched — useful for UI hints ("scanned" vs "typed"). */
  matched_via: "official_id" | "animal_id";
};

export async function findAnimalByCode(
  code: string,
): Promise<AnimalLookupHit | null> {
  await requireAnyRole([RoleSuperAdmin, RoleAdmin]);
  const trimmed = code.trim();
  if (!trimmed) return null;

  const active = await getActiveLocation();
  if (!active) return null;

  const admin = createAdminClient();

  // Try official_id (scanner format) first.
  const { data: byOfficial } = await admin
    .from("animals")
    .select(
      "id, animal_id, official_id, name, sex, status, current_group_id, current_pen_id",
    )
    .eq("location_id", active.id)
    .eq("official_id", trimmed)
    .maybeSingle();
  if (byOfficial) {
    return { ...(byOfficial as Omit<AnimalLookupHit, "matched_via">), matched_via: "official_id" };
  }

  // Fall back to on-farm management number.
  const { data: byAnimalId } = await admin
    .from("animals")
    .select(
      "id, animal_id, official_id, name, sex, status, current_group_id, current_pen_id",
    )
    .eq("location_id", active.id)
    .eq("animal_id", trimmed)
    .maybeSingle();
  if (byAnimalId) {
    return { ...(byAnimalId as Omit<AnimalLookupHit, "matched_via">), matched_via: "animal_id" };
  }

  return null;
}
