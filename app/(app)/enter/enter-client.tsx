"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EC } from "@/lib/derive/engine";
import { recordEvent, recordMilking } from "../records/actions";
import {
  recordTreatment,
  recordVaccination,
} from "../health/actions";
import { resolveAnimals } from "./actions";

type Kind = "event" | "treat" | "vax" | "milk";
type Spec = {
  kind: Kind;
  code: string; // generic event code
  item: string; // drug / vaccine / genetic material
  qty: string;
  dose: string;
  remark: string;
  yieldKg: string;
  fat: string;
  prot: string;
  date: string;
};
type RowResult = { id: string; ok: boolean; msg: string };

const today = () => new Date().toISOString().slice(0, 10);
const blankSpec = (): Spec => ({
  kind: "event",
  code: "",
  item: "",
  qty: "1",
  dose: "",
  remark: "",
  yieldKg: "",
  fat: "",
  prot: "",
  date: today(),
});

// Dispatch one spec to the matching safe server action. `animalId`
// is the natural key (treatment/vaccination); `subjectId` the uuid
// (generic event / milking).
async function applySpec(
  spec: Spec,
  animalId: string,
  subjectId: string,
): Promise<{ ok: boolean; msg: string }> {
  if (spec.kind === "treat" || spec.kind === "vax") {
    if (!spec.item) return { ok: false, msg: "No item selected." };
    const fn = spec.kind === "treat" ? recordTreatment : recordVaccination;
    const r = await fn({
      animalId,
      item: spec.item,
      date: spec.date,
      dose: spec.dose || undefined,
      qty: spec.qty ? Number(spec.qty) : undefined,
    });
    return r.error
      ? { ok: false, msg: r.error }
      : { ok: true, msg: spec.kind === "treat" ? "treated" : "vaccinated" };
  }
  if (spec.kind === "milk") {
    if (!spec.yieldKg) return { ok: false, msg: "No yield." };
    const r = await recordMilking({
      subjectId,
      date: spec.date,
      yieldKg: Number(spec.yieldKg),
      fat: spec.fat ? Number(spec.fat) : undefined,
      prot: spec.prot ? Number(spec.prot) : undefined,
    });
    return r.error
      ? { ok: false, msg: r.error }
      : { ok: true, msg: "milk recorded" };
  }
  // generic event (incl. breeding when code === BRED)
  if (!spec.code) return { ok: false, msg: "No event code." };
  const isBred = Number(spec.code) === EC.BRED;
  const r = await recordEvent({
    subjectId,
    eventCode: Number(spec.code),
    eventDate: spec.date,
    remark: spec.remark || undefined,
    material: isBred && spec.item ? spec.item : undefined,
    materialQty:
      isBred && spec.item && spec.qty ? Number(spec.qty) : undefined,
  });
  return r.error
    ? { ok: false, msg: r.error }
    : { ok: true, msg: "recorded" };
}

