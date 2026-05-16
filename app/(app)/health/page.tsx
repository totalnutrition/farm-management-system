import "@/lib/derive/items";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { runQuery, type PopulationMember } from "@/lib/derive/query";
import type { Event } from "@/lib/derive/engine";
import {
  HealthClient,
  type DrugRow,
  type DnsRow,
} from "./health-client";

export const metadata = { title: "Health" };
export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );

  const admin = createAdminClient();
  const { data: drugSubs } = await admin
    .from("subjects")
    .select("id, natural_key, attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "drug")
    .order("natural_key");
  const drugs: DrugRow[] = (drugSubs ?? []).map((d) => {
    const a = (d.attrs ?? {}) as Record<string, unknown>;
    return {
      id: d.id,
      name: d.natural_key,
      milkDays: typeof a.milk_days === "number" ? a.milk_days : 0,
      meatDays: typeof a.meat_days === "number" ? a.meat_days : 0,
      route: typeof a.route === "string" ? a.route : null,
    };
  });

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
      .eq("event_code", 202)
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
  const dns = runQuery(
    {
      verb: "LIST",
      items: ["MWHOLD", "BWHOLD", "LTDAT"],
      for: [[{ kind: "cmp", item: "DNSHIP", op: "=", value: "YES" }]],
      by: { item: "MWHOLD", dir: "asc" },
    },
    pop,
    { today },
  ) as Array<Record<string, string | null>>;
  const dnsRows: DnsRow[] = dns.map((r) => ({
    animalId: String(r.ID),
    milkUntil: r.MWHOLD ?? null,
    meatUntil: r.BWHOLD ?? null,
    lastTreated: r.LTDAT ?? null,
  }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Health</h1>
        <p className="text-xs text-muted-foreground">
          Drug catalog, treatments, and the do-not-ship list. A cow on
          withhold must never be shipped.
        </p>
      </header>
      <HealthClient
        drugs={drugs}
        animals={(subjects ?? []).map((s) => s.natural_key)}
        dns={dnsRows}
      />
    </div>
  );
}
