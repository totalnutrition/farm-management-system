// Append-only ledger correction: a CNCL (209) event with
// payload.cancels = <orig event id> marks a prior event as cancelled.
// Active views skip the cancelled events AND the CNCL markers
// themselves so timelines and derivations look as if the event had
// never been recorded — without ever mutating history.
//
// Use this at every event-loading site before building derive
// Subjects, so RPRO/DIM/MILK/WT/etc. don't react to events the user
// has reversed.

export type DbEventRow = {
  id: string;
  event_code: number;
  event_date: string;
  payload: Record<string, unknown> | null;
};

const CNCL_EC = 209;

export function applyCancellations<T extends DbEventRow>(rows: T[]): T[] {
  const cancelled = new Set<string>();
  for (const r of rows) {
    if (r.event_code !== CNCL_EC) continue;
    const c = (r.payload as { cancels?: unknown } | null)?.cancels;
    if (typeof c === "string") cancelled.add(c);
  }
  return rows.filter(
    (r) => r.event_code !== CNCL_EC && !cancelled.has(r.id),
  );
}
