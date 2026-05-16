// Health / withdrawal — Phase 15. A TREAT event carries the milk- and
// meat-withhold-until dates COMPUTED AT ENTRY from the drug catalog,
// so derivation stays pure. Registered through the same pluggable
// path → DNSHIP (do-not-ship) is queryable/monitorable everywhere.
// Food-safety critical: a cow under withhold must never be shipped.

import { register, type Subject } from "./engine.ts";

// App-defined (non-DC) event, user range; seeded by 0013.
export const TREAT_EC = 202;

type TreatPayload = {
  drug?: string;
  mwUntil?: string; // milk withhold until (ISO date)
  bwUntil?: string; // beef/meat withhold until (ISO date)
};

function treats(s: Subject) {
  return s.events.filter((e) => e.code === TREAT_EC);
}
function maxDate(s: Subject, key: "mwUntil" | "bwUntil"): string | null {
  let m: string | null = null;
  for (const e of treats(s)) {
    const v = (e.payload as TreatPayload | undefined)?.[key];
    if (typeof v === "string" && (m === null || v > m)) m = v;
  }
  return m;
}

register({
  item: "MWHOLD",
  provenance: "confirmed",
  note: "milk withhold-until date (latest across treatments)",
  compute: (s) => maxDate(s, "mwUntil"),
});
register({
  item: "BWHOLD",
  provenance: "confirmed",
  note: "meat/beef withhold-until date",
  compute: (s) => maxDate(s, "bwUntil"),
});
register({
  item: "DNSHIP",
  provenance: "confirmed",
  note: "do-not-ship milk: today is on/before the milk withhold date",
  compute: (s, ctx) => {
    const d = maxDate(s, "mwUntil");
    return d && ctx.today <= d ? "YES" : "no";
  },
});
register({
  item: "DNSELL",
  provenance: "confirmed",
  note: "do-not-sell for meat: today on/before the meat withhold date",
  compute: (s, ctx) => {
    const d = maxDate(s, "bwUntil");
    return d && ctx.today <= d ? "YES" : "no";
  },
});
register({
  item: "LTDAT",
  provenance: "confirmed",
  note: "last treatment date",
  compute: (s) => {
    const es = treats(s);
    if (!es.length) return null;
    return es.reduce((m, e) => (e.date > m ? e.date : m), es[0].date);
  },
});
