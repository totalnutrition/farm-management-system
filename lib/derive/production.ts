// Production — Phase 13. Milking-EVENT model (not test-day): each
// milking is an event; daily yield = sum of that day's milkings, so
// 2×/3×/4×/robotic all work with zero config. Registered through the
// SAME pluggable path as feed → lights up in Query/Grouping/Monitor/
// Protocols. Yields are canonical (kg). Pure: no DB/DOM.

import {
  register,
  FDAT,
  deriveItem,
  type Subject,
} from "./engine.ts";

// App-defined (non-DC) event, user range; seeded by 0012.
export const MILK_EC = 201;

type MilkPayload = {
  yield?: number; // kg, canonical
  fat?: number;
  prot?: number;
  snf?: number; // solids-not-fat %
  ts?: number; // total solids % (if reported directly)
  scc?: number;
  milkingNo?: number;
};

function milkings(s: Subject) {
  return s.events
    .filter((e) => e.code === MILK_EC)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
function dailyTotals(s: Subject): { date: string; kg: number }[] {
  const by = new Map<string, number>();
  for (const e of milkings(s)) {
    const y = (e.payload as MilkPayload | undefined)?.yield;
    if (typeof y === "number") by.set(e.date, (by.get(e.date) ?? 0) + y);
  }
  return [...by.entries()]
    .map(([date, kg]) => ({ date, kg }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
function latestComponent(
  s: Subject,
  key: "fat" | "prot" | "snf" | "ts" | "scc",
): number | null {
  for (let i = milkings(s).length - 1; i >= 0; i--) {
    const v = (milkings(s)[i].payload as MilkPayload | undefined)?.[key];
    if (typeof v === "number") return v;
  }
  return null;
}
const r1 = (n: number) => Math.round(n * 10) / 10;

register({
  item: "MILK",
  provenance: "confirmed",
  note: "current day's total yield (sum of that day's milkings)",
  compute: (s) => {
    const d = dailyTotals(s);
    return d.length ? r1(d[d.length - 1].kg) : null;
  },
});
register({
  item: "PMILK",
  provenance: "confirmed",
  note: "previous milking-day total",
  compute: (s) => {
    const d = dailyTotals(s);
    return d.length >= 2 ? r1(d[d.length - 2].kg) : null;
  },
});
register({
  item: "PEAK",
  provenance: "confirmed",
  note: "highest daily total this record",
  compute: (s) => {
    const d = dailyTotals(s);
    return d.length ? r1(Math.max(...d.map((x) => x.kg))) : null;
  },
});
register({
  item: "MAVG",
  provenance: "standard-science",
  note: "mean daily yield over the last 7 days",
  compute: (s, ctx) => {
    const d = dailyTotals(s);
    if (!d.length) return null;
    const [y, m, dd] = ctx.today.split("-").map(Number);
    const cutoff = new Date(Date.UTC(y, m - 1, dd - 6))
      .toISOString()
      .slice(0, 10);
    const win = d.filter((x) => x.date >= cutoff && x.date <= ctx.today);
    if (!win.length) return null;
    return r1(win.reduce((a, b) => a + b.kg, 0) / win.length);
  },
});
register({
  item: "MTOT",
  provenance: "confirmed",
  note: "lactation-to-date total (since last FRESH)",
  compute: (s) => {
    const f = FDAT(s);
    const d = dailyTotals(s).filter((x) => !f || x.date >= f);
    return d.length ? r1(d.reduce((a, b) => a + b.kg, 0)) : null;
  },
});
register({
  item: "PCTF",
  provenance: "confirmed",
  compute: (s) => latestComponent(s, "fat"),
});
register({
  item: "PCTP",
  provenance: "confirmed",
  compute: (s) => latestComponent(s, "prot"),
});
register({
  item: "SNF",
  provenance: "confirmed",
  note: "solids-not-fat %",
  compute: (s) => latestComponent(s, "snf"),
});
register({
  item: "TS",
  provenance: "standard-science",
  note: "total solids %: reported value, else Fat% + SNF%",
  compute: (s) => {
    const ts = latestComponent(s, "ts");
    if (ts !== null) return ts;
    const f = latestComponent(s, "fat");
    const snf = latestComponent(s, "snf");
    return f !== null && snf !== null ? r1(f + snf) : null;
  },
});
register({
  item: "SCC",
  provenance: "confirmed",
  compute: (s) => latestComponent(s, "scc"),
});
register({
  item: "LS",
  provenance: "standard-science",
  note: "linear/somatic-cell score = log2(SCC/100)+3 (SCC in 1000s/mL)",
  compute: (s) => {
    const scc = latestComponent(s, "scc");
    return scc && scc > 0 ? r1(Math.log2(scc / 100) + 3) : null;
  },
});
register({
  item: "LCTGP",
  provenance: "confirmed",
  note: "lactation group: H(0) / 1 / 2 / 3+",
  compute: (s, ctx) => {
    const l = Number(deriveItem("LACT", s, ctx) ?? 0);
    return l <= 0 ? "H" : l >= 3 ? "3+" : String(l);
  },
});
