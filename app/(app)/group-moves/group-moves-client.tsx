"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  CancelCircleIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { acceptMove, overrideMove, bulkAccept } from "./actions";

export type PendingRow = {
  animal_id: string;
  animal_label: string;
  current_group_id: string | null;
  current_group_label: string | null;
  suggested_group_id: string;
  suggested_group_label: string;
  rule_explanation: string;
  days_in_current: number | null;
  override_active: boolean;
  override_reason: string | null;
};

export type HistoryRow = {
  id: string;
  occurred_at: string;
  animal_label: string;
  from_label: string | null;
  to_label: string | null;
  suggested_label: string | null;
  decision: string;
  reason: string | null;
  rule_explanation: string | null;
};

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "history", label: "History" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export type GroupChoice = { id: string; label: string };

export function GroupMovesClient({
  pending,
  history,
  groups,
}: {
  pending: PendingRow[];
  history: HistoryRow[];
  groups: GroupChoice[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const active = (params.get("tab") as TabKey) ?? "pending";
  const setTab = (k: TabKey) => {
    const q = new URLSearchParams(params.toString());
    q.set("tab", k);
    router.push(`/group-moves?${q.toString()}`);
  };

  return (
    <>
      <nav className="ring-1 ring-foreground/10 flex overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs whitespace-nowrap border-b-2 -mb-px ${
              active === t.key
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.key === "pending" && pending.length > 0 ? (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded">
                {pending.length}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
      {active === "pending" ? <PendingTab rows={pending} groups={groups} /> : null}
      {active === "history" ? <HistoryTab rows={history} /> : null}
    </>
  );
}

function PendingTab({
  rows,
  groups,
}: {
  rows: PendingRow[];
  groups: GroupChoice[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showOverridden, setShowOverridden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [overrideTarget, setOverrideTarget] = useState<PendingRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showOverridden && r.override_active) return false;
      if (q) {
        return (
          r.animal_label.toLowerCase().includes(q) ||
          (r.current_group_label ?? "").toLowerCase().includes(q) ||
          r.suggested_group_label.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, search, showOverridden]);

  const onAccept = (row: PendingRow) => {
    setBusy(row.animal_id);
    startTransition(async () => {
      const r = await acceptMove({
        animal_id: row.animal_id,
        from_group_id: row.current_group_id,
        to_group_id: row.suggested_group_id,
        rule_explanation: row.rule_explanation,
      });
      setBusy(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Moved ${row.animal_label} → ${row.suggested_group_label}`);
      router.refresh();
    });
  };

  const onBulkAccept = () => {
    const acceptable = filtered.filter((r) => !r.override_active);
    if (acceptable.length === 0) {
      toast.error("Nothing to accept.");
      return;
    }
    if (!confirm(`Accept ${acceptable.length} suggested move(s)?`)) return;
    startTransition(async () => {
      const r = await bulkAccept({
        moves: acceptable.map((m) => ({
          animal_id: m.animal_id,
          from_group_id: m.current_group_id,
          to_group_id: m.suggested_group_id,
          rule_explanation: m.rule_explanation,
        })),
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Applied ${r.applied} move(s).`);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cow / group"
            className="h-8 w-64 pl-7 pr-2 text-xs border border-foreground/10 bg-background"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={showOverridden}
            onChange={(e) => setShowOverridden(e.target.checked)}
          />
          Show overridden
        </label>
        <span className="text-[10px] text-muted-foreground tabular-nums ml-2">
          {filtered.length}/{rows.length}
        </span>
        <div className="ml-auto">
          <Button type="button" size="sm" variant="outline" onClick={onBulkAccept} disabled={filtered.length === 0}>
            <HugeiconsIcon icon={CheckmarkCircle02Icon} />
            Accept all visible
          </Button>
        </div>
      </div>

      <div className="ring-1 ring-foreground/10 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-foreground/5">
            <tr className="text-left">
              <th className="px-2 py-1.5 font-medium">Cow</th>
              <th className="px-2 py-1.5 font-medium">Current group</th>
              <th className="px-2 py-1.5 font-medium">Suggested group</th>
              <th className="px-2 py-1.5 font-medium">Why</th>
              <th className="px-2 py-1.5 font-medium text-right">In current</th>
              <th className="px-2 py-1.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-center text-muted-foreground">
                  No pending group moves. Roster is in sync with your rules.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.animal_id} className="border-t border-foreground/10 hover:bg-foreground/[0.025]">
                  <td className="px-2 py-1.5 font-medium">{r.animal_label}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {r.current_group_label ?? <em>—</em>}
                  </td>
                  <td className="px-2 py-1.5 font-medium">{r.suggested_group_label}</td>
                  <td className="px-2 py-1.5 text-muted-foreground text-[11px]">
                    {r.rule_explanation}
                    {r.override_active && r.override_reason ? (
                      <span className="block text-destructive text-[10px]">
                        overridden: {r.override_reason}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {r.days_in_current === null ? "—" : `${r.days_in_current}d`}
                  </td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onAccept(r)}
                      disabled={busy === r.animal_id}
                      title={`Move ${r.animal_label} to ${r.suggested_group_label}`}
                    >
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} />
                      Accept
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setOverrideTarget(r)}
                      title="Pick a different group or keep current with a reason"
                    >
                      <HugeiconsIcon icon={CancelCircleIcon} />
                      Override…
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <OverrideDialog
        target={overrideTarget}
        groups={groups}
        onClose={() => setOverrideTarget(null)}
      />
    </>
  );
}

const STAY = "__stay__";

function OverrideDialog({
  target,
  groups,
  onClose,
}: {
  target: PendingRow | null;
  groups: GroupChoice[];
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  // STAY = keep in current_group_id. Anything else = move to that group.
  const [destination, setDestination] = useState<string>(STAY);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Reset when target changes.
  if (target && destination === "" /* never set */) setDestination(STAY);

  const onSubmit = () => {
    if (!target) return;
    if (!reason.trim()) {
      toast.error("Reason required.");
      return;
    }
    const targetGroupId =
      destination === STAY ? target.current_group_id : destination;
    startTransition(async () => {
      const r = await overrideMove({
        animal_id: target.animal_id,
        current_group_id: target.current_group_id,
        suggested_group_id: target.suggested_group_id,
        target_group_id: targetGroupId,
        reason: reason.trim(),
        rule_explanation: target.rule_explanation,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      const destLabel =
        destination === STAY
          ? target.current_group_label ?? "(no group)"
          : groups.find((g) => g.id === destination)?.label ?? "?";
      toast.success(
        `${target.animal_label} → ${destLabel} (override).`,
      );
      setReason("");
      setDestination(STAY);
      onClose();
      router.refresh();
    });
  };

  const destLabel =
    destination === STAY
      ? `keep in ${target?.current_group_label ?? "(no group)"}`
      : `move to ${groups.find((g) => g.id === destination)?.label ?? "?"}`;

  return (
    <Dialog
      open={!!target}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setDestination(STAY);
          setReason("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override suggestion</DialogTitle>
          <DialogDescription>
            {target ? (
              <>
                Engine suggested{" "}
                <span className="font-medium text-foreground">
                  {target.suggested_group_label}
                </span>{" "}
                for{" "}
                <span className="font-medium text-foreground">
                  {target.animal_label}
                </span>
                . Pick a different destination if needed and record why —
                the engine won&apos;t re-suggest until her facts change.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-muted-foreground">Move to</label>
          <Select value={destination} onValueChange={setDestination}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={STAY}>
                Keep in current ({target?.current_group_label ?? "(no group)"})
              </SelectItem>
              {groups
                .filter((g) => g.id !== target?.suggested_group_id)
                .map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    Move to {g.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">{destLabel}</p>
        </div>
        <Textarea
          rows={3}
          placeholder="Why override? e.g. hospital observation, kept with primip pen for monitoring…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={isPending}>
            {isPending ? "Saving…" : "Record override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryTab({ rows }: { rows: HistoryRow[] }) {
  return (
    <div className="ring-1 ring-foreground/10 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-foreground/5">
          <tr className="text-left">
            <th className="px-2 py-1.5 font-medium">When</th>
            <th className="px-2 py-1.5 font-medium">Cow</th>
            <th className="px-2 py-1.5 font-medium">Decision</th>
            <th className="px-2 py-1.5 font-medium">From</th>
            <th className="px-2 py-1.5 font-medium">To</th>
            <th className="px-2 py-1.5 font-medium">Suggested</th>
            <th className="px-2 py-1.5 font-medium">Rule / Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">
                No decisions yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-t border-foreground/10">
                <td className="px-2 py-1.5">{new Date(r.occurred_at).toLocaleString()}</td>
                <td className="px-2 py-1.5 font-medium">{r.animal_label}</td>
                <td className="px-2 py-1.5">
                  <DecisionBadge d={r.decision} />
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">{r.from_label ?? "—"}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{r.to_label ?? "—"}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{r.suggested_label ?? "—"}</td>
                <td className="px-2 py-1.5 text-muted-foreground text-[11px]">
                  {r.reason ?? r.rule_explanation ?? ""}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DecisionBadge({ d }: { d: string }) {
  const tone =
    d === "accepted"
      ? "text-primary"
      : d === "overridden"
        ? "text-destructive"
        : "";
  return (
    <span className={`text-[10px] font-medium uppercase tracking-wide ${tone}`}>{d}</span>
  );
}

// keep import used
void Input;
