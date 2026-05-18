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
  type SupplyParty,
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
  createParty,
  updateParty,
  deleteParty,
} from "./actions";

type Tab = "catalogue" | "stock" | "parties" | "movements";

const TH = "px-2 py-1 text-left font-medium whitespace-nowrap";
const TD = "px-2 py-0.5 whitespace-nowrap";
const NUM = "px-2 py-0.5 text-right tabular-nums whitespace-nowrap";
const NONE = "__none__";

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
  parties,
}: {
  items: SupplyItem[];
  stock: StockRow[];
  moves: SupplyMove[];
  categories: string[];
  parties: SupplyParty[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<Tab>("catalogue");

  const suppliers = parties.filter((p) => p.isSupplier);
  const buyers = parties.filter((p) => p.isBuyer);

  // ---------- catalogue form ----------
  const blank = {
    id: "",
    name: "",
    genericName: "",
    brand: "",
    category: categories[0] ?? "",
    unit: "ea",
    cost: "",
    reorderPoint: "",
    defaultSupplier: "",
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
        genericName: f.genericName || undefined,
        brand: f.brand || undefined,
        category: f.category,
        unit: f.unit,
        cost: f.cost ? Number(f.cost) : 0,
        reorderPoint: f.reorderPoint ? Number(f.reorderPoint) : undefined,
        defaultSupplier: f.defaultSupplier || undefined,
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
      genericName: i.genericName ?? "",
      brand: i.brand ?? "",
      category: i.category,
      unit: i.unit,
      cost: i.cost?.toString() ?? "",
      reorderPoint: i.reorderPoint?.toString() ?? "",
      defaultSupplier: i.defaultSupplier ?? "",
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

  // ---------- party form ----------
  const pBlank = {
    id: "",
    name: "",
    isSupplier: true,
    isBuyer: false,
    phone: "",
    email: "",
    address: "",
    terms: "",
    notes: "",
  };
  const [pf, setPf] = useState(pBlank);
  const editingParty = pf.id !== "";
  const resetParty = () => setPf(pBlank);

  const saveParty = () =>
    start(async () => {
      const payload = {
        name: pf.name,
        isSupplier: pf.isSupplier,
        isBuyer: pf.isBuyer,
        phone: pf.phone || undefined,
        email: pf.email || undefined,
        address: pf.address || undefined,
        terms: pf.terms || undefined,
        notes: pf.notes || undefined,
      };
      const res = editingParty
        ? await updateParty({ ...payload, id: pf.id })
        : await createParty(payload);
      if (res.error) return void toast.error(res.error);
      toast.success(editingParty ? "Party updated." : `“${pf.name}” added.`);
      resetParty();
      router.refresh();
    });

  const editParty = (p: SupplyParty) => {
    setTab("parties");
    setPf({
      id: p.id,
      name: p.name,
      isSupplier: p.isSupplier,
      isBuyer: p.isBuyer,
      phone: p.phone ?? "",
      email: p.email ?? "",
      address: p.address ?? "",
      terms: p.terms ?? "",
      notes: p.notes ?? "",
    });
  };

  const removeParty = (p: SupplyParty) =>
    start(async () => {
      const res = await deleteParty(p.id);
      if (res.error) return void toast.error(res.error);
      toast.success(`Deleted “${p.name}”.`);
      if (pf.id === p.id) resetParty();
      router.refresh();
    });

  // ---------- movement form ----------
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

  // which parties are pickable for the chosen movement kind
  const moveParties =
    m.kind === "receive"
      ? suppliers
      : m.kind === "sale"
        ? buyers
        : parties;
  const partyRequired = m.kind === "receive" || m.kind === "sale";
  const costRequired = m.kind === "price" || m.kind === "sale";

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
          id="parties"
          label={`Parties (${parties.length})`}
          tab={tab}
          setTab={setTab}
        />
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
                  placeholder="e.g. Oxytetracycline 100 inj."
                />
              </div>
              <div className="space-y-1">
                <Label>Generic name</Label>
                <Input
                  value={f.genericName}
                  onChange={(e) =>
                    setF((s) => ({ ...s, genericName: e.target.value }))
                  }
                  placeholder="e.g. Oxytetracycline"
                />
              </div>
              <div className="space-y-1">
                <Label>Brand</Label>
                <Input
                  value={f.brand}
                  onChange={(e) =>
                    setF((s) => ({ ...s, brand: e.target.value }))
                  }
                  placeholder="e.g. Terramycin"
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
                <Label>Unit price *</Label>
                <Input
                  type="number"
                  value={f.cost}
                  onChange={(e) =>
                    setF((s) => ({ ...s, cost: e.target.value }))
                  }
                  placeholder="required"
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
                <Label>Default supplier</Label>
                <Select
                  value={f.defaultSupplier || NONE}
                  onValueChange={(v) =>
                    setF((s) => ({
                      ...s,
                      defaultSupplier: v === NONE ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <div className="space-y-1 md:col-span-2">
                <Label>Notes</Label>
                <Input
                  value={f.notes}
                  onChange={(e) =>
                    setF((s) => ({ ...s, notes: e.target.value }))
                  }
                  placeholder="optional"
                />
              </div>
              <div className="col-span-2 flex flex-wrap items-end gap-2 md:col-span-4">
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
                    <th className={TH}>Generic</th>
                    <th className={TH}>Brand</th>
                    <th className={TH}>Category</th>
                    <th className={TH}>Unit</th>
                    <th className={NUM}>Price</th>
                    <th className={NUM}>Reorder</th>
                    <th className={TH}>Supplier</th>
                    <th className={TH}>Auto-deduct</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-t">
                      <td className={`${TD} font-medium`}>{i.name}</td>
                      <td className={TD}>{i.genericName ?? "—"}</td>
                      <td className={TD}>{i.brand ?? "—"}</td>
                      <td className={TD}>{i.category}</td>
                      <td className={TD}>{i.unit}</td>
                      <td className={NUM}>{i.cost}</td>
                      <td className={NUM}>{i.reorderPoint ?? "—"}</td>
                      <td className={TD}>{i.defaultSupplier ?? "—"}</td>
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

      {tab === "parties" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="grid grid-cols-2 gap-3 pt-4 md:grid-cols-4">
              <div className="space-y-1">
                <Label>Party name</Label>
                <Input
                  value={pf.name}
                  onChange={(e) =>
                    setPf((s) => ({ ...s, name: e.target.value }))
                  }
                  placeholder="e.g. ABC Feeds Ltd."
                />
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={pf.isSupplier}
                    onChange={(e) =>
                      setPf((s) => ({
                        ...s,
                        isSupplier: e.target.checked,
                      }))
                    }
                  />
                  Supplier
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={pf.isBuyer}
                    onChange={(e) =>
                      setPf((s) => ({ ...s, isBuyer: e.target.checked }))
                    }
                  />
                  Buyer
                </label>
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input
                  value={pf.phone}
                  onChange={(e) =>
                    setPf((s) => ({ ...s, phone: e.target.value }))
                  }
                  placeholder="optional"
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  value={pf.email}
                  onChange={(e) =>
                    setPf((s) => ({ ...s, email: e.target.value }))
                  }
                  placeholder="optional"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Address</Label>
                <Input
                  value={pf.address}
                  onChange={(e) =>
                    setPf((s) => ({ ...s, address: e.target.value }))
                  }
                  placeholder="optional"
                />
              </div>
              <div className="space-y-1">
                <Label>Payment terms</Label>
                <Input
                  value={pf.terms}
                  onChange={(e) =>
                    setPf((s) => ({ ...s, terms: e.target.value }))
                  }
                  placeholder="e.g. Net 30"
                />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Input
                  value={pf.notes}
                  onChange={(e) =>
                    setPf((s) => ({ ...s, notes: e.target.value }))
                  }
                  placeholder="optional"
                />
              </div>
              <div className="col-span-2 flex items-end gap-2 md:col-span-4">
                <Button disabled={pending} onClick={saveParty}>
                  {editingParty ? "Save changes" : "Add party"}
                </Button>
                {editingParty && (
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={resetParty}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {parties.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className={TH}>Party</th>
                    <th className={TH}>Roles</th>
                    <th className={TH}>Phone</th>
                    <th className={TH}>Email</th>
                    <th className={TH}>Terms</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody>
                  {parties.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className={`${TD} font-medium`}>{p.name}</td>
                      <td className={TD}>
                        {[
                          p.isSupplier ? "supplier" : null,
                          p.isBuyer ? "buyer" : null,
                        ]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </td>
                      <td className={TD}>{p.phone ?? "—"}</td>
                      <td className={TD}>{p.email ?? "—"}</td>
                      <td className={TD}>{p.terms ?? "—"}</td>
                      <td className={`${TD} text-right`}>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => editParty(p)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => removeParty(p)}
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
                    setM((s) => ({ ...s, kind: v as MoveKind, party: "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receive">
                      Purchase / receipt (+)
                    </SelectItem>
                    <SelectItem value="sale">Sale (−)</SelectItem>
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
                <Label>
                  {m.kind === "sale"
                    ? "Sale price *"
                    : m.kind === "price"
                      ? "Unit cost *"
                      : "Unit cost"}
                </Label>
                <Input
                  type="number"
                  value={m.unitCost}
                  onChange={(e) =>
                    setM((s) => ({ ...s, unitCost: e.target.value }))
                  }
                  placeholder={costRequired ? "required" : "optional"}
                />
              </div>
              <div className="space-y-1">
                <Label>
                  {m.kind === "sale"
                    ? "Buyer *"
                    : m.kind === "receive"
                      ? "Supplier *"
                      : "Party"}
                </Label>
                <Select
                  value={m.party || NONE}
                  onValueChange={(v) =>
                    setM((s) => ({ ...s, party: v === NONE ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {!partyRequired && (
                      <SelectItem value={NONE}>—</SelectItem>
                    )}
                    {moveParties.length === 0 && (
                      <SelectItem value={NONE} disabled>
                        none registered — add in Parties
                      </SelectItem>
                    )}
                    {moveParties.map((p) => (
                      <SelectItem key={p.id} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <div className="space-y-1 md:col-span-3">
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
