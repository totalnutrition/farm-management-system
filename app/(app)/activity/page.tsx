import "@/lib/derive/items";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { runQuery, type PopulationMember } from "@/lib/derive/query";
import type { Event } from "@/lib/derive/engine";
import { ActivityClient, type FlagRow } from "./activity-client";

export const metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );

  const admin = createAdminClient();
  const { data: subjects } = await admin
    .from("subjects")
    .select("id, natural_key")
    .eq("organization_id", orgId)
    .eq("subject_type", "animal")
    .order("natural_key");
  const ids = (subjects ?? []).map((s) => s.id);
  const byId = new Map<string, Event[]>();
  if (ids.length) {
    const { data: events } = await admin
      .from("events")
      .select("subject_id, event_code, event_date, payload")
      .eq("organization_id", orgId)
      .eq("event_code", 203)
      .in("subject_id", ids);
    for (const e of events ?? []) {
      const l = byId.get(e.subject_id) ?? [];
      l.push({
        code: e.event_code,
        date: e.event_date,
        payload: (e.payload ?? {}) as Record<string, unknown>,
      });
      byId.set(e.subject_id, l);
    }
  }
  const pop: PopulationMember[] = (subjects ?? []).map((s) => ({
    id: s.natural_key,
    subject: { events: byId.get(s.id) ?? [] },
  }));

  const today = new Date().toISOString().slice(0, 10);
  const flagged = runQuery(
    {
      verb: "LIST",
      items: ["ATTN"],
      for: [[{ kind: "cmp", item: "FLAGGED", op: "=", value: "YES" }]],
    },
    pop,
    { today },
  ) as Array<Record<string, string | null>>;
  const rows: FlagRow[] = flagged.map((r) => ({
    animalId: String(r.ID),
    activity: r.ATTN ?? "—",
  }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Activity</h1>
        <p className="text-xs text-muted-foreground">
          Mark animals chute-side for follow-up. Resolve when done.
        </p>
      </header>
      <ActivityClient
        animals={(subjects ?? []).map((s) => s.natural_key)}
        rows={rows}
      />
    </div>
  );
}
