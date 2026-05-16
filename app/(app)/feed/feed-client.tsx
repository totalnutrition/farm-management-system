"use client";

import { useMemo, useState, useTransition } from "react";
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
import { computeRation, type Material } from "@/lib/derive/ration";
import {
  createMaterial,
  deleteMaterial,
  createRation,
  deleteRation,
  recordFeeding,
} from "./actions";

export type MaterialRow = {
  id: string;
  name: string;
  dmPct: number;
  cost: number;
  cp: number | null;
  nel: number | null;
  ndf: number | null;
  stock: number;
};
export type RationRow = {
  id: string;
  name: string;
  costPerKg: number;
  dmKg: number;
  cpPct: number;
  recipe: { material: string; dmKg: number }[];
};
export type PenFeed = {
  pen: string;
  kg: number | null;
  refused: number | null;
  cost: number | null;
  shrink: number | null;
};

const today = () => new Date().toISOString().slice(0, 10);

export function FeedClient({
  materials,
  rations,
  pens,
  penFeed,
}: {
  materials: MaterialRow[];
  rations: RationRow[];
  pens: string[];
  penFeed: PenFeed[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // materials
  const [mn, setMn] = useState("");
  const [mdm, setMdm] = useState("");
  const [mcost, setMcost] = useState("");
  const [mcp, setMcp] = useState("");
  const [mnel, setMnel] = useState("");
  const [mndf, setMndf] = useState("");

  // ration recipe builder
  const [rn, setRn] = useState("");
  const [lines, setLines] = useState<{ material: string; dmKg: string }[]>(
    [{ material: "", dmKg: "" }],
  );

  // feeding
  const [fpen, setFpen] = useState("");
  const [fration, setFration] = useState("");
  const [fkg, setFkg] = useState("");
  const [fref, setFref] = useState("");
  const [fdate, setFdate] = useState(today());

  const catalog = useMemo(() => {
    const c: Record<string, Material> = {};
    for (const m of materials)
      c[m.name] = {
        dmPct: m.dmPct,
        costPerKgAsFed: m.cost,
        cp: m.cp ?? undefined,
        nel: m.nel ?? undefined,
        ndf: m.ndf ?? undefined,
      };
    return c;
  }, [materials]);

  const preview = useMemo(
    () =>
      computeRation(
        lines
          .filter((l) => l.material && l.dmKg !== "")
          .map((l) => ({ material: l.material, dmKg: Number(l.dmKg) })),
        catalog,
      ),
    [lines, catalog],
  );

  const addMaterial = () =>
    start(async () => {
      const res = await createMaterial({
        name: mn,
        dmPct: Number(mdm),
        costPerKgAsFed: Number(mcost || 0),
        cp: mcp ? Number(mcp) : undefined,
        nel: mnel ? Number(mnel) : undefined,
        ndf: mndf ? Number(mndf) : undefined,
      });
      if (res.error) return void toast.error(res.error);
      toast.success(`Material “${mn}” added.`);
      setMn(""); setMdm(""); setMcost(""); setMcp(""); setMnel(""); setMndf("");
      router.refresh();
    });

  const saveRation = () =>
    start(async () => {
      const recipe = lines
        .filter((l) => l.material && l.dmKg !== "")
        .map((l) => ({ material: l.material, dmKg: Number(l.dmKg) }));
      if (!recipe.length)
        return void toast.error("Add at least one ingredient.");
      const res = await createRation({ name: rn, recipe });
      if (res.error) return void toast.error(res.error);
      toast.success(`Ration “${rn}” saved.`);
      setRn("");
      setLines([{ material: "", dmKg: "" }]);
      router.refresh();
    });

  const feed = () =>
    start(async () => {
      const res = await recordFeeding({
        penNo: fpen,
        ration: fration,
        kg: Number(fkg),
        refusedKg: fref ? Number(fref) : undefined,
        date: fdate,
      });
      if (res.error) return void toast.error(res.error);
      toast.success(`Fed pen ${fpen}.`);
      setFkg(""); setFref("");
      router.refresh();
    });

  const del = (
    fn: (id: string) => Promise<{ error?: string }>,
    id: string,
    label: string,
  ) =>
    start(async () => {
      const res = await fn(id);
      if (res.error) return void toast.error(res.error);
      toast.success(`Deleted ${label}.`);
      router.refresh();
    });

  return (
    <div className="space-y-8">
      {/* pen feed summary */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Pen feed summary</h2>
        {penFeed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No feeding recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Pen</th>
                  <th className="px-3 py-2 text-left">Delivered (kg)</th>
                  <th className="px-3 py-2 text-left">Refused (kg)</th>
                  <th className="px-3 py-2 text-left">Cost</th>
                  <th className="px-3 py-2 text-left">Shrink %</th>
                </tr>
              </thead>
              <tbody>
                {penFeed.map((p) => (
                  <tr key={p.pen} className="border-t">
                    <td className="px-3 py-2 font-medium">{p.pen}</td>
                    <td className="px-3 py-2">{p.kg ?? "—"}</td>
                    <td className="px-3 py-2">{p.refused ?? "—"}</td>
                    <td className="px-3 py-2">{p.cost ?? "—"}</td>
                    <td className="px-3 py-2">{p.shrink ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* record feeding */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Record feeding</h2>
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 py-4">
            <PickField label="Pen" value={fpen} onChange={setFpen} options={pens} ph="pen" />
            <PickField label="Ration" value={fration} onChange={setFration} options={rations.map((r) => r.name)} ph="ration" />
            <NumField label="Delivered kg" value={fkg} onChange={setFkg} />
            <NumField label="Refused kg" value={fref} onChange={setFref} />
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input className="h-8 w-36 text-xs" type="date" value={fdate} onChange={(e) => setFdate(e.target.value)} />
            </div>
            <Button size="sm" disabled={pending || !fpen || !fration || !fkg} onClick={feed}>
              Record
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* rations */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Rations (DM-basis recipe)</h2>
        {rations.length > 0 && (
          <div className="space-y-2">
            {rations.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.dmKg} kg DM · {r.cpPct}% CP · cost/kg as-fed{" "}
                      {r.costPerKg} ·{" "}
                      {r.recipe
                        .map((l) => `${l.material} ${l.dmKg}kgDM`)
                        .join(", ")}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => del(deleteRation, r.id, r.name)}>
                    Delete
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Ration name</Label>
              <Input className="h-8 w-56 text-xs" value={rn} onChange={(e) => setRn(e.target.value)} placeholder="Lactating TMR" />
            </div>
            {lines.map((l, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Select
                  value={l.material}
                  onValueChange={(v) =>
                    setLines((s) => s.map((x, j) => (j === i ? { ...x, material: v } : x)))
                  }
                >
                  <SelectTrigger className="h-7 w-[170px] text-xs">
                    <SelectValue placeholder="material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        add materials first
                      </SelectItem>
                    ) : (
                      materials.map((m) => (
                        <SelectItem key={m.id} value={m.name}>
                          {m.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Input
                  className="h-7 w-24 text-xs"
                  type="number"
                  placeholder="kg DM"
                  value={l.dmKg}
                  onChange={(e) =>
                    setLines((s) => s.map((x, j) => (j === i ? { ...x, dmKg: e.target.value } : x)))
                  }
                />
                <button
                  type="button"
                  aria-label="remove"
                  className="px-1 text-muted-foreground hover:text-destructive"
                  onClick={() => setLines((s) => s.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLines((s) => [...s, { material: "", dmKg: "" }])}
              className="rounded border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
            >
              + ingredient
            </button>
            {preview.lines.length > 0 && (
              <div className="rounded bg-muted/40 p-2 text-xs">
                <p className="mb-1 font-medium">
                  As-fed mix · {preview.totalAsFedKg} kg · {preview.totalDmKg} kg DM ·{" "}
                  {preview.cpPct}% CP · NEL {preview.nel} · cost{" "}
                  {preview.totalCost}
                </p>
                {preview.lines.map((l) => (
                  <div key={l.material} className="text-muted-foreground">
                    {l.material}: {l.asFedKg} kg as-fed ({l.dmKg} kg DM)
                  </div>
                ))}
              </div>
            )}
            <Button size="sm" disabled={pending || !rn} onClick={saveRation}>
              Save ration
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* materials */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Materials</h2>
        {materials.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Material</th>
                  <th className="px-3 py-2 text-left">DM %</th>
                  <th className="px-3 py-2 text-left">Cost/kg</th>
                  <th className="px-3 py-2 text-left">CP %</th>
                  <th className="px-3 py-2 text-left">NEL</th>
                  <th className="px-3 py-2 text-left">NDF %</th>
                  <th className="px-3 py-2 text-left">Stock kg</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{m.name}</td>
                    <td className="px-3 py-2">{m.dmPct}</td>
                    <td className="px-3 py-2">{m.cost}</td>
                    <td className="px-3 py-2">{m.cp ?? "—"}</td>
                    <td className="px-3 py-2">{m.nel ?? "—"}</td>
                    <td className="px-3 py-2">{m.ndf ?? "—"}</td>
                    <td className="px-3 py-2">{m.stock}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => del(deleteMaterial, m.id, m.name)}>
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
            <TextField label="Name" value={mn} onChange={setMn} w="w-40" />
            <NumField label="DM %" value={mdm} onChange={setMdm} />
            <NumField label="Cost/kg as-fed" value={mcost} onChange={setMcost} />
            <NumField label="CP % (DM)" value={mcp} onChange={setMcp} />
            <NumField label="NEL Mcal/kgDM" value={mnel} onChange={setMnel} />
            <NumField label="NDF % (DM)" value={mndf} onChange={setMndf} />
            <Button size="sm" disabled={pending || !mn || !mdm} onClick={addMaterial}>
              Add material
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  w = "w-28",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  w?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input className={`h-8 ${w} text-xs`} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input className="h-8 w-28 text-xs" type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function PickField({
  label,
  value,
  onChange,
  options,
  ph,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  ph: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue placeholder={ph} />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <SelectItem value="__none" disabled>
              none
            </SelectItem>
          ) : (
            options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
