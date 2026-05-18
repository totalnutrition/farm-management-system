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
import {
  UNIT_SUGGESTIONS,
  AUTO_DEDUCT,
  type SupplyItem,
  type StockRow,
  type SupplyMove,
  type MoveKind,
  type AutoDeduct,
} from "@/lib/supply";
import {
  createItem,
  updateItem,
  deleteItem,
  addCategory,
  addMovement,
  deleteMovement,
} from "./actions";

type Tab = "catalogue" | "stock" | "movements";

const TH = "px-2 py-1 text-left font-medium whitespace-nowrap";
const TD = "px-2 py-0.5 whitespace-nowrap";
const NUM = "px-2 py-0.5 text-right tabular-nums whitespace-nowrap";

const todayISO = () => new Date().toISOString().slice(0, 10);

function TabBtn({
  id,
  label,
  tab,
  setTab,
}: {
  id: Tab;
  label: string;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  return (
    <button
      onClick={() => setTab(id)}
      className={`border-b-2 px-3 py-1.5 text-sm ${
        tab === id
          ? "border-primary font-medium"
          : "border-transparent text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export function SupplyClient({
  items,
  stock,
  moves,
  categories,
}: {
  items: SupplyItem[];
  stock: StockRow[];
  moves: SupplyMove[];
  categories: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<Tab>("catalogue");

  // ---- catalogue form (create / edit) ----
  const blank = {
    id: "",
    name: "",
    category: categories[0] ?? "",
    unit: "ea",
    cost: "",
    reorderPoint: "",
    trackLots: false,
    trackExpiry: false,
    autoDeduct: "none" as AutoDeduct,
    notes: "",
  };
  const [f, setF] = useState(blank);
  const [newCat, setNewCat] = useState("");
  const editing = f.id !== "";

  const resetForm = () => setF(blank);

  const saveItem = () =>
    start(async () => {
      const payload = {
        name: f.name,
        category: f.category,
        unit: f.unit,
        cost: f.cost ? Number(f.cost) : undefined,
        reorderPoint: f.reorderPoint ? Number(f.reorderPoint) : undefined,
        trackLots: f.trackLots,
        trackExpiry: f.trackExpiry,
        autoDeduct: f.autoDeduct,
        notes: f.notes || undefined,
      };
      const res = editing
        ? await updateItem({ ...payload, id: f.id })
        : await createItem(payload);
      if (res.error) return void toast.error(res.error);
      toast.success(editing ? "Item updated." : `“${f.name}” added.`);
      resetForm();
      router.refresh();
    });

  const editItem = (i: SupplyItem) => {
    setTab("catalogue");
    setF({
      id: i.id,
      name: i.name,
      category: i.category,
      unit: i.unit,
      cost: i.cost?.toString() ?? "",
      reorderPoint: i.reorderPoint?.toString() ?? "",
      trackLots: i.trackLots,
      trackExpiry: i.trackExpiry,
      autoDeduct: i.autoDeduct,
      notes: i.notes ?? "",
    });
  };

  const removeItem = (i: SupplyItem) =>
    start(async () => {
      const res = await deleteItem(i.id);
      if (res.error) return void toast.error(res.error);
      toast.success(`Deleted “${i.name}”.`);
      if (f.id === i.id) resetForm();
      router.refresh();
    });

  const saveCategory = () =>
    start(async () => {
      const name = newCat.trim();
      if (!name) return;
      const res = await addCategory({ name });
      if (res.error) return void toast.error(res.error);
      toast.success(`Category “${name}” added.`);
      setF((s) => ({ ...s, category: name }));
      setNewCat("");
      router.refresh();
    });

  // ---- movement form ----
  const mBlank = {
    itemId: items[0]?.id ?? "",
    kind: "receive" as MoveKind,
    date: todayISO(),
    qty: "",
    unitCost: "",
    party: "",
    lot: "",
    expiry: "",
    remark: "",
  };
  const [m, setM] = useState(mBlank);

  const saveMove = () =>
    start(async () => {
      if (!m.itemId) return void toast.error("Pick an item first.");
      const res = await addMovement({
        itemId: m.itemId,
        kind: m.kind,
        date: m.date,
        qty: m.qty ? Number(m.qty) : 0,
        unitCost: m.unitCost ? Number(m.unitCost) : undefined,
        party: m.party || undefined,
        lot: m.lot || undefined,
        expiry: m.expiry || undefined,
        remark: m.remark || undefined,
      });
      if (res.error) return void toast.error(res.error);
      toast.success("Movement recorded.");
      setM({ ...mBlank, itemId: m.itemId, kind: m.kind });
      router.refresh();
    });

  const removeMove = (mv: SupplyMove) =>
    start(async () => {
      const res = await deleteMovement(mv.id);
      if (res.error) return void toast.error(res.error);
      router.refresh();
    });

  const totalValue = stock.reduce((a, b) => a + (b.value ?? 0), 0);
  const lowCount = stock.filter((s) => s.low).length;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b">
        <TabBtn
          id="catalogue"
          label={`Catalogue (${items.length})`}
          tab={tab}
          setTab={setTab}
        />
        <TabBtn id="stock" label="Stock" tab={tab} setTab={setTab} />
        <TabBtn
          id="movements"
          label={`Movements (${moves.length})`}
          tab={tab}
          setTab={setTab}
        />
      </div>

      {tab === "catalogue" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="grid grid-cols-2 gap-3 pt-4 md:grid-cols-4">
              <div className="space-y-1">
                <Label>Item name</Label>
                <Input
                  value={f.name}
                  onChange={(e) =>
                    setF((s) => ({ ...s, name: e.target.value }))
                  }
                  placeholder="e.g. Diesel, Teat dip, Mineral premix"
                />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select
                  value={f.category}
                  onValueChange={(v) =>
                    setF((s) => ({ ...s, category: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Unit</Label>
                <Select
                  value={f.unit}
                  onValueChange={(v) => setF((s) => ({ ...s, unit: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_SUGGESTIONS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Std. unit cost</Label>
                <Input
                  type="number"
                  value={f.cost}
                  onChange={(e) =>
                    setF((s) => ({ ...s, cost: e.target.value }))
                  }
                  placeholder="optional"
                />
              </div>
              <div className="space-y-1">
                <Label>Reorder point</Label>
                <Input
                  type="number"
                  value={f.reorderPoint}
                  onChange={(e) =>
                    setF((s) => ({ ...s, reorderPoint: e.target.value }))
                  }
                  placeholder="optional"
                />
              </div>
              <div className="space-y-1">
                <Label>Auto-deduct</Label>
                <Select
                  value={f.autoDeduct}
                  onValueChange={(v) =>
                    setF((s) => ({ ...s, autoDeduct: v as AutoDeduct }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTO_DEDUCT.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={f.trackLots}
                    onChange={(e) =>
                      setF((s) => ({ ...s, trackLots: e.target.checked }))
                    }
                  />
                  Lots
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={f.trackExpiry}
                    onChange={(e) =>
                      setF((s) => ({
                        ...s,
                        trackExpiry: e.target.checked,
                      }))
                    }
                  />
                  Expiry
                </label>
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Input
                  value={f.notes}
                  onChange={(e) =>
                    setF((s) => ({ ...s, notes: e.target.value }))
                  }
                  placeholder="optional"
                />
              </div>
              <div className="col-span-2 flex items-end gap-2 md:col-span-4">
                <Button disabled={pending} onClick={saveItem}>
                  {editing ? "Save changes" : "Add item"}
                </Button>
                {editing && (
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={resetForm}
                  >
                    Cancel
                  </Button>
                )}
                <span className="mx-2 text-muted-foreground">|</span>
                <Input
                  className="max-w-44"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  placeholder="New category…"
                />
                <Button
                  variant="outline"
                  disabled={pending || !newCat.trim()}
                  onClick={saveCategory}
                >
                  Add category
                </Button>
              </div>
            </CardContent>
          </Card>

          {items.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className={TH}>Item</th>
                    <th className={TH}>Category</th>
                    <th className={TH}>Unit</th>
                    <th className={NUM}>Std cost</th>
                    <th className={NUM}>Reorder</th>
                    <th className={TH}>Track</th>
                    <th className={TH}>Auto-deduct</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-t">
                      <td className={`${TD} font-medium`}>{i.name}</td>
                      <td className={TD}>{i.category}</td>
                      <td className={TD}>{i.unit}</td>
                      <td className={NUM}>{i.cost ?? "—"}</td>
                      <td className={NUM}>{i.reorderPoint ?? "—"}</td>
                      <td className={TD}>
                        {[
                          i.trackLots ? "lots" : null,
                          i.trackExpiry ? "expiry" : null,
                        ]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </td>
                      <td className={TD}>{i.autoDeduct}</td>
                      <td className={`${TD} text-right`}>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => editItem(i)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => removeItem(i)}
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
        </div>
      )}

      {tab === "stock" && (
        <div className="space-y-3">
          <div className="flex gap-6 text-xs text-muted-foreground">
            <span>
              Total stock value:{" "}
              <span className="font-medium text-foreground">
                {Math.round(totalValue * 100) / 100}
              </span>
            </span>
            <span>
              Low / reorder:{" "}
              <span
                className={
                  lowCount
                    ? "font-medium text-destructive"
                    : "font-medium text-foreground"
                }
              >
                {lowCount}
              </span>
            </span>
          </div>
          {stock.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className={TH}>Item</th>
                    <th className={TH}>Category</th>
                    <th className={NUM}>On hand</th>
                    <th className={TH}>Unit</th>
                    <th className={NUM}>Avg cost</th>
                    <th className={NUM}>Value</th>
                    <th className={NUM}>Reorder</th>
                    <th className={TH}>Last receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((s) => (
                    <tr
                      key={s.id}
                      className={`border-t ${s.low ? "bg-destructive/5" : ""}`}
                    >
                      <td className={`${TD} font-medium`}>{s.name}</td>
                      <td className={TD}>{s.category}</td>
                      <td
                        className={`${NUM} ${s.low ? "text-destructive font-medium" : ""}`}
                      >
                        {s.onHand}
                      </td>
                      <td className={TD}>{s.unit}</td>
                      <td className={NUM}>{s.avgCost ?? "—"}</td>
                      <td className={NUM}>{s.value ?? "—"}</td>
                      <td className={NUM}>{s.reorderPoint ?? "—"}</td>
                      <td className={TD}>{s.lastReceipt ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No items yet — add some in Catalogue, then record receipts
              under Movements.
            </p>
          )}
        </div>
      )}

      {tab === "movements" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="grid grid-cols-2 gap-3 pt-4 md:grid-cols-4">
              <div className="space-y-1">
                <Label>Item</Label>
                <Select
                  value={m.itemId}
                  onValueChange={(v) =>
                    setM((s) => ({ ...s, itemId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={m.kind}
                  onValueChange={(v) =>
                    setM((s) => ({ ...s, kind: v as MoveKind }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receive">
                      Receipt (+)
                    </SelectItem>
                    <SelectItem value="adjust">Adjust (±)</SelectItem>
                    <SelectItem value="usage">Usage (−)</SelectItem>
                    <SelectItem value="price">Price only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={m.date}
                  onChange={(e) =>
                    setM((s) => ({ ...s, date: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>
                  {m.kind === "adjust"
                    ? "Qty (±)"
                    : m.kind === "price"
                      ? "Qty (n/a)"
                      : "Qty"}
                </Label>
                <Input
                  type="number"
                  value={m.qty}
                  disabled={m.kind === "price"}
                  onChange={(e) =>
                    setM((s) => ({ ...s, qty: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Unit cost</Label>
                <Input
                  type="number"
                  value={m.unitCost}
                  onChange={(e) =>
                    setM((s) => ({ ...s, unitCost: e.target.value }))
                  }
                  placeholder={m.kind === "price" ? "required" : "optional"}
                />
              </div>
              <div className="space-y-1">
                <Label>Supplier / party</Label>
                <Input
                  value={m.party}
                  onChange={(e) =>
                    setM((s) => ({ ...s, party: e.target.value }))
                  }
                  placeholder="optional"
                />
              </div>
              <div className="space-y-1">
                <Label>Lot / batch</Label>
                <Input
                  value={m.lot}
                  onChange={(e) =>
                    setM((s) => ({ ...s, lot: e.target.value }))
                  }
                  placeholder="optional"
                />
              </div>
              <div className="space-y-1">
                <Label>Expiry</Label>
                <Input
                  type="date"
                  value={m.expiry}
                  onChange={(e) =>
                    setM((s) => ({ ...s, expiry: e.target.value }))
                  }
                />
              </div>
              <div className="col-span-2 space-y-1 md:col-span-3">
                <Label>Remark</Label>
                <Input
                  value={m.remark}
                  onChange={(e) =>
                    setM((s) => ({ ...s, remark: e.target.value }))
                  }
                  placeholder="optional"
                />
              </div>
              <div className="flex items-end">
                <Button
                  disabled={pending || !items.length}
                  onClick={saveMove}
                >
                  Record
                </Button>
              </div>
            </CardContent>
          </Card>

          {moves.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className={TH}>Date</th>
                    <th className={TH}>Item</th>
                    <th className={TH}>Type</th>
                    <th className={NUM}>Qty</th>
                    <th className={NUM}>Unit cost</th>
                    <th className={TH}>Party</th>
                    <th className={TH}>Lot</th>
                    <th className={TH}>Expiry</th>
                    <th className={TH}>Remark</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody>
                  {moves.map((mv) => (
                    <tr key={mv.id} className="border-t">
                      <td className={TD}>{mv.date}</td>
                      <td className={`${TD} font-medium`}>
                        {mv.itemName}
                      </td>
                      <td className={TD}>{mv.kind}</td>
                      <td className={NUM}>{mv.qty}</td>
                      <td className={NUM}>{mv.unitCost ?? "—"}</td>
                      <td className={TD}>{mv.party ?? "—"}</td>
                      <td className={TD}>{mv.lot ?? "—"}</td>
                      <td className={TD}>{mv.expiry ?? "—"}</td>
                      <td className={TD}>{mv.remark ?? "—"}</td>
                      <td className={`${TD} text-right`}>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => removeMove(mv)}
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
        </div>
      )}
    </div>
  );
}
