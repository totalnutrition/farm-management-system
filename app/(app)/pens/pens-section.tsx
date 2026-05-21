import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { legacyPlacement, type Placement } from "@/lib/derive/grouping";
import { PensClient, type PenRow } from "./pens-client";

// Pens the given placement targets — same shape as grouping/actions
// uses, inlined here to avoid pulling a "use server" module client-
// side. (single|parity|item|capacity.)
function pensOf(p: Placement): string[] {
  if (p.kind === "single") return [p.pen];
  if (p.kind === "parity") return p.buckets.map((b) => b.pen);
  if (p.kind === "item") return [...p.cuts.map((c) => c.pen), p.elsePen];
  if (p.kind === "capacity") return p.pens;
  return [];
}

export async function PensSection() {
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

  const { data: rules } = await admin
    .from("grouping_rules")
    .select("name, target_pen, split, placement, is_active, ordinal")
    .eq("organization_id", orgId)
    .order("ordinal");
  // pen natural_key -> [group names that target it]
  const groupsByPen = new Map<string, string[]>();
  for (const r of rules ?? []) {
    if (!r.is_active) continue;
    const pl: Placement = r.placement
      ? (r.placement as Placement)
      : legacyPlacement(
          r.target_pen,
          r.split as { firstLactation: string; mature: string } | null,
        );
    for (const pen of pensOf(pl)) {
      const list = groupsByPen.get(pen) ?? [];
      if (!list.includes(r.name)) list.push(r.name);
      groupsByPen.set(pen, list);
    }
  }

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
        groups: groupsByPen.get(p.natural_key) ?? [],
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
