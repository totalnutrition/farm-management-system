import { cookies } from "next/headers";
import { createClient } from "./supabase-server";
import {
  DEFAULT_SETTINGS,
  type Animal,
  type AnimalEvent,
  type HerdSettings,
} from "./herd";

const ANIMAL_COLS =
  "id, tag, name, sex, breed, birth_date, status, current_pen, lactation_number, repro_status, last_calving_at, last_bred_at, last_event_at";

// RLS scopes every read to the caller's organization automatically (#6).
export async function loadHerd(): Promise<{
  animals: Animal[];
  settings: HerdSettings;
}> {
  const supabase = createClient(await cookies());
  const [{ data: animals }, { data: settings }] = await Promise.all([
    supabase.from("animals").select(ANIMAL_COLS).order("tag"),
    supabase.from("herd_settings").select("*").maybeSingle(),
  ]);
  return {
    animals: (animals ?? []) as Animal[],
    settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) } as HerdSettings,
  };
}

export async function loadAnimalByTag(tag: string): Promise<{
  animal: Animal | null;
  events: AnimalEvent[];
}> {
  const supabase = createClient(await cookies());
  const { data: animal } = await supabase
    .from("animals")
    .select(ANIMAL_COLS)
    .eq("tag", tag)
    .maybeSingle();
  if (!animal) return { animal: null, events: [] };
  const { data: events } = await supabase
    .from("animal_events")
    .select("id, animal_id, event_type, event_date, data, corrects_event_id, note, created_at")
    .eq("animal_id", (animal as Animal).id)
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false });
  return {
    animal: animal as Animal,
    events: (events ?? []) as AnimalEvent[],
  };
}
