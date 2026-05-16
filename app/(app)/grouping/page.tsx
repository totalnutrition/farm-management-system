import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { serializeCommand, type Predicate } from "@/lib/derive/query";
import type { Event } from "@/lib/derive/engine";
import {
  buildWorklist,
  type Ruleset,
  type GroupingMember,
} from "@/lib/derive/grouping";
import { GroupingClient, type RuleRow, type Move } from "./grouping-client";

export const metadata = { title: "Grouping" };
export const dynamic = "force-dynamic";

function condText(p: Predicate): string {
  return serializeCommand({ verb: "COUNT", items: [], for: p }).replace(
    /^COUNT FOR /,
    "",
  );
}

export default async function GroupingPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );

  const admin = createAdminClient();
  const { data: rules } = await admin
    .from("grouping_rules")
    .select("id, ordinal, name, predicate, target_pen, is_active")
    .eq("organization_id", orgId)
    .order("ordinal");

  const ruleset: Ruleset = (rules ?? [])
    .filter((r) => r.is_active)
    .map((r) => ({
      name: r.name,
      when: r.predicate as Predicate,
      targetPen: r.target_pen,
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
      .select("subject_id, event_code, event_date")
      .eq("organization_id", orgId)
      .in("subject_id", ids);
    for (const e of events ?? []) {
      const l = byId.get(e.subject_id) ?? [];
      l.push({ code: e.event_code, date: e.event_date });
      byId.set(e.subject_id, l);
    }
  }

  const idToSubjectId = new Map<string, string>();
  const population: GroupingMember[] = (subjects ?? []).map((s) => {
    const a = (s.attrs ?? {}) as Record<string, unknown>;
    idToSubjectId.set(s.natural_key, s.id);
    return {
      id: s.natural_key,
      pen: typeof a.pen === "string" ? a.pen : null,
      subject: {
        events: byId.get(s.id) ?? [],
        facts: {
          birthDate:
            typeof a.birth_date === "string" ? a.birth_date : undefined,
          baseLactation:
            typeof a.base_lactation === "number"
              ? a.base_lactation
              : undefined,
        },
      },
    };
  });

  const today = new Date().toISOString().slice(0, 10);
  const worklist: Move[] = buildWorklist(population, ruleset, { today }).map(
    (w) => ({ ...w, subjectId: idToSubjectId.get(w.id)! }),
  );

  const ruleRows: RuleRow[] = (rules ?? []).map((r) => ({
    id: r.id,
    ordinal: r.ordinal,
    name: r.name,
    cond: condText(r.predicate as Predicate),
    targetPen: r.target_pen,
  }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Grouping</h1>
        <p className="text-xs text-muted-foreground">
          Ordered rules decide where each animal should be. The worklist
          is everyone whose pen doesn’t match yet.
        </p>
      </header>
      <GroupingClient rules={ruleRows} worklist={worklist} />
    </div>
  );
}
