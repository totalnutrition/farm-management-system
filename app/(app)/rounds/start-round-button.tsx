"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { startRound } from "./actions";

export function StartRoundButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [supervisor, setSupervisor] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">Start round</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a new round</DialogTitle>
          <DialogDescription>
            Captures observations as you walk the barn. Scan a cow, tap an
            action, repeat. Finish with <span className="font-medium">Complete</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] text-muted-foreground">
            Supervisor name (optional)
          </label>
          <Input
            value={supervisor}
            onChange={(e) => setSupervisor(e.target.value)}
            placeholder="e.g. Ali"
          />
          <label className="text-[10px] text-muted-foreground mt-1">
            Notes (optional)
          </label>
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. morning round, focus on fresh pen"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                const r = await startRound({
                  supervisor_name: supervisor.trim() || null,
                  notes: notes.trim() || null,
                });
                if (r.error) {
                  toast.error(r.error);
                  return;
                }
                toast.success("Round started.");
                setOpen(false);
                router.push(`/rounds/${r.round_id}`);
              })
            }
          >
            {busy ? "Starting…" : "Start"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
