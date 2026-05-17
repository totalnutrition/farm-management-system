"use server";

import "@/lib/derive/items";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PathNotifications } from "@/lib/misc";
import { deriveItem, type Event } from "@/lib/derive/engine";
import {
  buildWorklist,
  legacyPlacement,
  type Ruleset,
  type Pen,
  type Placement,
  type GroupingMember,
} from "@/lib/derive/grouping";
import {
  buildProtocolTasks,
  type Protocol,
} from "@/lib/derive/protocols";
import { evaluateKpi, type Kpi } from "@/lib/derive/monitor";
import type { Predicate, PopulationMember } from "@/lib/derive/query";
import { buildNotifications, type Signal } from "@/lib/derive/notify";

type Result = { error?: string; success?: boolean };

export async function runNotificationSweep(): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: subjects }, { data: penRows }, { data: rules }, { data: protos }, { data: kpis }] =
    await Promise.all([
      admin.from("subjects").select("id, natural_key, attrs").eq("organization_id", orgId).eq("subject_type", "animal"),
      admin.from("subjects").select("natural_key, attrs").eq("organization_id", orgId).eq("subject_type", "pen"),
      admin.from("grouping_rules").select("name, predicate, target_pen, split, placement, is_active").eq("organization_id", orgId).order("ordinal"),
      admin.from("protocols").select("name, enroll, anchor, steps").eq("organization_id", orgId).order("ordinal"),
      admin.from("monitor_kpis").select("name, filter, metric, goal, direction, warn_pct, alert_pct").eq("organization_id", orgId).order("ordinal"),
    ]);

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
  const members = (subjects ?? []).map((s) => {
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
  });
  const grouping: GroupingMember[] = members;
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
      placement: r.placement
        ? (r.placement as Placement)
        : legacyPlacement(
            r.target_pen as string | null,
            r.split as { firstLactation: string; mature: string } | null,
          ),
    }));
  const protocols: Protocol[] = (protos ?? []).map((p) => ({
    name: p.name,
    enroll: p.enroll as Predicate,
    anchor: p.anchor,
    steps: p.steps as Protocol["steps"],
  }));

  const signals: Signal[] = [];
  for (const t of buildProtocolTasks(pop, protocols, { today }))
    signals.push({ kind: "protocol", id: t.id, protocol: t.protocol, step: t.step, overdue: t.status === "overdue" });
  for (const w of buildWorklist(grouping, ruleset, { today }, pens))
    signals.push({ kind: "penmove", id: w.id, to: w.to, overCapacity: w.overCapacity });
  for (const k of kpis ?? []) {
    const r = evaluateKpi(
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
    );
    if (r.status === "warn" || r.status === "alert")
      signals.push({ kind: "kpi", name: r.name, status: r.status, value: r.value, goal: r.goal });
  }
  for (const m of members) {
    if (deriveItem("DNSHIP", m.subject, { today }) === "YES")
      signals.push({ kind: "dnship", id: m.id, until: deriveItem("MWHOLD", m.subject, { today }) as string | null });
    if (deriveItem("FLAGGED", m.subject, { today }) === "YES")
      signals.push({ kind: "attn", id: m.id, activity: String(deriveItem("ATTN", m.subject, { today }) ?? "") });
  }

  const drafts = buildNotifications(signals);
  if (drafts.length) {
    await admin.from("notifications").upsert(
      drafts.map((d) => ({
        organization_id: orgId,
        dedupe_key: d.key,
        category: d.category,
        severity: d.severity,
        title: d.title,
        body: d.body,
        link: d.link,
      })),
      { onConflict: "organization_id,dedupe_key", ignoreDuplicates: true },
    );
  }
  revalidatePath(PathNotifications);
  return { success: true };
}

export async function markRead(id: string): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };
  revalidatePath(PathNotifications);
  return { success: true };
}

export async function markAllRead(): Promise<Result> {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .is("read_at", null);
  if (error) return { error: error.message };
  revalidatePath(PathNotifications);
  return { success: true };
}
