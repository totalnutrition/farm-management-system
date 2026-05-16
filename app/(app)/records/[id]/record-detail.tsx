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
import { recordEvent } from "../actions";

type ItemValue = number | string | null;

const ITEM_LABEL: Record<string, string> = {
  RPRO: "Repro status",
  RC: "Repro code (#)",
  LACT: "Lactation #",
  DIM: "Days in milk",
  DDRY: "Days dry",
  AGE: "Age (months)",
  DCC: "Days carrying calf",
  DUE: "Days to due",
  DSLH: "Days since last heat",
  DOPN: "Days open",
  FDAT: "Fresh date",
  DDAT: "Dry date",
};

export function RecordDetail({
  subjectId,
  state,
  timeline,
  codes,
}: {
  subjectId: string;
  state: Record<string, ItemValue>;
  timeline: { date: string; label: string; remark: string | null }[];
  codes: { code: number; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [remark, setRemark] = useState("");
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const res = await recordEvent({
        subjectId,
        eventCode: Number(code),
        eventDate: date,
        remark: remark || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Event recorded.");
      setRemark("");
      setCode("");
      setOpen(false);
      router.refresh();
    });

  const shown = Object.entries(state).filter(([k]) => k in ITEM_LABEL);

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
                <div className="space-y-1">
                  <Label className="text-xs">Remark</Label>
                  <Input
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                  />
                </div>
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
        </div>
        <Card>
          <CardContent className="grid grid-cols-2 gap-x-8 gap-y-2 py-4 sm:grid-cols-3">
            {shown.map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {ITEM_LABEL[k]}
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
            {timeline.map((t, i) => (
              <li
                key={i}
                className="flex items-baseline gap-3 border-l-2 border-border pl-3 text-sm"
              >
                <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                  {t.date}
                </span>
                <span className="font-medium">{t.label}</span>
                {t.remark ? (
                  <span className="text-muted-foreground">— {t.remark}</span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
