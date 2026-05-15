"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AnimalScanInput } from "@/components/animal-scan-input";
import type { AnimalLookupHit } from "@/lib/animals";
import {
  abandonRound,
  completeRound,
  logHeat,
  logInjury,
  logLame,
  logNote,
  logSick,
} from "../actions";

export type RoundObservation = {
  id: string;
  kind: "heat" | "sick" | "injury" | "lame" | "note";
  animal_label: string;
  detail: string | null;
  created_at: string;
};

type Round = {
  id: string;
  supervisor_name: string | null;
  started_at: string;
  completed_at: string | null;
  status: "active" | "completed" | "abandoned";
  notes: string | null;
};

type Pending =
  | { kind: "heat"; animal: AnimalLookupHit }
  | { kind: "sick"; animal: AnimalLookupHit }
  | { kind: "injury"; animal: AnimalLookupHit }
  | { kind: "lame"; animal: AnimalLookupHit }
  | { kind: "note"; animal: AnimalLookupHit };

const KIND_LABELS: Record<RoundObservation["kind"], string> = {
  heat: "Heat",
  sick: "Sick",
  injury: "Injury",
  lame: "Lame",
  note: "Note",
};

const KIND_COLORS: Record<RoundObservation["kind"], string> = {
  heat: "text-pink-600 dark:text-pink-400",
  sick: "text-amber-600 dark:text-amber-400",
  injury: "text-destructive",
  lame: "text-orange-600 dark:text-orange-400",
  note: "text-muted-foreground",
};

