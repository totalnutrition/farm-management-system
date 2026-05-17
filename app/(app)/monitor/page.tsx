import "@/lib/derive/items";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import {
  serializeCommand,
  type Predicate,
  type PopulationMember,
} from "@/lib/derive/query";
import type { Event } from "@/lib/derive/engine";
import { evaluateKpi, type Kpi, type KpiResult } from "@/lib/derive/monitor";
import { MonitorClient, type KpiRow } from "./monitor-client";

export const metadata = { title: "Monitor" };
export const dynamic = "force-dynamic";

export default async function MonitorPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );

  const admin = createAdminClient();
  const { data: kpis } = await admin
    .from("monitor_kpis")
    .select("id, name, filter, metric, goal, direction, warn_pct, alert_pct")
    .eq("organization_id", orgId)
    .order("ordinal");

  const { data: subjects } = await admin
    .from("subjects")
    .select("id, natural_key, attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "animal");

  const ids = (subjects ?? []).map((s) => s.id);
  const byId = new Map<string, Event[]>();
  if (ids.length) {
    const { data: events } = await admin
      .from("events")
      .select("subject_id, event_code, event_date, payload")
      .eq("organization_id", orgId)
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
  const population: PopulationMember[] = (subjects ?? []).map((s) => {
    const a = (s.attrs ?? {}) as Record<string, unknown>;
    return {
      id: s.natural_key,
      subject: {
        events: byId.get(s.id) ?? [],
        facts: {
          birthDate:
            typeof a.birth_date === "string" ? a.birth_date : undefined,
          conceptionDate:
            typeof a.conception_date === "string"
              ? a.conception_date
              : undefined,
          dueDate: typeof a.due_date === "string" ? a.due_date : undefined,
          baseLactation:
            typeof a.base_lactation === "number"
              ? a.base_lactation
              : undefined,
        },
      },
    };
  });

  const today = new Date().toISOString().slice(0, 10);
  const rows: KpiRow[] = (kpis ?? []).map((k) => {
    const metric = k.metric as Kpi["metric"];
    const kpi: Kpi = {
      name: k.name,
      filter: (k.filter as Predicate | null) ?? undefined,
      metric,
      goal: Number(k.goal),
      direction: k.direction as Kpi["direction"],
      warnPct: Number(k.warn_pct),
      alertPct: Number(k.alert_pct),
    };
    const result: KpiResult = evaluateKpi(kpi, population, { today });
    const filterText = k.filter
      ? serializeCommand({
          verb: "COUNT",
          items: [],
          for: k.filter as Predicate,
        }).replace(/^COUNT FOR /, "")
      : "all animals";
    return {
      id: k.id,
      result,
      metricLabel:
        metric.kind === "avg" ? `avg ${metric.item}` : "count",
      direction: k.direction as string,
      filterText,
    };
  });

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Monitor</h1>
        <p className="text-xs text-muted-foreground">
          KPIs vs goals. Values are computed live from the herd’s events.
        </p>
      </header>
      <MonitorClient rows={rows} />
    </div>
  );
}
