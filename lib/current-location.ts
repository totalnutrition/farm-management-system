import { cookies } from "next/headers";

export const CurrentLocationCookie = "current_location_id";

export async function getCurrentLocationId(): Promise<string | null> {
  const store = await cookies();
  return store.get(CurrentLocationCookie)?.value ?? null;
}
