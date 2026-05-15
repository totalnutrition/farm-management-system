"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EVENT_CATEGORY,
  EVENT_LABEL,
  EVENT_TYPES,
  type AnimalEvent,
  type EventCategory,
  type EventType,
} from "@/lib/herd";
import { addEvent } from "./actions";

const LENSES: { key: EventCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "repro", label: "Repro" },
  { key: "health", label: "Health" },
  { key: "milk", label: "Milk" },
  { key: "lifecycle", label: "Lifecycle" },
];

// One contextual field per event type — terse chute-side entry (#9).
const CONTEXT_FIELD: Partial<
  Record<EventType, { key: string; label: string; placeholder: string }>
> = {
  move: { key: "pen", label: "Pen", placeholder: "e.g. 4" },
  preg_check: { key: "result", label: "Result", placeholder: "pregnant / open" },
  breeding: { key: "sire", label: "Sire", placeholder: "bull / code" },
  treatment: { key: "drug", label: "Drug", placeholder: "product" },
  vaccination: { key: "vaccine", label: "Vaccine", placeholder: "product" },
  weight: { key: "kg", label: "Weight (kg)", placeholder: "e.g. 620" },
  milk_test: { key: "kg", label: "Milk (kg)", placeholder: "e.g. 38" },
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function EventStream({
  tag,
  events,
}: {
  tag: string;
  events: AnimalEvent[];
}) {
  const [lens, setLens] = useState<EventCategory | "all">("all");

  const shown = useMemo(
    () =>
      lens === "all"
        ? events
        : events.filter((e) => EVENT_CATEGORY[e.event_type] === lens),
    [events, lens],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {LENSES.map((l) => (
            <Button
              key={l.key}
              type="button"
              size="sm"
              variant={lens === l.key ? "default" : "outline"}
              onClick={() => setLens(l.key)}
            >
              {l.label}
            </Button>
          ))}
        </div>
        <AddEventDialog tag={tag} />
      </div>

      <div className="ring-1 ring-foreground/10">
        {shown.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">
            No events in this lens.
          </p>
        ) : (
          <ul className="divide-y divide-foreground/10">
            {shown.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-heading text-sm font-medium">
                    {EVENT_LABEL[e.event_type] ?? e.event_type}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {e.event_date}
                  </span>
                </div>
                {Object.keys(e.data ?? {}).length > 0 ? (
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {Object.entries(e.data).map(([k, v]) => (
                      <span key={k}>
                        {k}: <span className="text-foreground">{String(v)}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
                {e.note ? (
                  <p className="text-xs text-muted-foreground">{e.note}</p>
                ) : null}
                {e.corrects_event_id ? (
                  <span className="text-xs text-amber-600">
                    Correction of an earlier event
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AddEventDialog({ tag }: { tag: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<EventType>("note");
  const [date, setDate] = useState(today());
  const [ctx, setCtx] = useState("");
  const [note, setNote] = useState("");

  const ctxField = CONTEXT_FIELD[type];

  const reset = () => {
    setType("note");
    setDate(today());
    setCtx("");
    setNote("");
  };

  const submit = () => {
    startTransition(async () => {
      const data: Record<string, string> = {};
      if (ctxField && ctx.trim()) data[ctxField.key] = ctx.trim();
      const result = await addEvent({
        tag,
        event_type: type,
        event_date: date,
        note: note.trim() || undefined,
        data,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Event recorded.");
      reset();
      setOpen(false);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          Add event
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add event — {tag}</DialogTitle>
          <DialogDescription>
            History is append-only. Corrections are new events.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Select
            value={type}
            onValueChange={(v) => setType(v as EventType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.filter((t) => t !== "correction").map((t) => (
                <SelectItem key={t} value={t}>
                  {EVENT_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {ctxField ? (
            <Input
              value={ctx}
              onChange={(e) => setCtx(e.target.value)}
              placeholder={`${ctxField.label} — ${ctxField.placeholder}`}
              autoComplete="off"
            />
          ) : null}
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
          />
          <DialogFooter>
            <Button type="button" disabled={isPending} onClick={submit}>
              {isPending ? "Recording..." : "Record"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
