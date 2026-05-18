"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { PathSupply } from "@/lib/misc";
import { updateDrugClinical, recordTreatment } from "./actions";

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

function ClinicalRow({
  d,
  pending,
  onSave,
}: {
  d: DrugRow;
  pending: boolean;
  onSave: (
    id: string,
    milk: number,
    meat: number,
    route: string,
  ) => void;
}) {
  const [milk, setMilk] = useState(String(d.milkDays));
  const [meat, setMeat] = useState(String(d.meatDays));
  const [route, setRoute] = useState(d.route ?? "");
  const dirty =
    milk !== String(d.milkDays) ||
    meat !== String(d.meatDays) ||
    route !== (d.route ?? "");
  return (
    <tr className="border-t">
      <td className="px-3 py-2 font-medium">{d.name}</td>
      <td className="px-3 py-2">
        <Input
          className="h-7 w-20 text-xs"
          type="number"
          value={milk}
          onChange={(e) => setMilk(e.target.value)}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          className="h-7 w-20 text-xs"
          type="number"
          value={meat}
          onChange={(e) => setMeat(e.target.value)}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          className="h-7 w-24 text-xs"
          value={route}
          onChange={(e) => setRoute(e.target.value)}
          placeholder="IM"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <Button
          size="sm"
          variant="ghost"
          disabled={pending || !dirty}
          onClick={() =>
            onSave(d.id, Number(milk || 0), Number(meat || 0), route)
          }
        >
          Save
        </Button>
      </td>
    </tr>
  );
}

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
  const [tAnimal, setTAnimal] = useState("");
  const [tDrug, setTDrug] = useState("");
  const [tDate, setTDate] = useState(today());
  const [tDose, setTDose] = useState("");

  const saveClinical = (
    id: string,
    milk: number,
    meat: number,
    route: string,
  ) =>
    start(async () => {
      const res = await updateDrugClinical({
        id,
        milkDays: milk,
        meatDays: meat,
        route: route || undefined,
      });
      if (res.error) return void toast.error(res.error);
      toast.success("Withhold updated.");
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
                      add a drug in Supply Chain
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
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Drug withhold</h2>
          <Link
            href={PathSupply}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Manage drugs &amp; stock in Supply Chain →
          </Link>
        </div>
        {drugs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No drugs yet. Add them in Supply Chain under “Veterinary
            Drugs &amp; Vaccines”, then set their withhold here.
          </p>
        ) : (
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
                  <ClinicalRow
                    key={d.id}
                    d={d}
                    pending={pending}
                    onSave={saveClinical}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
