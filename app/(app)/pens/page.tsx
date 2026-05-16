import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { PensClient, type PenRow } from "./pens-client";

export const metadata = { title: "Pens" };
export const dynamic = "force-dynamic";

export default async function PensPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );

  const admin = createAdminClient();
  const { data: pens } = await admin
    .from("subjects")
    .select("id, natural_key, name, attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "pen");

  const { data: animals } = await admin
    .from("subjects")
    .select("attrs")
    .eq("organization_id", orgId)
    .eq("subject_type", "animal");

  const { data: barnSubs } = await admin
    .from("subjects")
    .select("natural_key")
    .eq("organization_id", orgId)
    .eq("subject_type", "barn")
    .order("natural_key");
  const barns = (barnSubs ?? []).map((b) => b.natural_key);

  const headcount = new Map<string, number>();
  for (const a of animals ?? []) {
    const pen = (a.attrs as Record<string, unknown> | null)?.pen;
    if (typeof pen === "string")
      headcount.set(pen, (headcount.get(pen) ?? 0) + 1);
  }

  const rows: PenRow[] = (pens ?? [])
    .map((p) => {
      const a = (p.attrs ?? {}) as Record<string, unknown>;
      return {
        id: p.id,
        penNo: typeof a.pen_no === "number" ? a.pen_no : 0,
        types: Array.isArray(a.pen_type) ? (a.pen_type as string[]) : [],
        capacity: typeof a.capacity === "number" ? a.capacity : null,
        label: (p.name as string | null) ?? null,
        barn: typeof a.barn === "string" ? a.barn : null,
        count: headcount.get(p.natural_key) ?? 0,
      };
    })
    .sort((x, y) => x.penNo - y.penNo);

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Pens</h1>
        <p className="text-xs text-muted-foreground">
          Physical pens. Type drives behaviour; capacity feeds the
          grouping worklist.
        </p>
      </header>
      <PensClient rows={rows} barns={barns} />
    </div>
  );
}
