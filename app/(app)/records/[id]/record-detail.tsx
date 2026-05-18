"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
  recordEvent,
  recordMilking,
  deleteAnimalEvent,
  updateAnimalAttrs,
} from "../actions";
import { ITEMS, labelOf } from "@/components/condition-builder";
import { EC } from "@/lib/derive/engine";

type ItemValue = number | string | null;

const EDIT_FIELDS: { key: string; label: string; type?: string }[] = [
  { key: "breed", label: "Breed" },
  { key: "pen", label: "Pen" },
  { key: "eid", label: "Electronic ID" },
  { key: "dam_id", label: "Dam ID" },
  { key: "sire_id", label: "Sire ID" },
  { key: "service_sire", label: "Service sire" },
  { key: "registration", label: "Registration" },
  { key: "entry_reason", label: "Entry reason" },
  { key: "entry_date", label: "Entry date", type: "date" },
  { key: "birth_date", label: "Birth date", type: "date" },
  { key: "due_date", label: "Due date", type: "date" },
  { key: "conception_date", label: "Conception date", type: "date" },
];

export function RecordDetail({
  subjectId,
  animalName,
  attrs,
  state,
  timeline,
  codes,
  supplyItems,
}: {
  subjectId: string;
  animalName: string | null;
  attrs: Record<string, unknown>;
  state: Record<string, ItemValue>;
  timeline: {
    id: string;
    date: string;
    label: string;
    remark: string | null;
  }[];
  codes: { code: number; label: string }[];
  supplyItems: string[];
}) {
  const router = useRouter();
  const asStr = (v: unknown) => (typeof v === "string" ? v : "");
  const [eOpen, setEOpen] = useState(false);
  const [eName, setEName] = useState(animalName ?? "");
  const [eVals, setEVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      EDIT_FIELDS.map((f) => [f.key, asStr(attrs[f.key])]),
    ),
  );

  const saveEdits = () =>
    start(async () => {
      const res = await updateAnimalAttrs({
        subjectId,
        name: eName,
        attrs: eVals,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Details updated.");
      setEOpen(false);
      router.refresh();
    });
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [remark, setRemark] = useState("");
  const [material, setMaterial] = useState("");
  const [materialQty, setMaterialQty] = useState("1");
  const [pending, start] = useTransition();

  const isBreeding = code !== "" && Number(code) === EC.BRED;

  const submit = () =>
    start(async () => {
      const res = await recordEvent({
        subjectId,
        eventCode: Number(code),
        eventDate: date,
        remark: remark || undefined,
        material: isBreeding && material ? material : undefined,
        materialQty:
          isBreeding && material && materialQty
            ? Number(materialQty)
            : undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Event recorded.");
      setRemark("");
      setCode("");
      setMaterial("");
      setMaterialQty("1");
      setOpen(false);
      router.refresh();
    });

  const removeEvent = (id: string, label: string) => {
    if (
      !window.confirm(
        `Delete “${label}”? Any stock it consumed will be returned.`,
      )
    )
      return;
    start(async () => {
      const res = await deleteAnimalEvent(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Event deleted; stock reversed.");
      router.refresh();
    });
  };

  const [mOpen, setMOpen] = useState(false);
  const [mDate, setMDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [mKg, setMKg] = useState("");
  const [mFat, setMFat] = useState("");
  const [mProt, setMProt] = useState("");
  const [mSnf, setMSnf] = useState("");
  const [mTs, setMTs] = useState("");
  const [mScc, setMScc] = useState("");

  const submitMilk = () =>
    start(async () => {
      const res = await recordMilking({
        subjectId,
        date: mDate,
        yieldKg: Number(mKg),
        fat: mFat ? Number(mFat) : undefined,
        prot: mProt ? Number(mProt) : undefined,
        snf: mSnf ? Number(mSnf) : undefined,
        ts: mTs ? Number(mTs) : undefined,
        scc: mScc ? Number(mScc) : undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Milking recorded.");
      setMKg("");
      setMFat("");
      setMProt("");
      setMSnf("");
      setMTs("");
      setMScc("");
      setMOpen(false);
      router.refresh();
    });

  // labels + ordering come from the one shared catalog (no drift)
  const shown = ITEMS.filter((i) => i.value in state).map(
    (i) => [i.value, state[i.value]] as const,
  );

  return (
    <div className="mt-6 space-y-6">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">Current state (derived)</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Record event</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record event</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Event *</Label>
                  <Select value={code} onValueChange={setCode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an event" />
                    </SelectTrigger>
                    <SelectContent>
                      {codes.map((c) => (
                        <SelectItem key={c.code} value={String(c.code)}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date *</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                {isBreeding && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">
                        Genetic material used
                      </Label>
                      <Select
                        value={material}
                        onValueChange={setMaterial}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="semen / embryo (Supply)" />
                        </SelectTrigger>
                        <SelectContent>
                          {supplyItems.length === 0 ? (
                            <SelectItem value="__none" disabled>
                              add stock in Supply Chain
                            </SelectItem>
                          ) : (
                            supplyItems.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Qty used</Label>
                      <Input
                        type="number"
                        value={materialQty}
                        onChange={(e) => setMaterialQty(e.target.value)}
                        placeholder="1"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Remark</Label>
                  <Input
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                  />
                </div>
                {isBreeding && (
                  <p className="text-[11px] text-muted-foreground">
                    Recording a breeding deducts the chosen quantity
                    of that material from Supply Chain stock.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={submit}
                  disabled={pending || !code || !date}
                >
                  {pending ? "Saving…" : "Record"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={mOpen} onOpenChange={setMOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="ml-2">
                Record milking
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record milking</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date *</Label>
                  <Input
                    type="date"
                    value={mDate}
                    onChange={(e) => setMDate(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Yield (kg) *</Label>
                    <Input
                      type="number"
                      value={mKg}
                      onChange={(e) => setMKg(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fat %</Label>
                    <Input
                      type="number"
                      value={mFat}
                      onChange={(e) => setMFat(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Protein %</Label>
                    <Input
                      type="number"
                      value={mProt}
                      onChange={(e) => setMProt(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">SNF %</Label>
                    <Input
                      type="number"
                      value={mSnf}
                      onChange={(e) => setMSnf(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Total solids %</Label>
                    <Input
                      type="number"
                      value={mTs}
                      onChange={(e) => setMTs(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">SCC (1000s)</Label>
                    <Input
                      type="number"
                      value={mScc}
                      onChange={(e) => setMScc(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  One row per milking — 2×/3×/robotic all sum into the
                  day’s total automatically.
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setMOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitMilk}
                  disabled={pending || !mKg || !mDate}
                >
                  {pending ? "Saving…" : "Record"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={eOpen} onOpenChange={setEOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="ml-2">
                Edit details
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit details</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={eName}
                    onChange={(e) => setEName(e.target.value)}
                  />
                </div>
                {EDIT_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      type={f.type ?? "text"}
                      value={eVals[f.key] ?? ""}
                      onChange={(e) =>
                        setEVals((p) => ({
                          ...p,
                          [f.key]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Clearing a field removes that value. Lactation, cohort
                and the event history are managed separately.
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button onClick={saveEdits} disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <Card>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-1 py-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between gap-2 text-xs tabular-nums"
              >
                <span className="truncate text-muted-foreground">
                  {labelOf(k)}
                </span>
                <span className="font-medium">{v ?? "—"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">Event history</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No events yet. Record one to start this animal’s history.
          </p>
        ) : (
          <ol className="space-y-2">
            {timeline.map((t) => (
              <li
                key={t.id}
                className="group flex items-baseline gap-3 border-l-2 border-border pl-3 text-sm"
              >
                <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                  {t.date}
                </span>
                <span className="font-medium">{t.label}</span>
                {t.remark ? (
                  <span className="text-muted-foreground">— {t.remark}</span>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => removeEvent(t.id, t.label)}
                  className="ml-auto shrink-0 text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive disabled:opacity-50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
