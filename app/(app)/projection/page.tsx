import "@/lib/derive/items";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { deriveItem, type Event } from "@/lib/derive/engine";
import type { ProjAnimal } from "@/lib/derive/projection";
import { ProjectionClient } from "./projection-client";

export const metadata = { title: "Projection" };
export const dynamic = "force-dynamic";

export default async function ProjectionPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: settings } = await admin
    .from("org_settings")
    .select("params")
    .eq("organization_id", orgId)
    .maybeSingle();
  const params = (settings?.params ?? {}) as Record<string, number>;

  const { data: subjects } = await admin
    .from("subjects")
    .select("id, attrs")
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

  const daysBetween = (a: string, b: string) =>
    Math.round(
      (Date.UTC(
        ...(a.split("-").map(Number) as [number, number, number]),
      ) -
        Date.UTC(
          ...(b.split("-").map(Number) as [number, number, number]),
        )) /
        86_400_000,
    );

  const herd: ProjAnimal[] = (subjects ?? []).map((s) => {
    const a = (s.attrs ?? {}) as Record<string, unknown>;
    const subject = {
      events: byId.get(s.id) ?? [],
      facts: {
        baseLactation:
          typeof a.base_lactation === "number" ? a.base_lactation : undefined,
        dueDate: typeof a.due_date === "string" ? a.due_date : undefined,
      },
    };
    const rc = Number(deriveItem("RC", subject, { today }) ?? 0);
    const lact = Number(deriveItem("LACT", subject, { today }) ?? 0);
    const dim = deriveItem("DIM", subject, { today }) as number | null;
    const group: 1 | 2 = lact <= 1 ? 1 : 2;
    const due =
      typeof a.due_date === "string"
        ? Math.max(0, daysBetween(a.due_date, today))
        : null;
    let status: ProjAnimal["status"] = "dry";
    if (rc === 6) status = "dry";
    else if (dim !== null && dim >= 0 && (rc === 2 || rc === 3 || rc === 4 || rc === 5))
      status = "lactating";
    else if (due !== null) status = "bred";
    return { dim: status === "lactating" ? dim : null, group, status, dueInDays: due };
  });

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Projection</h1>
        <p className="text-xs text-muted-foreground">
          Expected herd milk & cow numbers. Adjust the levers — it
          recomputes live.
        </p>
      </header>
      <ProjectionClient
        herd={herd}
        defaultCullRate={
          typeof params.cull_rate_pct === "number"
            ? params.cull_rate_pct
            : 30
        }
      />
    </div>
  );
}
