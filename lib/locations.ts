import { cookies } from "next/headers";
import { createAdminClient } from "./supabase-admin";
import {
  ActiveLocationCookie,
  type FarmType,
  type LocationStatus,
  RoleSuperAdmin,
} from "./misc";
import {
  getCurrentUser,
  getOrganizationIdFromUser,
  getRoleFromUser,
} from "./supabase-auth";

export type LocationRow = {
  id: string;
  organization_id: string;
  name: string;
  short_code: string;
  farm_type: FarmType;
  country: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: LocationStatus;
  manages_livestock: boolean;
  manages_crops: boolean;
};

const SELECT_COLS =
  "id, organization_id, name, short_code, farm_type, country, province, city, address, latitude, longitude, status, manages_livestock, manages_crops";

/**
 * Returns the locations the current user is allowed to see. Admins of an
 * organization see every location in their org; non-admin users see only
 * the ones in location_members.
 */
export async function listAccessibleLocations(): Promise<LocationRow[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  const admin = createAdminClient();

  if (role === RoleSuperAdmin) {
    const { data } = await admin
      .from("locations")
      .select(SELECT_COLS)
      .order("name");
    return (data ?? []) as LocationRow[];
  }

  if (!orgId) return [];

  if (role === "admin") {
    const { data } = await admin
      .from("locations")
      .select(SELECT_COLS)
      .eq("organization_id", orgId)
      .order("name");
    return (data ?? []) as LocationRow[];
  }

  // Non-admin: only locations they're explicitly granted.
  const { data: grants } = await admin
    .from("location_members")
    .select("location_id")
    .eq("user_id", user.id);
  const ids = (grants ?? []).map((g) => g.location_id as string);
  if (ids.length === 0) return [];

  const { data } = await admin
    .from("locations")
    .select(SELECT_COLS)
    .in("id", ids)
    .order("name");
  return (data ?? []) as LocationRow[];
}

/**
 * Resolves the currently active location for the user — preferring the
 * cookie selection, falling back to the first accessible location.
 */
export async function getActiveLocation(): Promise<LocationRow | null> {
  const list = await listAccessibleLocations();
  if (list.length === 0) return null;

  const jar = await cookies();
  const cookieId = jar.get(ActiveLocationCookie)?.value;
  if (cookieId) {
    const hit = list.find((l) => l.id === cookieId);
    if (hit) return hit;
  }
  return list[0];
}
