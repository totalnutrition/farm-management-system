// Mark-for-activity — Phase 16b. A FLAG event tags an animal for an
// activity (heat / sick / wound / lame / check / …). The most recent
// FLAG wins; a FLAG with {cleared:true} resolves it. Registered
// through the same pluggable path → the attention list is queryable
// and shows on the dashboard. Pure: no DB/DOM.

import { register, type Subject } from "./engine.ts";

// App-defined (non-DC) event, user range; seeded by 0015.
export const FLAG_EC = 203;

type FlagPayload = { activity?: string; cleared?: boolean };

function latestFlag(s: Subject) {
  const f = s.events
    .filter((e) => e.code === FLAG_EC)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return f.length ? f[f.length - 1] : null;
}

register({
  item: "ATTN",
  provenance: "confirmed",
  note: "open activity flag (latest FLAG, unless cleared)",
  compute: (s) => {
    const e = latestFlag(s);
    if (!e) return null;
    const p = (e.payload ?? {}) as FlagPayload;
    if (p.cleared === true) return null;
    return typeof p.activity === "string" ? p.activity : null;
  },
});
register({
  item: "FLAGGED",
  provenance: "confirmed",
  note: "YES while an activity flag is open",
  compute: (s) => {
    const e = latestFlag(s);
    if (!e) return "no";
    const p = (e.payload ?? {}) as FlagPayload;
    return p.cleared !== true && typeof p.activity === "string"
      ? "YES"
      : "no";
  },
});
