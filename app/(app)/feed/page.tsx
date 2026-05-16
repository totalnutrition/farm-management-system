import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { runQuery, type PopulationMember } from "@/lib/derive/query";
import type { Event } from "@/lib/derive/engine";
import { FEED_EC } from "@/lib/derive/feed"; // side-effect: registers feed items
import { FeedClient, type RationRow, type PenFeed } from "./feed-client";

export const metadata = { title: "Feed" };
export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );

  const admin = createAdminClient();
  const { data: rationSubjects } = await admin
    .from("subjects")
    .select("id, natural_key, attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "ration")
    .order("natural_key");
  const rations: RationRow[] = (rationSubjects ?? []).map((r) => ({
    id: r.id,
    name: r.natural_key,
    costPerKg:
      typeof (r.attrs as Record<string, unknown>)?.cost_per_kg === "number"
        ? ((r.attrs as Record<string, unknown>).cost_per_kg as number)
        : 0,
  }));

  const { data: penSubjects } = await admin
    .from("subjects")
    .select("id, natural_key")
    .eq("organization_id", orgId)
    .eq("subject_type", "pen")
    .order("natural_key");

  const penIds = (penSubjects ?? []).map((p) => p.id);
  const byId = new Map<string, Event[]>();
  if (penIds.length) {
    const { data: events } = await admin
      .from("events")
      .select("subject_id, event_code, event_date, payload")
      .eq("organization_id", orgId)
      .eq("event_code", FEED_EC)
      .in("subject_id", penIds);
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
  const pop: PopulationMember[] = (penSubjects ?? []).map((p) => ({
    id: p.natural_key,
    subject: { events: byId.get(p.id) ?? [] },
  }));

  // The SAME runQuery executor, over `pen` subjects, with feed items.
  const today = new Date().toISOString().slice(0, 10);
  const rows = runQuery(
    {
      verb: "LIST",
      items: ["FEEDKG", "REFKG", "FEEDCOST", "SHRINK"],
      for: [[{ kind: "cmp", item: "FEEDKG", op: ">", value: 0 }]],
      by: { item: "FEEDCOST", dir: "desc" },
    },
    pop,
    { today },
  ) as Array<Record<string, number | string | null>>;

  const penFeed: PenFeed[] = rows.map((r) => ({
    pen: String(r.ID),
    kg: r.FEEDKG as number | null,
    refused: r.REFKG as number | null,
    cost: r.FEEDCOST as number | null,
    shrink: r.SHRINK as number | null,
  }));

  const penOptions = (penSubjects ?? []).map((p) => p.natural_key);

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Feed</h1>
        <p className="text-xs text-muted-foreground">
          Rations and pen feeding. Built entirely on the existing
          ledger + engine — no core changes.
        </p>
      </header>
      <FeedClient
        rations={rations}
        pens={penOptions}
        penFeed={penFeed}
      />
    </div>
  );
}
