"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createAnimal } from "./actions";

export function AddAnimal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [naturalKey, setNaturalKey] = useState("");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [baseLactation, setBaseLactation] = useState("");
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const res = await createAnimal({
        naturalKey,
        name: name || undefined,
        birthDate: birthDate || undefined,
        baseLactation: baseLactation ? Number(baseLactation) : undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Animal ${naturalKey} added.`);
      setNaturalKey("");
      setName("");
      setBirthDate("");
      setBaseLactation("");
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add animal</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add animal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Animal ID *</Label>
            <Input
              value={naturalKey}
              onChange={(e) => setNaturalKey(e.target.value)}
              placeholder="e.g. 1001"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Birth date</Label>
            <Input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              Lactations before entering the system
            </Label>
            <Input
              type="number"
              min={0}
              value={baseLactation}
              onChange={(e) => setBaseLactation(e.target.value)}
              placeholder="0"
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
          <Button onClick={submit} disabled={pending || !naturalKey}>
            {pending ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
