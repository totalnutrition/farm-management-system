// FeedComp — Phase 10. The independence proof: a whole new subject
// domain (rations + pen feeding) added with ZERO changes to the core
// (engine.ts / query.ts untouched). Feed items are registered through
// the SAME pluggable register() the animal items use, and they are
// queried through the SAME runQuery executor. Cost is captured in the
// event payload at feeding time so derivation stays pure.

import { register, type Subject } from "./engine.ts";

// App-defined (non-DC) event in the user range; seeded by 0008.
export const FEED_EC = 200;

type FeedPayload = { kg?: number; refused?: number; cost?: number };

function feedEvents(s: Subject) {
  return s.events.filter((e) => e.code === FEED_EC);
}
function sum(s: Subject, key: keyof FeedPayload): number {
  let t = 0;
  for (const e of feedEvents(s)) {
    const v = (e.payload as FeedPayload | undefined)?.[key];
    if (typeof v === "number") t += v;
  }
  return t;
}

register({
  item: "FEEDKG",
  provenance: "standard-science",
  note: "total kg delivered (FeedComp)",
  compute: (s) => (feedEvents(s).length ? sum(s, "kg") : null),
});
register({
  item: "REFKG",
  provenance: "standard-science",
  note: "total kg refused / weighback",
  compute: (s) => (feedEvents(s).length ? sum(s, "refused") : null),
});
register({
  item: "FEEDCOST",
  provenance: "standard-science",
  note: "total feed cost (kg × ration cost captured at feeding)",
  compute: (s) =>
    feedEvents(s).length ? Math.round(sum(s, "cost") * 100) / 100 : null,
});
register({
  item: "SHRINK",
  provenance: "inferred",
  note: "refused ÷ delivered %, exact DC weighback formula unconfirmed",
  compute: (s) => {
    if (!feedEvents(s).length) return null;
    const kg = sum(s, "kg");
    return kg > 0 ? Math.round((sum(s, "refused") / kg) * 1000) / 10 : 0;
  },
});
