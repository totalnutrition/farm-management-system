import "@/lib/derive/items";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { derive, type Event } from "@/lib/derive/engine";
import { AddAnimal } from "./records-table";

export const metadata = { title: "Records" };
export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );

  const admin = createAdminClient();
  const { data: subjects } = await admin
    .from("subjects")
    .select("id, natural_key, name, attrs")
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

  const today = new Date().toISOString().slice(0, 10);
  const rows = (subjects ?? []).map((s) => {
    const a = (s.attrs ?? {}) as Record<string, unknown>;
    const d = derive(
      {
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
      { today },
      ["RPRO", "LACT", "DIM"],
    );
    return {
      id: s.id,
      naturalKey: s.natural_key,
      name: s.name as string | null,
      rpro: d.RPRO,
      lact: d.LACT,
      dim: d.DIM,
    };
  });

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-lg font-medium">Animals</h1>
          <p className="text-xs text-muted-foreground">
            Every animal — current state is derived from its event history.
          </p>
        </div>
        <AddAnimal />
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No animals yet. Use “Add animal” to create one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-auto border-collapse font-mono text-[11px] leading-tight tabular-nums">
            <thead className="border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
              <tr>
                <th className="px-2 text-left">ID</th>
                <th className="px-2 text-left">Name</th>
                <th className="px-2 text-left">Repro</th>
                <th className="px-2 text-right">Lact</th>
                <th className="px-2 text-right">DIM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/30 hover:bg-muted/30"
                >
                  <td className="px-2">
                    <Link
                      href={`/records/${r.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {r.naturalKey}
                    </Link>
                  </td>
                  <td className="px-2">{r.name ?? "—"}</td>
                  <td className="px-2">{r.rpro ?? "—"}</td>
                  <td className="px-2 text-right">{r.lact ?? "—"}</td>
                  <td className="px-2 text-right">{r.dim ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
