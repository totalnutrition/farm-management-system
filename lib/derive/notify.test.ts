import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNotifications, type Signal } from "./notify.ts";

test("each signal maps to a stable-key draft with right severity", () => {
  const sigs: Signal[] = [
    { kind: "protocol", id: "200", protocol: "Presynch", step: "GnRH", overdue: true },
    { kind: "penmove", id: "5", to: "FRESH", overCapacity: true },
    { kind: "kpi", name: "Fresh cows", status: "warn", value: 3, goal: 4 },
    { kind: "dnship", id: "9", until: "2026-05-20" },
    { kind: "attn", id: "7", activity: "LAME" },
  ];
  const d = buildNotifications(sigs);
  assert.deepEqual(
    d.map((x) => [x.key, x.severity, x.category, x.link]),
    [
      ["protocol:200:Presynch:GnRH", "alert", "protocol", "/protocols"],
      ["penmove:5:FRESH", "alert", "grouping", "/grouping"],
      ["kpi:Fresh cows", "warn", "monitor", "/monitor"],
      ["dnship:9", "alert", "health", "/health"],
      ["attn:7:LAME", "warn", "activity", "/activity"],
    ],
  );
});

test("non-overdue protocol = warn; non-overcap penmove = info", () => {
  const d = buildNotifications([
    { kind: "protocol", id: "1", protocol: "P", step: "S", overdue: false },
    { kind: "penmove", id: "2", to: "DRY", overCapacity: false },
  ]);
  assert.equal(d[0].severity, "warn");
  assert.equal(d[1].severity, "info");
});

test("keys are stable across rebuilds (dedupe-safe)", () => {
  const s: Signal[] = [{ kind: "dnship", id: "9", until: "2026-05-20" }];
  assert.equal(buildNotifications(s)[0].key, buildNotifications(s)[0].key);
});

test("empty signals → no drafts", () => {
  assert.deepEqual(buildNotifications([]), []);
});
