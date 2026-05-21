import "@/lib/derive/items";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { derive, type Event } from "@/lib/derive/engine";
import { AddAnimal } from "./records-table";
import { AnimalsAdmin } from "./animals-admin";
import { BarnsSection } from "../barns/barns-section";
import { PensSection } from "../pens/pens-section";
import { GroupingSection } from "../grouping/grouping-section";

export const metadata = { title: "Herd" };
export const dynamic = "force-dynamic";

// Herd hub — Animals · Groups · Pens in one place. Barns are folded
// into the Pens tab (barns contain pens; not a separate concern).
// Groups is just the rules; the herd-level admin (seed/archive)
// lives with the animals, not with the rules.
const TABS = [
  { key: "animals", label: "Animals" },
  { key: "groups", label: "Groups" },
  { key: "pens", label: "Pens & barns" },
] as const;

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );

  const { tab } = await searchParams;
  const active = (TABS.find((t) => t.key === tab)?.key ?? "animals") as
    | "animals"
    | "groups"
    | "pens";

  return (
    <div className="flex flex-col gap-3 py-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-lg font-medium">Herd</h1>
          <p className="text-xs text-muted-foreground">
            Animals, the groups they fall into, and where they live —
            one place.
          </p>
        </div>
        {active === "animals" && (
          <div className="flex flex-wrap items-center gap-2">
            <AnimalsAdmin />
            <span className="mx-1 text-muted-foreground">|</span>
            <Link
              href="/import"
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Bulk import
            </Link>
            <AddAnimal />
          </div>
        )}
      </header>

      <div className="flex gap-1 border-b text-xs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "animals" ? "/records" : `/records?tab=${t.key}`}
            className={
              "-mb-px border-b-2 px-3 py-1.5 " +
              (active === t.key
                ? "border-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      {active === "animals" && <AnimalsTab orgId={orgId} />}
      {active === "groups" && <GroupingSection />}
      {active === "pens" && (
        <>
          <BarnsSection />
          <PensSection />
        </>
      )}
    </div>
  );
}

async function AnimalsTab({ orgId }: { orgId: string }) {
  const admin = createAdminClient();
  const { data: subjects } = await admin
    .from("subjects")
    .select("id, natural_key, name, attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "animal")
    .neq("status", "archived")
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
        attrs: a,
      },
      { today },
      ["RPRO", "LACT", "DIM", "PEN", "BREED", "EID", "DAM", "SIRE"],
    );
    return {
      id: s.id,
      naturalKey: s.natural_key,
      name: s.name as string | null,
      rpro: d.RPRO,
      lact: d.LACT,
      dim: d.DIM,
      pen: d.PEN,
      breed: d.BREED,
      eid: d.EID,
      dam: d.DAM,
      sire: d.SIRE,
    };
  });

  if (rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No animals yet. Use “Add animal” to create one.
      </p>
    );

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-auto border-collapse font-mono text-[11px] leading-tight tabular-nums">
        <thead className="border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
          <tr>
            <th className="px-2 text-left">ID</th>
            <th className="px-2 text-left">Name</th>
            <th className="px-2 text-left">Repro</th>
            <th className="px-2 text-right">Lact</th>
            <th className="px-2 text-right">DIM</th>
            <th className="px-2 text-left">Pen</th>
            <th className="px-2 text-left">Breed</th>
            <th className="px-2 text-left">EID</th>
            <th className="px-2 text-left">Dam</th>
            <th className="px-2 text-left">Sire</th>
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
              <td className="px-2">{r.pen ?? "—"}</td>
              <td className="px-2">{r.breed ?? "—"}</td>
              <td className="px-2">{r.eid ?? "—"}</td>
              <td className="px-2">{r.dam ?? "—"}</td>
              <td className="px-2">{r.sire ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
