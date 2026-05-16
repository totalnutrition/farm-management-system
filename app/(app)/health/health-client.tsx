"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDrug, deleteDrug, recordTreatment } from "./actions";

export type DrugRow = {
  id: string;
  name: string;
  milkDays: number;
  meatDays: number;
  route: string | null;
};
export type DnsRow = {
  animalId: string;
  milkUntil: string | null;
  meatUntil: string | null;
  lastTreated: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

export function HealthClient({
  drugs,
  animals,
  dns,
}: {
  drugs: DrugRow[];
  animals: string[];
  dns: DnsRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dn, setDn] = useState("");
  const [dmilk, setDmilk] = useState("");
  const [dmeat, setDmeat] = useState("");
  const [droute, setDroute] = useState("");
  const [tAnimal, setTAnimal] = useState("");
  const [tDrug, setTDrug] = useState("");
  const [tDate, setTDate] = useState(today());
  const [tDose, setTDose] = useState("");

  const addDrug = () =>
    start(async () => {
      const res = await createDrug({
        name: dn,
        milkDays: Number(dmilk || 0),
        meatDays: Number(dmeat || 0),
        route: droute || undefined,
      });
      if (res.error) return void toast.error(res.error);
      toast.success(`Drug “${dn}” added.`);
      setDn("");
      setDmilk("");
      setDmeat("");
      setDroute("");
      router.refresh();
    });

  const delDrug = (d: DrugRow) =>
    start(async () => {
      const res = await deleteDrug(d.id);
      if (res.error) return void toast.error(res.error);
      toast.success(`Deleted “${d.name}”.`);
      router.refresh();
    });

  const treat = () =>
    start(async () => {
      const res = await recordTreatment({
        animalId: tAnimal,
        drug: tDrug,
        date: tDate,
        dose: tDose || undefined,
      });
      if (res.error) return void toast.error(res.error);
      toast.success(`Treated ${tAnimal} with ${tDrug}.`);
      setTDose("");
      router.refresh();
    });

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-medium">
          Do-not-ship ({dns.length})
        </h2>
        {dns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No animals on milk withhold.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Animal</th>
                  <th className="px-3 py-2 text-left">Milk OK after</th>
                  <th className="px-3 py-2 text-left">Meat OK after</th>
                  <th className="px-3 py-2 text-left">Last treated</th>
                </tr>
              </thead>
              <tbody>
                {dns.map((r) => (
                  <tr key={r.animalId} className="border-t">
                    <td className="px-3 py-2 font-medium">{r.animalId}</td>
                    <td className="px-3 py-2 text-destructive">
                      {r.milkUntil ?? "—"}
                    </td>
                    <td className="px-3 py-2">{r.meatUntil ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.lastTreated ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Record treatment</h2>
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Animal</Label>
              <Select value={tAnimal} onValueChange={setTAnimal}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue placeholder="animal" />
                </SelectTrigger>
                <SelectContent>
                  {animals.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      no animals
                    </SelectItem>
                  ) : (
                    animals.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Drug</Label>
              <Select value={tDrug} onValueChange={setTDrug}>
                <SelectTrigger className="h-8 w-[150px] text-xs">
                  <SelectValue placeholder="drug" />
                </SelectTrigger>
                <SelectContent>
                  {drugs.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      add a drug first
                    </SelectItem>
                  ) : (
                    drugs.map((d) => (
                      <SelectItem key={d.id} value={d.name}>
                        {d.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                className="h-8 w-36 text-xs"
                type="date"
                value={tDate}
                onChange={(e) => setTDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dose</Label>
              <Input
                className="h-8 w-24 text-xs"
                value={tDose}
                onChange={(e) => setTDose(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              disabled={pending || !tAnimal || !tDrug}
              onClick={treat}
            >
              Record
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Drug catalog</h2>
        {drugs.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Drug</th>
                  <th className="px-3 py-2 text-left">Milk withhold (d)</th>
                  <th className="px-3 py-2 text-left">Meat withhold (d)</th>
                  <th className="px-3 py-2 text-left">Route</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {drugs.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{d.name}</td>
                    <td className="px-3 py-2">{d.milkDays}</td>
                    <td className="px-3 py-2">{d.meatDays}</td>
                    <td className="px-3 py-2">{d.route ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => delDrug(d)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Drug name</Label>
              <Input
                className="h-8 w-44 text-xs"
                value={dn}
                onChange={(e) => setDn(e.target.value)}
                placeholder="Excede"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Milk withhold (days)</Label>
              <Input
                className="h-8 w-28 text-xs"
                type="number"
                value={dmilk}
                onChange={(e) => setDmilk(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Meat withhold (days)</Label>
              <Input
                className="h-8 w-28 text-xs"
                type="number"
                value={dmeat}
                onChange={(e) => setDmeat(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Route</Label>
              <Input
                className="h-8 w-28 text-xs"
                value={droute}
                onChange={(e) => setDroute(e.target.value)}
                placeholder="IM"
              />
            </div>
            <Button
              size="sm"
              disabled={pending || !dn}
              onClick={addDrug}
            >
              Add drug
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
