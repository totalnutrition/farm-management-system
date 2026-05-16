// Protocols — isomorphic, zero-dependency. A protocol = an enrollment
// predicate + an anchor date item + ordered steps at day-offsets.
// buildProtocolTasks = "what's due today" for enrolled animals (a step
// whose due date has arrived and whose event isn't yet recorded). Same
// surface-the-work / human-acts loop as grouping. Pure: no DB/DOM.

import {
  deriveItem,
  type Subject,
  type DeriveContext,
} from "./engine.ts";
import { matchPredicate, type Predicate } from "./query.ts";

export type ProtocolStep = {
  dayOffset: number; // days after the anchor date
  label: string;
  eventCode?: number; // the event that satisfies this step
};
export type Protocol = {
  name: string;
  enroll: Predicate; // which animals are on this protocol
  anchor: string; // a derived date item (e.g. FDAT, DDAT)
  steps: ProtocolStep[];
};

export type ProtocolMember = { id: string; subject: Subject };

export type Task = {
  id: string;
  protocol: string;
  step: string;
  dueDate: string;
  status: "due" | "overdue";
  eventCode?: number;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function getter(subject: Subject, ctx: DeriveContext) {
  return (item: string) => {
    try {
      return deriveItem(item, subject, ctx);
    } catch {
      return null;
    }
  };
}

export function buildProtocolTasks(
  population: ProtocolMember[],
  protocols: Protocol[],
  ctx: DeriveContext,
): Task[] {
  const out: Task[] = [];
  for (const m of population) {
    const get = getter(m.subject, ctx);
    for (const p of protocols) {
      if (!matchPredicate(p.enroll, get)) continue;
      const anchor = get(p.anchor);
      if (typeof anchor !== "string" || !ISO.test(anchor)) continue;

      for (const s of p.steps) {
        const due = addDays(anchor, s.dayOffset);
        if (ctx.today < due) continue; // not yet
        const done =
          s.eventCode != null &&
          m.subject.events.some(
            (e) => e.code === s.eventCode && e.date >= due,
          );
        if (done) continue;
        out.push({
          id: m.id,
          protocol: p.name,
          step: s.label,
          dueDate: due,
          status: ctx.today > due ? "overdue" : "due",
          eventCode: s.eventCode,
        });
      }
    }
  }
  return out;
}