export function RoundClient({
  round,
  observations,
}: {
  round: Round;
  observations: RoundObservation[];
}) {
  const router = useRouter();
  const isActive = round.status === "active";
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalLookupHit | null>(
    null,
  );
  const [pending, setPending] = useState<Pending | null>(null);
  const [, startTransition] = useTransition();

  const onComplete = () => {
    if (!confirm("Complete this round? You won't be able to add more observations.")) return;
    startTransition(async () => {
      const r = await completeRound(round.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Round completed.");
      router.refresh();
    });
  };

  const onAbandon = () => {
    if (!confirm("Abandon this round? Observations already saved will remain.")) return;
    startTransition(async () => {
      const r = await abandonRound(round.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Round abandoned.");
      router.push("/rounds");
    });
  };

  const started = new Date(round.started_at);

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-lg font-medium">
            Round · {started.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </h1>
          <p className="text-xs text-muted-foreground">
            {round.supervisor_name ?? "—"} ·{" "}
            <span
              className={`uppercase tracking-wide ${
                isActive
                  ? "text-amber-600 dark:text-amber-400"
                  : round.status === "abandoned"
                    ? "text-destructive"
                    : "text-primary"
              }`}
            >
              {round.status}
            </span>
            {" · "}
            {observations.length} observation{observations.length === 1 ? "" : "s"}
          </p>
        </div>
        {isActive ? (
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onAbandon}>
              Abandon
            </Button>
            <Button type="button" onClick={onComplete}>
              Complete
            </Button>
          </div>
        ) : null}
      </header>

      {isActive ? (
        <>
          <section className="ring-1 ring-foreground/10 p-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-medium">Scan cow</h2>
              <p className="text-[10px] text-muted-foreground">
                Use an RFID scanner or type the animal&apos;s on-farm ID then
                Enter. Picks up by ear-tag (official ID) first, then on-farm
                ID.
              </p>
            </div>
            <AnimalScanInput
              autoFocus
              onSelect={(a) => setSelectedAnimal(a)}
              onMiss={(code) => toast.error(`No animal found for "${code}".`)}
            />

            {selectedAnimal ? (
              <div className="ring-1 ring-primary/30 bg-primary/5 p-3 flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {selectedAnimal.animal_id}
                    {selectedAnimal.name ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {selectedAnimal.name}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    matched via {selectedAnimal.matched_via === "official_id" ? "RFID" : "on-farm ID"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <ActionButton
                    label="Heat"
                    tone="pink"
                    onClick={() =>
                      setPending({ kind: "heat", animal: selectedAnimal })
                    }
                  />
                  <ActionButton
                    label="Sick"
                    tone="amber"
                    onClick={() =>
                      setPending({ kind: "sick", animal: selectedAnimal })
                    }
                  />
                  <ActionButton
                    label="Injury"
                    tone="destructive"
                    onClick={() =>
                      setPending({ kind: "injury", animal: selectedAnimal })
                    }
                  />
                  <ActionButton
                    label="Lame"
                    tone="orange"
                    onClick={() =>
                      setPending({ kind: "lame", animal: selectedAnimal })
                    }
                  />
                  <ActionButton
                    label="Note"
                    tone="muted"
                    onClick={() =>
                      setPending({ kind: "note", animal: selectedAnimal })
                    }
                  />
                </div>
                <button
                  type="button"
                  className="text-[10px] underline underline-offset-2 text-muted-foreground self-start"
                  onClick={() => setSelectedAnimal(null)}
                >
                  Clear
                </button>
              </div>
            ) : null}
          </section>

          <ObservationDialog
            pending={pending}
            roundId={round.id}
            onClose={() => {
              setPending(null);
              setSelectedAnimal(null);
              router.refresh();
            }}
          />
        </>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Observations</h2>
        {observations.length === 0 ? (
          <div className="ring-1 ring-foreground/10 p-4 text-xs text-muted-foreground">
            None yet. Scan a cow above and tap an action.
          </div>
        ) : (
          <ul className="ring-1 ring-foreground/10 divide-y divide-foreground/10">
            {observations.map((o) => (
              <li
                key={o.id}
                className="px-3 py-1.5 flex items-baseline justify-between gap-2 text-xs"
              >
                <span className="flex items-baseline gap-2">
                  <span
                    className={`text-[10px] uppercase tracking-wide w-12 ${KIND_COLORS[o.kind]}`}
                  >
                    {KIND_LABELS[o.kind]}
                  </span>
                  <span className="font-medium">{o.animal_label}</span>
                  {o.detail ? (
                    <span className="text-muted-foreground">· {o.detail}</span>
                  ) : null}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {new Date(o.created_at).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ActionButton({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone: "pink" | "amber" | "destructive" | "orange" | "muted";
  onClick: () => void;
}) {
  const cls =
    tone === "pink"
      ? "bg-pink-500/10 text-pink-700 dark:text-pink-300 ring-pink-500/40"
      : tone === "amber"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/40"
        : tone === "destructive"
          ? "bg-destructive/10 text-destructive ring-destructive/40"
          : tone === "orange"
            ? "bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-orange-500/40"
            : "bg-foreground/5 text-muted-foreground ring-foreground/10";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ring-1 ${cls} px-3 py-3 text-sm font-medium hover:bg-foreground/[0.04] transition-colors`}
    >
      {label}
    </button>
  );
}

function ObservationDialog({
  pending,
  roundId,
  onClose,
}: {
  pending: Pending | null;
  roundId: string;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [severity, setSeverity] = useState<string>("3");
  const [diagnosis, setDiagnosis] = useState("");
  const [locomotion, setLocomotion] = useState<string>("3");
  const [busy, startTransition] = useTransition();

  // Reset state whenever a new pending observation opens.
  const key = pending ? `${pending.kind}-${pending.animal.id}` : "";
  void key;

  const submit = () => {
    if (!pending) return;
    startTransition(async () => {
      const animalId = pending.animal.id;
      let r;
      if (pending.kind === "heat") {
        r = await logHeat({
          round_id: roundId,
          animal_id: animalId,
          notes: notes.trim() || null,
        });
      } else if (pending.kind === "sick") {
        r = await logSick({
          round_id: roundId,
          animal_id: animalId,
          diagnosis_text: diagnosis.trim() || null,
          severity: Number(severity),
          notes: notes.trim() || null,
        });
      } else if (pending.kind === "injury") {
        r = await logInjury({
          round_id: roundId,
          animal_id: animalId,
          severity: Number(severity),
          notes: notes.trim() || null,
        });
      } else if (pending.kind === "lame") {
        r = await logLame({
          round_id: roundId,
          animal_id: animalId,
          locomotion_score: Number(locomotion),
          notes: notes.trim() || null,
        });
      } else {
        if (!notes.trim()) {
          toast.error("Note text required.");
          return;
        }
        r = await logNote({
          round_id: roundId,
          animal_id: animalId,
          text: notes.trim(),
        });
      }
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Observation saved.");
      setNotes("");
      setSeverity("3");
      setDiagnosis("");
      setLocomotion("3");
      onClose();
    });
  };

  return (
    <Dialog open={!!pending} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {pending ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {KIND_LABELS[pending.kind]} · {pending.animal.animal_id}
                {pending.animal.name ? ` · ${pending.animal.name}` : ""}
              </DialogTitle>
              <DialogDescription>
                Will be recorded against today and tagged with this round.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              {pending.kind === "sick" ? (
                <>
                  <label className="text-[10px] text-muted-foreground">
                    Diagnosis (optional)
                  </label>
                  <Input
                    autoFocus
                    placeholder="e.g. mastitis, milk fever, off-feed"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                  />
                </>
              ) : null}

              {pending.kind === "lame" ? (
                <>
                  <label className="text-[10px] text-muted-foreground">
                    Locomotion score (1–5)
                  </label>
                  <Select value={locomotion} onValueChange={setLocomotion}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 · normal</SelectItem>
                      <SelectItem value="2">2 · slightly altered gait</SelectItem>
                      <SelectItem value="3">3 · obviously impaired</SelectItem>
                      <SelectItem value="4">4 · severe, refuses to bear weight</SelectItem>
                      <SelectItem value="5">5 · cannot rise / stand</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              ) : null}

              {pending.kind === "sick" || pending.kind === "injury" ? (
                <>
                  <label className="text-[10px] text-muted-foreground">
                    Severity (1 mild → 5 critical)
                  </label>
                  <Select value={severity} onValueChange={setSeverity}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 · mild</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3 · moderate</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5 · critical</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              ) : null}

              <label className="text-[10px] text-muted-foreground mt-1">
                {pending.kind === "note" ? "Note" : "Notes (optional)"}
              </label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={pending.kind === "note" ? "Free-form note…" : ""}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" onClick={submit} disabled={busy}>
                {busy ? "Saving…" : "Save observation"}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
