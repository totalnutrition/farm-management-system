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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAnimalIntake } from "./actions";

type Cohort =
  | "lactating"
  | "dry"
  | "bred_heifer"
  | "open_heifer"
  | "calf";

const COHORTS: { value: Cohort; label: string }[] = [
  { value: "lactating", label: "Lactating cow" },
  { value: "dry", label: "Dry cow" },
  { value: "bred_heifer", label: "Bred heifer" },
  { value: "open_heifer", label: "Open heifer" },
  { value: "calf", label: "Calf" },
];

const today = () => new Date().toISOString().slice(0, 10);

const blank = {
  cohort: "lactating" as Cohort,
  animalId: "",
  name: "",
  breed: "",
  birthDate: "",
  lactation: "",
  freshDate: "",
  lastBredDate: "",
  serviceSire: "",
  dueDate: "",
  dryOffDate: "",
  pen: "",
  eid: "",
  damId: "",
  sireId: "",
  registration: "",
  entryReason: "",
  entryDate: today(),
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function AddAnimal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof blank, v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  const calved = f.cohort === "lactating" || f.cohort === "dry";
  const canBred = calved || f.cohort === "bred_heifer";

  const submit = () =>
    start(async () => {
      const res = await createAnimalIntake({
        ...f,
        lactation: Number(f.lactation || 0),
      });
      if (res.error) return void toast.error(res.error);
      toast.success(`${f.animalId} registered.`);
      setF({ ...blank, entryDate: today() });
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add animal</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Register animal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Cohort">
            <Select
              value={f.cohort}
              onValueChange={(v) => set("cohort", v as Cohort)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COHORTS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Animal ID *">
              <Input
                className="h-8 text-xs"
                value={f.animalId}
                onChange={(e) => set("animalId", e.target.value)}
                placeholder="1001"
              />
            </Field>
            <Field label="Name">
              <Input
                className="h-8 text-xs"
                value={f.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="Breed">
              <Input
                className="h-8 text-xs"
                value={f.breed}
                onChange={(e) => set("breed", e.target.value)}
                placeholder="HO"
              />
            </Field>
            <Field label="Birth date">
              <Input
                type="date"
                className="h-8 text-xs"
                value={f.birthDate}
                onChange={(e) => set("birthDate", e.target.value)}
              />
            </Field>
            <Field label="Lactation #">
              <Input
                type="number"
                min={0}
                className="h-8 text-xs"
                value={f.lactation}
                onChange={(e) => set("lactation", e.target.value)}
                placeholder={calved ? "1" : "0"}
              />
            </Field>
            <Field label="Pen">
              <Input
                className="h-8 text-xs"
                value={f.pen}
                onChange={(e) => set("pen", e.target.value)}
              />
            </Field>

            {calved && (
              <Field label="Fresh (last calving) date *">
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={f.freshDate}
                  onChange={(e) => set("freshDate", e.target.value)}
                />
              </Field>
            )}
            {f.cohort === "dry" && (
              <Field label="Dry-off date *">
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={f.dryOffDate}
                  onChange={(e) => set("dryOffDate", e.target.value)}
                />
              </Field>
            )}
            {canBred && (
              <>
                <Field
                  label={`Last bred date${
                    f.cohort === "bred_heifer" ? " *" : ""
                  }`}
                >
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={f.lastBredDate}
                    onChange={(e) => set("lastBredDate", e.target.value)}
                  />
                </Field>
                <Field label="Service sire">
                  <Input
                    className="h-8 text-xs"
                    value={f.serviceSire}
                    onChange={(e) => set("serviceSire", e.target.value)}
                  />
                </Field>
                <Field label="Due date (if pregnant)">
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={f.dueDate}
                    onChange={(e) => set("dueDate", e.target.value)}
                  />
                </Field>
              </>
            )}

            <Field label="Electronic ID (EID)">
              <Input
                className="h-8 text-xs"
                value={f.eid}
                onChange={(e) => set("eid", e.target.value)}
              />
            </Field>
            <Field label="Dam ID">
              <Input
                className="h-8 text-xs"
                value={f.damId}
                onChange={(e) => set("damId", e.target.value)}
              />
            </Field>
            <Field label="Sire ID">
              <Input
                className="h-8 text-xs"
                value={f.sireId}
                onChange={(e) => set("sireId", e.target.value)}
              />
            </Field>
            <Field label="Registration #">
              <Input
                className="h-8 text-xs"
                value={f.registration}
                onChange={(e) => set("registration", e.target.value)}
              />
            </Field>
            <Field label="Entry reason">
              <Input
                className="h-8 text-xs"
                value={f.entryReason}
                onChange={(e) => set("entryReason", e.target.value)}
                placeholder="born / purchased / existing"
              />
            </Field>
            <Field label="Entry date *">
              <Input
                type="date"
                className="h-8 text-xs"
                value={f.entryDate}
                onChange={(e) => set("entryDate", e.target.value)}
              />
            </Field>
          </div>

          <p className="text-[11px] text-muted-foreground">
            The snapshot becomes seed events (FRESH/BRED/DRY) so DIM,
            repro and grouping are correct immediately.
          </p>
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
            disabled={pending || !f.animalId || !f.entryDate}
          >
            {pending ? "Registering…" : "Register"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
