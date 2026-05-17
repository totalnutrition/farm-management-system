import "@/lib/derive/items";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { serializeCommand, type Predicate } from "@/lib/derive/query";
import type { Event } from "@/lib/derive/engine";
import {
  buildProtocolTasks,
  type Protocol,
  type ProtocolMember,
  type Task,
} from "@/lib/derive/protocols";
import {
  ProtocolsClient,
  type ProtocolRow,
  type TaskRow,
  type CodeOption,
} from "./protocols-client";

export const metadata = { title: "Protocols" };
export const dynamic = "force-dynamic";

function condText(p: Predicate): string {
  return serializeCommand({ verb: "COUNT", items: [], for: p }).replace(
    /^COUNT FOR /,
    "",
  );
}

export default async function ProtocolsPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );

  const admin = createAdminClient();
  const { data: protos } = await admin
    .from("protocols")
    .select("id, ordinal, name, enroll, anchor, steps")
    .eq("organization_id", orgId)
    .order("ordinal");

  const { data: codes } = await admin
    .from("event_codes")
    .select("code, name, label")
    .eq("organization_id", orgId)
    .order("code");
  const codeOptions: CodeOption[] = (codes ?? []).map((c) => ({
    code: c.code,
    label: c.label || c.name,
  }));

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
  const idToSubjectId = new Map<string, string>();
  const population: ProtocolMember[] = (subjects ?? []).map((s) => {
    const a = (s.attrs ?? {}) as Record<string, unknown>;
    idToSubjectId.set(s.natural_key, s.id);
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

  const ruleset: Protocol[] = (protos ?? []).map((p) => ({
    name: p.name,
    enroll: p.enroll as Predicate,
    anchor: p.anchor,
    steps: p.steps as Protocol["steps"],
  }));

  const today = new Date().toISOString().slice(0, 10);
  const tasks: TaskRow[] = buildProtocolTasks(population, ruleset, {
    today,
  }).map((t: Task) => ({
    ...t,
    subjectId: idToSubjectId.get(t.id)!,
  }));

  const protocolRows: ProtocolRow[] = (protos ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    enrollText: condText(p.enroll as Predicate),
    anchor: p.anchor,
    steps: (p.steps as Protocol["steps"]).map(
      (s) =>
        `d${s.dayOffset}:${s.label}${s.eventCode ? ` (EC ${s.eventCode})` : ""}`,
    ),
  }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Protocols</h1>
        <p className="text-xs text-muted-foreground">
          Sync/repro programs. The task list is what’s due today for
          enrolled animals.
        </p>
      </header>
      <ProtocolsClient
        protocols={protocolRows}
        tasks={tasks}
        codes={codeOptions}
      />
    </div>
  );
}
