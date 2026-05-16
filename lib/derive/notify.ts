// Notification engine — pure, zero-dependency. Turns the same
// attention signals the dashboard composes into notification drafts
// with STABLE dedupe keys (so repeated sweeps don't duplicate).
// Delivery channels (in-app now; email/WhatsApp as adapters) consume
// these drafts. Pure: no DB/DOM.

export type Severity = "info" | "warn" | "alert";

export type Signal =
  | { kind: "protocol"; id: string; protocol: string; step: string; overdue: boolean }
  | { kind: "penmove"; id: string; to: string; overCapacity: boolean }
  | { kind: "kpi"; name: string; status: "warn" | "alert"; value: number | null; goal: number }
  | { kind: "dnship"; id: string; until: string | null }
  | { kind: "attn"; id: string; activity: string };

export type NotificationDraft = {
  key: string;
  category: string;
  severity: Severity;
  title: string;
  body: string;
  link: string;
};

export function buildNotifications(signals: Signal[]): NotificationDraft[] {
  return signals.map((s) => {
    switch (s.kind) {
      case "protocol":
        return {
          key: `protocol:${s.id}:${s.protocol}:${s.step}`,
          category: "protocol",
          severity: s.overdue ? "alert" : "warn",
          title: `Protocol task ${s.overdue ? "overdue" : "due"}`,
          body: `${s.id} · ${s.protocol}: ${s.step}`,
          link: "/protocols",
        };
      case "penmove":
        return {
          key: `penmove:${s.id}:${s.to}`,
          category: "grouping",
          severity: s.overCapacity ? "alert" : "info",
          title: "Pen move",
          body: `${s.id} → ${s.to}${s.overCapacity ? " (over capacity)" : ""}`,
          link: "/grouping",
        };
      case "kpi":
        return {
          key: `kpi:${s.name}`,
          category: "monitor",
          severity: s.status,
          title: `KPI ${s.status}: ${s.name}`,
          body: `${s.value ?? "—"} vs goal ${s.goal}`,
          link: "/monitor",
        };
      case "dnship":
        return {
          key: `dnship:${s.id}`,
          category: "health",
          severity: "alert",
          title: "Do-not-ship",
          body: `${s.id}: milk withheld until ${s.until ?? "—"}`,
          link: "/health",
        };
      case "attn":
        return {
          key: `attn:${s.id}:${s.activity}`,
          category: "activity",
          severity: "warn",
          title: "Needs attention",
          body: `${s.id}: ${s.activity}`,
          link: "/activity",
        };
    }
  });
}
