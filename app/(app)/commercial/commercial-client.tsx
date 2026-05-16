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
import type { Pnl } from "@/lib/derive/pnl";
import { createParty, deleteParty, recordTxn } from "./actions";

export type PartyRow = { id: string; name: string };
type Recent = {
  kind: string;
  category: string;
  amount: number;
  party: string | null;
  date: string;
};

const SALE_CATS = ["milk", "cull", "animal", "calf", "other"];
const BUY_CATS = ["feed", "drugs", "supplies", "semen", "labour", "other"];
const today = () => new Date().toISOString().slice(0, 10);

export function CommercialClient({
  vendors,
  customers,
  pnl,
  recent,
}: {
  vendors: PartyRow[];
  customers: PartyRow[];
  pnl: Pnl;
  recent: Recent[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sCat, setSCat] = useState("milk");
  const [sAmt, setSAmt] = useState("");
  const [sParty, setSParty] = useState("");
  const [sDate, setSDate] = useState(today());
  const [bCat, setBCat] = useState("feed");
  const [bAmt, setBAmt] = useState("");
  const [bParty, setBParty] = useState("");
  const [bDate, setBDate] = useState(today());
  const [vn, setVn] = useState("");
  const [cn, setCn] = useState("");

  const act = (fn: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) return void toast.error(res.error);
      toast.success(ok);
      router.refresh();
    });

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Revenue", pnl.revenue],
          ["Cost", pnl.cost],
          ["Gross", pnl.gross],
        ].map(([k, v]) => (
          <Card key={k as string}>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p
                className={
                  "font-heading text-2xl font-semibold " +
                  (k === "Gross" && (v as number) < 0
                    ? "text-destructive"
                    : "")
                }
              >
                {v as number}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {Object.keys(pnl.byCategory).length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Revenue</th>
                <th className="px-3 py-2 text-left">Cost</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(pnl.byCategory).map(([c, v]) => (
                <tr key={c} className="border-t">
                  <td className="px-3 py-2 font-medium">{c}</td>
                  <td className="px-3 py-2">{v.revenue}</td>
                  <td className="px-3 py-2">{v.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 py-4">
            <h2 className="text-sm font-medium">Record sale</h2>
            <div className="flex flex-wrap items-end gap-2">
              <Sel label="Category" v={sCat} set={setSCat} opts={SALE_CATS} />
              <Num label="Amount" v={sAmt} set={setSAmt} />
              <Sel
                label="Customer"
                v={sParty}
                set={setSParty}
                opts={customers.map((c) => c.name)}
                ph="optional"
              />
              <Dt v={sDate} set={setSDate} />
              <Button
                size="sm"
                disabled={pending || !sAmt}
                onClick={() =>
                  act(
                    () =>
                      recordTxn({
                        kind: "sale",
                        category: sCat,
                        amount: Number(sAmt),
                        party: sParty || undefined,
                        date: sDate,
                      }),
                    "Sale recorded.",
                  )
                }
              >
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 py-4">
            <h2 className="text-sm font-medium">Record purchase</h2>
            <div className="flex flex-wrap items-end gap-2">
              <Sel label="Category" v={bCat} set={setBCat} opts={BUY_CATS} />
              <Num label="Amount" v={bAmt} set={setBAmt} />
              <Sel
                label="Vendor"
                v={bParty}
                set={setBParty}
                opts={vendors.map((c) => c.name)}
                ph="optional"
              />
              <Dt v={bDate} set={setBDate} />
              <Button
                size="sm"
                disabled={pending || !bAmt}
                onClick={() =>
                  act(
                    () =>
                      recordTxn({
                        kind: "purchase",
                        category: bCat,
                        amount: Number(bAmt),
                        party: bParty || undefined,
                        date: bDate,
                      }),
                    "Purchase recorded.",
                  )
                }
              >
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {recent.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Recent entries</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Amount</th>
                  <th className="px-3 py-2 text-left">Party</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{r.date}</td>
                    <td className="px-3 py-2">{r.kind}</td>
                    <td className="px-3 py-2">{r.category}</td>
                    <td className="px-3 py-2">{r.amount}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.party ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Catalog
          title="Vendors"
          rows={vendors}
          value={vn}
          setValue={setVn}
          onAdd={() =>
            start(async () => {
              const res = await createParty({ kind: "vendor", name: vn });
              if (res.error) return void toast.error(res.error);
              toast.success(`Vendor “${vn}” added.`);
              setVn("");
              router.refresh();
            })
          }
          onDel={(id, name) =>
            act(() => deleteParty(id), `Deleted ${name}.`)
          }
          pending={pending}
        />
        <Catalog
          title="Customers"
          rows={customers}
          value={cn}
          setValue={setCn}
          onAdd={() =>
            start(async () => {
              const res = await createParty({ kind: "customer", name: cn });
              if (res.error) return void toast.error(res.error);
              toast.success(`Customer “${cn}” added.`);
              setCn("");
              router.refresh();
            })
          }
          onDel={(id, name) =>
            act(() => deleteParty(id), `Deleted ${name}.`)
          }
          pending={pending}
        />
      </div>
    </div>
  );
}

function Sel({
  label,
  v,
  set,
  opts,
  ph,
}: {
  label: string;
  v: string;
  set: (s: string) => void;
  opts: string[];
  ph?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={v || "__"} onValueChange={(x) => set(x === "__" ? "" : x)}>
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue placeholder={ph ?? "select"} />
        </SelectTrigger>
        <SelectContent>
          {ph && <SelectItem value="__">{ph}</SelectItem>}
          {opts.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function Num({
  label,
  v,
  set,
}: {
  label: string;
  v: string;
  set: (s: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        className="h-8 w-24 text-xs"
        type="number"
        value={v}
        onChange={(e) => set(e.target.value)}
      />
    </div>
  );
}
function Dt({ v, set }: { v: string; set: (s: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">Date</Label>
      <Input
        className="h-8 w-36 text-xs"
        type="date"
        value={v}
        onChange={(e) => set(e.target.value)}
      />
    </div>
  );
}
function Catalog({
  title,
  rows,
  value,
  setValue,
  onAdd,
  onDel,
  pending,
}: {
  title: string;
  rows: PartyRow[];
  value: string;
  setValue: (s: string) => void;
  onAdd: () => void;
  onDel: (id: string, name: string) => void;
  pending: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <h2 className="text-sm font-medium">{title}</h2>
        {rows.length > 0 && (
          <div className="space-y-1">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between text-sm"
              >
                <span>{r.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => onDel(r.id, r.name)}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Input
            className="h-8 w-44 text-xs"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`New ${title.slice(0, -1).toLowerCase()}`}
          />
          <Button
            size="sm"
            disabled={pending || !value}
            onClick={onAdd}
          >
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
