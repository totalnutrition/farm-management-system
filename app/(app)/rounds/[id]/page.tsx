import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import { getActiveLocation } from "@/lib/locations";
import { NoLocationSelected } from "@/components/no-location-selected";
import { requireAnyRole } from "@/lib/supabase-auth";
import { RoundClient, type RoundObservation } from "./round-client";

export const metadata = { title: "Round" };
export const dynamic = "force-dynamic";

export default async function RoundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAnyRole(["super_admin", "admin"]);
  const { id } = await params;
  const active = await getActiveLocation();
  if (!active) {
    return (
      <NoLocationSelected
        title="No location selected"
        hint="Rounds are scoped to the active location."
      />
    );
  }

  const admin = createAdminClient();
  const { data: round } = await admin
    .from("farm_rounds")
    .select("id, supervisor_name, started_at, completed_at, status, notes")
    .eq("id", id)
    .eq("location_id", active.id)
    .maybeSingle();
  if (!round) notFound();

  // Pull all observations made under this round across repro + health.
  const [{ data: reproRaw }, { data: healthRaw }] = await Promise.all([
    admin
      .from("repro_events")
      .select("id, animal_id, event_date, event_type, notes, created_at")
      .eq("round_id", id),
    admin
      .from("health_events")
      .select(
        "id, animal_id, event_date, event_type, diagnosis_text, locomotion_score, severity, notes, created_at",
      )
      .eq("round_id", id),
  ]);

  const animalIds = new Set<string>();
  for (const e of (reproRaw ?? []) as Array<{ animal_id: string }>)
    animalIds.add(e.animal_id);
  for (const e of (healthRaw ?? []) as Array<{ animal_id: string }>)
    animalIds.add(e.animal_id);

  const { data: animalsRaw } =
    animalIds.size > 0
      ? await admin
          .from("animals")
          .select("id, animal_id, name")
          .in("id", Array.from(animalIds))
      : { data: [] as Array<{ id: string; animal_id: string; name: string | null }> };
  const animalById = new Map(
    (animalsRaw ?? []).map((a) => [
      a.id,
      `${a.animal_id}${a.name ? ` · ${a.name}` : ""}`,
    ]),
  );

  const observations: RoundObservation[] = [
    ...((reproRaw ?? []) as Array<{
      id: string;
      animal_id: string;
      event_type: string;
      notes: string | null;
      created_at: string;
    }>).map((r) => ({
      id: r.id,
      kind: "heat" as const,
      animal_label: animalById.get(r.animal_id) ?? "—",
      detail: r.notes ?? null,
      created_at: r.created_at,
    })),
    ...((healthRaw ?? []) as Array<{
      id: string;
      animal_id: string;
      diagnosis_text: string | null;
      locomotion_score: number | null;
      severity: number | null;
      notes: string | null;
      created_at: string;
    }>).map((h) => {
      const dx = (h.diagnosis_text ?? "").toLowerCase();
      const kind: RoundObservation["kind"] =
        dx === "lameness" || h.locomotion_score !== null
          ? "lame"
          : dx === "injury"
            ? "injury"
            : dx === "note"
              ? "note"
              : "sick";
      const detail =
        kind === "lame" && h.locomotion_score !== null
          ? `LS ${h.locomotion_score}${h.notes ? ` · ${h.notes}` : ""}`
          : kind === "note"
            ? h.notes
            : (h.notes ?? h.diagnosis_text ?? null);
      return {
        id: h.id,
        kind,
        animal_label: animalById.get(h.animal_id) ?? "—",
        detail,
        created_at: h.created_at,
      };
    }),
  ].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <RoundClient
      round={{
        id: round.id as string,
        supervisor_name: (round.supervisor_name as string | null) ?? null,
        started_at: round.started_at as string,
        completed_at: (round.completed_at as string | null) ?? null,
        status: round.status as "active" | "completed" | "abandoned",
        notes: (round.notes as string | null) ?? null,
      }}
      observations={observations}
    />
  );
}