function SpecForm({
  spec,
  set,
  codes,
  allItems,
  vetItems,
}: {
  spec: Spec;
  set: (patch: Partial<Spec>) => void;
  codes: { code: number; label: string }[];
  allItems: string[];
  vetItems: string[];
}) {
  const isBred =
    spec.kind === "event" &&
    spec.code !== "" &&
    Number(spec.code) === EC.BRED;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Type</Label>
        <Select
          value={spec.kind}
          onValueChange={(v) => set({ kind: v as Kind })}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="event">Event</SelectItem>
            <SelectItem value="treat">Treatment</SelectItem>
            <SelectItem value="vax">Vaccination</SelectItem>
            <SelectItem value="milk">Milking</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {spec.kind === "event" && (
        <div className="space-y-1">
          <Label className="text-xs">Event code</Label>
          <Select
            value={spec.code}
            onValueChange={(v) => set({ code: v })}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="code" />
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
      )}

      {(spec.kind === "treat" || spec.kind === "vax" || isBred) && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">
              {isBred ? "Genetic material" : "Item"}
            </Label>
            <Select
              value={spec.item}
              onValueChange={(v) => set({ item: v })}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="item" />
              </SelectTrigger>
              <SelectContent>
                {(isBred ? allItems : vetItems).map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Qty used</Label>
            <Input
              className="h-8 w-20 text-xs"
              type="number"
              value={spec.qty}
              onChange={(e) => set({ qty: e.target.value })}
            />
          </div>
        </>
      )}

      {(spec.kind === "treat" || spec.kind === "vax") && (
        <div className="space-y-1">
          <Label className="text-xs">Dose</Label>
          <Input
            className="h-8 w-24 text-xs"
            value={spec.dose}
            onChange={(e) => set({ dose: e.target.value })}
          />
        </div>
      )}

      {spec.kind === "event" && !isBred && (
        <div className="space-y-1">
          <Label className="text-xs">Remark</Label>
          <Input
            className="h-8 w-40 text-xs"
            value={spec.remark}
            onChange={(e) => set({ remark: e.target.value })}
          />
        </div>
      )}

      {spec.kind === "milk" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Yield kg</Label>
            <Input
              className="h-8 w-24 text-xs"
              type="number"
              value={spec.yieldKg}
              onChange={(e) => set({ yieldKg: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fat %</Label>
            <Input
              className="h-8 w-20 text-xs"
              type="number"
              value={spec.fat}
              onChange={(e) => set({ fat: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Prot %</Label>
            <Input
              className="h-8 w-20 text-xs"
              type="number"
              value={spec.prot}
              onChange={(e) => set({ prot: e.target.value })}
            />
          </div>
        </>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Date</Label>
        <Input
          className="h-8 w-36 text-xs"
          type="date"
          value={spec.date}
          onChange={(e) => set({ date: e.target.value })}
        />
      </div>
    </div>
  );
}

function Results({ rows }: { rows: RowResult[] }) {
  if (rows.length === 0) return null;
  const ok = rows.filter((r) => r.ok).length;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {ok} ok, {rows.length - ok} failed
      </p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-1.5 font-medium">{r.id}</td>
                <td
                  className={
                    "px-3 py-1.5 " +
                    (r.ok
                      ? "text-muted-foreground"
                      : "text-destructive")
                  }
                >
                  {r.ok ? `✓ ${r.msg}` : `✗ ${r.msg}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EnterClient({
  animals,
  codes,
  allItems,
  vetItems,
}: {
  animals: string[];
  codes: { code: number; label: string }[];
  allItems: string[];
  vetItems: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"batch" | "single">("batch");

  // batch
  const [ids, setIds] = useState("");
  const [bSpec, setBSpec] = useState<Spec>(blankSpec());
  const [bRes, setBRes] = useState<RowResult[]>([]);

  // single
  const [animal, setAnimal] = useState("");
  const [specs, setSpecs] = useState<Spec[]>([blankSpec()]);
  const [sRes, setSRes] = useState<RowResult[]>([]);

  const runBatch = () =>
    start(async () => {
      const list = ids.split(/[\s,]+/).filter(Boolean);
      if (list.length === 0)
        return void toast.error("Enter at least one animal ID.");
      const resolved = await resolveAnimals(list);
      if ("error" in resolved)
        return void toast.error(resolved.error);
      const results: RowResult[] = resolved.missing.map((id) => ({
        id,
        ok: false,
        msg: "animal not found",
      }));
      for (const id of list) {
        const sid = resolved.map[id];
        if (!sid) continue;
        const r = await applySpec(bSpec, id, sid);
        results.push({ id, ok: r.ok, msg: r.msg });
      }
      setBRes(results);
      const ok = results.filter((r) => r.ok).length;
      if (ok) toast.success(`${ok} recorded.`);
      router.refresh();
    });

  const runSingle = () =>
    start(async () => {
      if (!animal) return void toast.error("Enter an animal ID.");
      const resolved = await resolveAnimals([animal]);
      if ("error" in resolved)
        return void toast.error(resolved.error);
      const sid = resolved.map[animal];
      if (!sid) {
        setSRes([{ id: animal, ok: false, msg: "animal not found" }]);
        return;
      }
      const results: RowResult[] = [];
      for (let i = 0; i < specs.length; i++) {
        const r = await applySpec(specs[i], animal, sid);
        results.push({
          id: `#${i + 1} ${specs[i].kind}`,
          ok: r.ok,
          msg: r.msg,
        });
      }
      setSRes(results);
      const ok = results.filter((r) => r.ok).length;
      if (ok) toast.success(`${ok} recorded for ${animal}.`);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={tab === "batch" ? "default" : "outline"}
          onClick={() => setTab("batch")}
        >
          One event → many animals
        </Button>
        <Button
          size="sm"
          variant={tab === "single" ? "default" : "outline"}
          onClick={() => setTab("single")}
        >
          One animal → many events
        </Button>
      </div>

      {tab === "batch" ? (
        <Card>
          <CardContent className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-xs">
                Animal IDs (space, comma or newline separated)
              </Label>
              <Textarea
                className="min-h-20 font-mono text-xs"
                value={ids}
                onChange={(e) => setIds(e.target.value)}
                placeholder="101 102 103"
              />
            </div>
            <SpecForm
              spec={bSpec}
              set={(p) => setBSpec((s) => ({ ...s, ...p }))}
              codes={codes}
              allItems={allItems}
              vetItems={vetItems}
            />
            <Button size="sm" disabled={pending} onClick={runBatch}>
              Apply to all
            </Button>
            <Results rows={bRes} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Animal ID</Label>
              <Input
                list="enter-animals"
                className="h-8 w-40 text-xs"
                value={animal}
                onChange={(e) => setAnimal(e.target.value)}
                placeholder="101"
              />
              <datalist id="enter-animals">
                {animals.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
            <div className="space-y-3">
              {specs.map((sp, i) => (
                <div
                  key={i}
                  className="flex items-end gap-2 border-l-2 border-border pl-3"
                >
                  <SpecForm
                    spec={sp}
                    set={(p) =>
                      setSpecs((arr) =>
                        arr.map((x, j) =>
                          j === i ? { ...x, ...p } : x,
                        ),
                      )
                    }
                    codes={codes}
                    allItems={allItems}
                    vetItems={vetItems}
                  />
                  {specs.length > 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setSpecs((arr) =>
                          arr.filter((_, j) => j !== i),
                        )
                      }
                    >
                      ✕
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setSpecs((arr) => [...arr, blankSpec()])
                }
              >
                + Add event
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={runSingle}
              >
                Record all
              </Button>
            </div>
            <Results rows={sRes} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
