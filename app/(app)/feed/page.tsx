import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { runQuery, type PopulationMember } from "@/lib/derive/query";
import type { Event } from "@/lib/derive/engine";
import { FEED_EC } from "@/lib/derive/feed";
import type { Material } from "@/lib/derive/ration";
import {
  FeedClient,
  type MaterialRow,
  type RationRow,
  type PenFeed,
  type Feeding,
} from "./feed-client";

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
  const { data: matSubs } = await admin
    .from("subjects")
    .select("id, natural_key, attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "feed")
    .order("natural_key");
  const materials: MaterialRow[] = (matSubs ?? []).map((m) => {
    const a = (m.attrs ?? {}) as Record<string, unknown>;
    return {
      id: m.id,
      name: m.natural_key,
      dmPct: typeof a.dm_pct === "number" ? a.dm_pct : 100,
      cost: typeof a.cost === "number" ? a.cost : 0,
      cp: typeof a.cp === "number" ? a.cp : null,
      nel: typeof a.nel === "number" ? a.nel : null,
      ndf: typeof a.ndf === "number" ? a.ndf : null,
      stock: typeof a.stock_kg === "number" ? a.stock_kg : 0,
    };
  });
  const catalog: Record<string, Material> = {};
  for (const m of materials)
    catalog[m.name] = {
      dmPct: m.dmPct,
      costPerKgAsFed: m.cost,
      cp: m.cp ?? undefined,
      nel: m.nel ?? undefined,
      ndf: m.ndf ?? undefined,
    };

  const { data: rationSubs } = await admin
    .from("subjects")
    .select("id, natural_key, attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "ration")
    .order("natural_key");
  const rations: RationRow[] = (rationSubs ?? []).map((r) => {
    const a = (r.attrs ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      name: r.natural_key,
      costPerKg: typeof a.cost_per_kg === "number" ? a.cost_per_kg : 0,
      dmKg: typeof a.dm_kg === "number" ? a.dm_kg : 0,
      cpPct: typeof a.cp_pct === "number" ? a.cp_pct : 0,
      recipe: Array.isArray(a.recipe)
        ? (a.recipe as { material: string; dmKg: number }[])
        : [],
    };
  });

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

  const penName = new Map(
    (penSubjects ?? []).map((p) => [p.id, p.natural_key]),
  );
  const feedings: Feeding[] = [];
  if (penIds.length) {
    const { data: fev } = await admin
      .from("events")
      .select("id, subject_id, event_date, payload")
      .eq("organization_id", orgId)
      .eq("event_code", FEED_EC)
      .in("subject_id", penIds)
      .order("event_date", { ascending: false })
      .limit(100);
    for (const e of fev ?? []) {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      feedings.push({
        id: e.id as string,
        pen: penName.get(e.subject_id) ?? "—",
        date: e.event_date as string,
        ration: typeof p.ration === "string" ? p.ration : "—",
        kg: typeof p.kg === "number" ? p.kg : null,
        cost: typeof p.cost === "number" ? p.cost : null,
      });
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Feed</h1>
        <p className="text-xs text-muted-foreground">
          Materials, DM-basis rations (delivered as-fed), pen feeding.
        </p>
      </header>
      <FeedClient
        materials={materials}
        rations={rations}
        pens={(penSubjects ?? []).map((p) => p.natural_key)}
        penFeed={penFeed}
        feedings={feedings}
      />
    </div>
  );
}
