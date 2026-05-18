// Auto stock movement. When a consuming event is recorded elsewhere
// (e.g. a treatment uses a drug), post the matching Supply Chain
// movement so on-hand stays correct without a second manual entry.
// Best-effort: a missing item or a write error never blocks the
// primary action — stock simply isn't moved.

import type { createAdminClient } from "@/lib/supabase-admin";
import { SUBJECT_ITEM, EC_USAGE, EC_RECEIVE } from "@/lib/supply";

type Admin = ReturnType<typeof createAdminClient>;

export async function applySupplyMovement(
  admin: Admin,
  orgId: string,
  opts: {
    itemName: string;
    qty: number;
    date: string;
    direction: "use" | "receive";
    ref?: Record<string, unknown>;
  },
): Promise<void> {
  const qty = Math.abs(opts.qty);
  if (!opts.itemName || qty <= 0) return;

  const { data: item } = await admin
    .from("subjects")
    .select("id")
    .eq("organization_id", orgId)
    .eq("subject_type", SUBJECT_ITEM)
    .eq("natural_key", opts.itemName)
    .maybeSingle();
  if (!item) return;

  const code = opts.direction === "receive" ? EC_RECEIVE : EC_USAGE;
  // The events FK requires the code to exist for this org. Orgs
  // created before Supply Chain may lack it; upsert is idempotent.
  await admin.from("event_codes").upsert(
    {
      organization_id: orgId,
      code,
      name: code === EC_RECEIVE ? "SRCV" : "SUSE",
      label:
        code === EC_RECEIVE
          ? "Stock receipt (Supply Chain)"
          : "Stock usage (Supply Chain)",
      is_system: false,
      provenance: "app-defined: Supply Chain",
    },
    { onConflict: "organization_id,code", ignoreDuplicates: true },
  );

  await admin.from("events").insert({
    organization_id: orgId,
    subject_id: item.id,
    event_code: code,
    event_date: opts.date,
    payload: {
      qty,
      unit_cost: null,
      party: null,
      auto: true,
      ...(opts.ref ?? {}),
    },
    source: "system",
  });
}
