import "@/lib/derive/items";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireUser, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { Card, CardContent } from "@/components/ui/card";
import { deriveItem, type Event } from "@/lib/derive/engine";
import {
  buildWorklist,
  type Ruleset,
  type Pen,
  type GroupingMember,
} from "@/lib/derive/grouping";
import {
  buildProtocolTasks,
  type Protocol,
  type ProtocolMember,
} from "@/lib/derive/protocols";
import { evaluateKpi, type Kpi } from "@/lib/derive/monitor";
import type { Predicate, PopulationMember } from "@/lib/derive/query";
import { PathGrouping, PathProtocols, PathMonitor, PathHealth, PathActivity } from "@/lib/misc";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser();
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <div className="py-6 text-sm text-muted-foreground">
        Your account is not linked to an organization yet.
      </div>
    );

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: subjects }, { data: penRows }, { data: rules }, { data: protos }, { data: kpis }] =
    await Promise.all([
      admin.from("subjects").select("id, natural_key, attrs").eq("organization_id", orgId).eq("subject_type", "animal"),
      admin.from("subjects").select("natural_key, attrs").eq("organization_id", orgId).eq("subject_type", "pen"),
      admin.from("grouping_rules").select("name, predicate, target_pen, split, is_active").eq("organization_id", orgId).order("ordinal"),
      admin.from("protocols").select("name, enroll, anchor, steps").eq("organization_id", orgId).order("ordinal"),
      admin.from("monitor_kpis").select("name, filter, metric, goal, direction, warn_pct, alert_pct").eq("organization_id", orgId).order("ordinal"),
    ]);

  const ids = (subjects ?? []).map((s) => s.id);
  const byId = new Map<string, Event[]>();
  if (ids.length) {
    const { data: events } = await admin
      .from("events")
      .select("subject_id, event_code, event_date")
      .eq("organization_id", orgId)
      .in("subject_id", ids);
    for (const e of events ?? []) {
      const l = byId.get(e.subject_id) ?? [];
      l.push({ code: e.event_code, date: e.event_date });
      byId.set(e.subject_id, l);
    }
  }
  const mk = (s: { id: string; natural_key: string; attrs: unknown }) => {
    const a = (s.attrs ?? {}) as Record<string, unknown>;
    return {
      id: s.natural_key,
      pen: typeof a.pen === "string" ? a.pen : null,
      subject: {
        events: byId.get(s.id) ?? [],
        facts: {
          birthDate: typeof a.birth_date === "string" ? a.birth_date : undefined,
          conceptionDate: typeof a.conception_date === "string" ? a.conception_date : undefined,
          dueDate: typeof a.due_date === "string" ? a.due_date : undefined,
          baseLactation: typeof a.base_lactation === "number" ? a.base_lactation : undefined,
        },
      },
    };
  };
  const members = (subjects ?? []).map(mk);
  const grouping: GroupingMember[] = members;
  const protoPop: ProtocolMember[] = members.map((m) => ({ id: m.id, subject: m.subject }));
  const pop: PopulationMember[] = members.map((m) => ({ id: m.id, subject: m.subject }));

  const pens: Pen[] = (penRows ?? []).map((p) => {
    const a = (p.attrs ?? {}) as Record<string, unknown>;
    return { name: p.natural_key, capacity: typeof a.capacity === "number" ? a.capacity : null };
  });

  const ruleset: Ruleset = (rules ?? [])
    .filter((r) => r.is_active)
    .map((r) => ({
      name: r.name,
      when: r.predicate as Predicate,
      targetPen: (r.target_pen as string | null) ?? undefined,
      split: (r.split as { firstLactation: string; mature: string } | null) ?? undefined,
    }));
  const protocols: Protocol[] = (protos ?? []).map((p) => ({
    name: p.name,
    enroll: p.enroll as Predicate,
    anchor: p.anchor,
    steps: p.steps as Protocol["steps"],
  }));

  const worklist = buildWorklist(grouping, ruleset, { today }, pens);
  const tasks = buildProtocolTasks(protoPop, protocols, { today });
  const dnship = members.filter(
    (m) => deriveItem("DNSHIP", m.subject, { today }) === "YES",
  );
  const attn = members.filter(
    (m) => deriveItem("FLAGGED", m.subject, { today }) === "YES",
  );
  const alerts = (kpis ?? [])
    .map((k) =>
      evaluateKpi(
        {
          name: k.name,
          filter: (k.filter as Predicate | null) ?? undefined,
          metric: k.metric as Kpi["metric"],
          goal: Number(k.goal),
          direction: k.direction as Kpi["direction"],
          warnPct: Number(k.warn_pct),
          alertPct: Number(k.alert_pct),
        },
        pop,
        { today },
      ),
    )
    .filter((r) => r.status === "warn" || r.status === "alert");

  const tiles = [
    { label: "Protocol tasks due", n: tasks.length, href: PathProtocols, items: tasks.slice(0, 6).map((t) => `${t.id} · ${t.protocol}: ${t.step}${t.status === "overdue" ? " (overdue)" : ""}`) },
    { label: "Pen moves", n: worklist.length, href: PathGrouping, items: worklist.slice(0, 6).map((w) => `${w.id}: ${w.from ?? "—"} → ${w.to}${w.overCapacity ? " (over cap)" : ""}`) },
    { label: "KPI alerts", n: alerts.length, href: PathMonitor, items: alerts.slice(0, 6).map((a) => `${a.name}: ${a.value ?? "—"} vs ${a.goal} [${a.status}]`) },
    { label: "Do-not-ship", n: dnship.length, href: PathHealth, items: dnship.slice(0, 6).map((m) => `${m.id}: milk until ${deriveItem("MWHOLD", m.subject, { today }) ?? "—"}`) },
    { label: "Needs attention", n: attn.length, href: PathActivity, items: attn.slice(0, 6).map((m) => `${m.id}: ${deriveItem("ATTN", m.subject, { today }) ?? "—"}`) },
  ];

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">To-Do</h1>
        <p className="text-xs text-muted-foreground">
          Everything that needs attention today, in one place.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href}>
            <Card className="transition-colors hover:bg-muted/40">
              <CardContent className="space-y-2 py-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">{t.label}</span>
                  <span
                    className={
                      "font-heading text-2xl font-semibold " +
                      (t.n > 0 ? "" : "text-muted-foreground")
                    }
                  >
                    {t.n}
                  </span>
                </div>
                {t.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">All clear.</p>
                ) : (
                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {t.items.map((i, k) => (
                      <li key={k} className="truncate">
                        {i}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
