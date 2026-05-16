"use server";

import "@/lib/derive/items";

import { requireUser, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { runQuery, type Query, type PopulationMember } from "@/lib/derive/query";
import type { Event, IntakeFacts } from "@/lib/derive/engine";

export type QueryResponse =
  | { error: string }
  | { kind: "list"; rows: Array<Record<string, string | number | null>> }
  | { kind: "count"; count: number }
  | { kind: "sum"; sum: Record<string, number | null> }
  | {
      kind: "pct";
      denominator: number;
      numerator: number;
      pct: number | null;
    }
  | {
      kind: "group";
      rows: Array<Record<string, string | number | null>>;
    };

function factsFromAttrs(attrs: unknown): IntakeFacts {
  const a = (attrs ?? {}) as Record<string, unknown>;
  const s = (k: string) =>
    typeof a[k] === "string" ? (a[k] as string) : undefined;
  return {
    birthDate: s("birth_date"),
    conceptionDate: s("conception_date"),
    dueDate: s("due_date"),
    lastHeatDate: s("last_heat_date"),
    baseLactation:
      typeof a.base_lactation === "number" ? a.base_lactation : undefined,
  };
}

export async function runQueryAction(
  q: Query,
  asOf?: string,
): Promise<QueryResponse> {
  const user = await requireUser();
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) return { error: "No organization on this account." };

  if (
    !q ||
    !q.verb ||
    !["LIST", "COUNT", "SUM", "PCT"].includes(q.verb)
  ) {
    return { error: "Invalid query." };
  }

  const db = createAdminClient();

  const { data: subjects, error: sErr } = await db
    .from("subjects")
    .select("id, natural_key, attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "animal");
  if (sErr) return { error: sErr.message };

  const ids = (subjects ?? []).map((s) => s.id);
  const eventsBySubject = new Map<string, Event[]>();
  if (ids.length) {
    const { data: events, error: eErr } = await db
      .from("events")
      .select("subject_id, event_code, event_date, payload")
      .eq("organization_id", orgId)
      .in("subject_id", ids);
    if (eErr) return { error: eErr.message };
    for (const ev of events ?? []) {
      const list = eventsBySubject.get(ev.subject_id) ?? [];
      list.push({
        code: ev.event_code,
        date: ev.event_date,
        payload: (ev.payload ?? {}) as Record<string, unknown>,
      });
      eventsBySubject.set(ev.subject_id, list);
    }
  }

  const population: PopulationMember[] = (subjects ?? []).map((s) => ({
    id: s.natural_key,
    subject: {
      events: eventsBySubject.get(s.id) ?? [],
      facts: factsFromAttrs(s.attrs),
    },
  }));

  const today =
    asOf && /^\d{4}-\d{2}-\d{2}$/.test(asOf)
      ? asOf
      : new Date().toISOString().slice(0, 10);
  const result = runQuery(q, population, { today });

  if (q.groupBy && q.groupBy.length) {
    const g = result as {
      grouped: Array<Record<string, string | number | null>>;
    };
    return { kind: "group", rows: g.grouped };
  }
  if (typeof result === "number") return { kind: "count", count: result };
  if (Array.isArray(result)) return { kind: "list", rows: result };
  if (q.verb === "PCT") {
    const p = result as {
      denominator: number;
      numerator: number;
      pct: number | null;
    };
    return {
      kind: "pct",
      denominator: p.denominator,
      numerator: p.numerator,
      pct: p.pct,
    };
  }
  const { count, ...rest } = result as { count: number } & Record<
    string,
    number | null
  >;
  return { kind: "sum", sum: { count, ...rest } };
}
