"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  Delete02Icon,
  ChartLineData02Icon,
  SpermIcon,
  Calendar03Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  createHeat,
  createBreeding,
  createPregCheck,
  createCalving,
  upsertSemenStraw,
  deleteSemenStraw,
  type SemenStrawInput,
} from "./actions";

// =============================================================================
// Types
// =============================================================================
export type AnimalOpt = {
  id: string;
  animal_id: string;
  name: string | null;
  life_stage: string | null;
  current_lactation: number | null;
  last_calving_date: string | null;
};

export type EventRow = {
  id: string;
  event_date: string;
  animal_label: string;
  sire_naab: string | null;
  service_number: number | null;
  technician: string | null;
  result: string | null;
  preg_check_method: string | null;
  days_pregnant: number | null;
  notes: string | null;
};

export type CalvingRow = {
  id: string;
  calving_date: string;
  dam_label: string;
  parity: number;
  calving_ease: number | null;
  twin_flag: boolean;
  stillborn: boolean;
  calf_sex: string | null;
  calf_birth_weight_kg: number | null;
  notes: string | null;
};

export type SemenStrawRow = {
  id: string;
  naab: string;
  sire_name: string | null;
  breed_code: string | null;
  lot: string | null;
  tank_position: string | null;
  on_hand_doses: number;
  unit_cost_current: number | null;
};

export type ActionListRow = {
  animal_id: string;
  animal_label: string;
  dim: number | null;
  last_event_date: string | null;
  last_event_type: string | null;
  days_until_calving: number | null;
};

export type ReproDayLists = {
  fresh: ActionListRow[];           // ≤ 30 DIM
  readyToBreed: ActionListRow[];    // lactating, DIM ≥ VWP, no breeding in 21d
  duePregCheck: ActionListRow[];    // bred ≥ preg_check_initial_days, no PC since
  dueCalving: ActionListRow[];      // ≤ 14d to expected calving
};

export type VendorOpt = { id: string; name: string };

// =============================================================================
// Hub shell
// =============================================================================
const TABS = [
  { key: "today", label: "Today" },
  { key: "heats", label: "Heats" },
  { key: "breedings", label: "Breedings" },
  { key: "preg-checks", label: "Preg checks" },
  { key: "calvings", label: "Calvings" },
  { key: "semen", label: "Semen inventory" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function ReproductionHub({
  locationId,
  vwpDays,
  pregCheckInitialDays,
  gestationDays,
  animals,
  heats,
  breedings,
  pregChecks,
  calvings,
  straws,
  lists,
  vendors,
}: {
  locationId: string;
  vwpDays: number;
  pregCheckInitialDays: number;
  gestationDays: number;
  animals: AnimalOpt[];
  heats: EventRow[];
  breedings: EventRow[];
  pregChecks: EventRow[];
  calvings: CalvingRow[];
  straws: SemenStrawRow[];
  lists: ReproDayLists;
  vendors: VendorOpt[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const active = (params.get("tab") as TabKey) ?? "today";

  const [openDlg, setOpenDlg] = useState<null | TabKey | "semen-new">(null);

  const setTab = (k: TabKey) => {
    const q = new URLSearchParams(params.toString());
    q.set("tab", k);
    router.push(`/reproduction?${q.toString()}`);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <QuickLog
          icon={ChartLineData02Icon}
          label="Log heat"
          onClick={() => setOpenDlg("heats")}
        />
        <QuickLog
          icon={SpermIcon}
          label="Log breeding"
          onClick={() => setOpenDlg("breedings")}
        />
        <QuickLog
          icon={AlertCircleIcon}
          label="Log preg check"
          onClick={() => setOpenDlg("preg-checks")}
        />
        <QuickLog
          icon={Calendar03Icon}
          label="Log calving"
          onClick={() => setOpenDlg("calvings")}
        />
      </div>

      <nav className="ring-1 ring-foreground/10 flex overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs whitespace-nowrap border-b-2 -mb-px transition-colors ${
              active === t.key
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {active === "today" ? (
        <TodayTab
          vwpDays={vwpDays}
          pregCheckInitialDays={pregCheckInitialDays}
          gestationDays={gestationDays}
          lists={lists}
          onLog={(k) => setOpenDlg(k)}
        />
      ) : null}

      {active === "heats" ? (
        <EventList
          empty="No heats logged yet."
          rows={heats}
          showSire={false}
          showResult={false}
        />
      ) : null}
      {active === "breedings" ? (
        <EventList
          empty="No breedings logged yet."
          rows={breedings}
          showSire
          showResult={false}
        />
      ) : null}
      {active === "preg-checks" ? (
        <EventList
          empty="No preg checks logged yet."
          rows={pregChecks}
          showSire={false}
          showResult
        />
      ) : null}
      {active === "calvings" ? <CalvingList rows={calvings} /> : null}
      {active === "semen" ? (
        <SemenInventoryTab
          straws={straws}
          locationId={locationId}
          vendors={vendors}
          onNew={() => setOpenDlg("semen-new")}
        />
      ) : null}

      <HeatDialog
        open={openDlg === "heats"}
        onOpenChange={(v) => !v && setOpenDlg(null)}
        animals={animals}
      />
      <BreedingDialog
        open={openDlg === "breedings"}
        onOpenChange={(v) => !v && setOpenDlg(null)}
        animals={animals}
        straws={straws}
      />
      <PregCheckDialog
        open={openDlg === "preg-checks"}
        onOpenChange={(v) => !v && setOpenDlg(null)}
        animals={animals}
      />
      <CalvingDialog
        open={openDlg === "calvings"}
        onOpenChange={(v) => !v && setOpenDlg(null)}
        animals={animals}
      />
      <SemenStrawDialog
        open={openDlg === "semen-new"}
        onOpenChange={(v) => !v && setOpenDlg(null)}
        locationId={locationId}
        vendors={vendors}
      />
    </>
  );
}

function QuickLog({
  icon,
  label,
  onClick,
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
  label: string;
  onClick: () => void;
}) {
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick}>
      <HugeiconsIcon icon={icon} />
      {label}
    </Button>
  );
}

// =============================================================================
// Today tab — action lists
// =============================================================================
function TodayTab({
  vwpDays,
  pregCheckInitialDays,
  gestationDays,
  lists,
  onLog,
}: {
  vwpDays: number;
  pregCheckInitialDays: number;
  gestationDays: number;
  lists: ReproDayLists;
  onLog: (k: TabKey) => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <ActionListCard
        title="Ready to breed"
        hint={`Lactating cows past the ${vwpDays}-day VWP with no breeding in the last 21 days.`}
        rows={lists.readyToBreed}
        emptyLabel="No cows ready today."
        cta="Log breeding"
        ctaTab="breedings"
        onCta={() => onLog("breedings")}
      />
      <ActionListCard
        title="Due preg check"
        hint={`Cows bred ≥ ${pregCheckInitialDays} days ago without a preg check on file.`}
        rows={lists.duePregCheck}
        emptyLabel="Nothing due."
        cta="Log preg check"
        ctaTab="preg-checks"
        onCta={() => onLog("preg-checks")}
      />
      <ActionListCard
        title="Due to calve (≤14d)"
        hint={`Pregnant cows within 14 days of expected calving (${gestationDays}-day gestation).`}
        rows={lists.dueCalving}
        emptyLabel="No close-ups today."
        cta="Log calving"
        ctaTab="calvings"
        onCta={() => onLog("calvings")}
      />
      <ActionListCard
        title="Fresh (≤30d)"
        hint="Cows that calved in the last 30 days. Watch metabolic + intake."
        rows={lists.fresh}
        emptyLabel="No fresh cows."
        cta="Log heat"
        ctaTab="heats"
        onCta={() => onLog("heats")}
      />
    </div>
  );
}

function ActionListCard({
  title,
  hint,
  rows,
  emptyLabel,
  cta,
  onCta,
}: {
  title: string;
  hint: string;
  rows: ActionListRow[];
  emptyLabel: string;
  cta: string;
  ctaTab: TabKey;
  onCta: () => void;
}) {
  return (
    <section className="ring-1 ring-foreground/10 flex flex-col">
      <header className="px-3 py-2 bg-foreground/5 flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-medium">
            {title}
            <span className="ml-2 text-[10px] font-normal text-muted-foreground">
              {rows.length} animal{rows.length === 1 ? "" : "s"}
            </span>
          </h3>
          <p className="text-[10px] text-muted-foreground">{hint}</p>
        </div>
      </header>
      {rows.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-foreground/[0.025]">
              <tr className="text-left">
                <th className="px-3 py-1.5 font-medium">Cow</th>
                <th className="px-3 py-1.5 font-medium text-right">DIM</th>
                <th className="px-3 py-1.5 font-medium">Last event</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 12).map((r) => (
                <tr key={r.animal_id} className="border-t border-foreground/10">
                  <td className="px-3 py-1.5 font-medium">{r.animal_label}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {r.dim ?? "—"}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {r.last_event_type ?? "—"}
                    {r.last_event_date ? ` · ${r.last_event_date}` : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Button type="button" size="sm" variant="ghost" onClick={onCta}>
                      {cta}
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length > 12 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-1.5 text-center text-muted-foreground text-[10px]">
                    + {rows.length - 12} more
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// =============================================================================
// Event list
// =============================================================================
function EventList({
  rows,
  empty,
  showSire,
  showResult,
}: {
  rows: EventRow[];
  empty: string;
  showSire: boolean;
  showResult: boolean;
}) {
  return (
    <div className="ring-1 ring-foreground/10 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-foreground/5">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Cow</th>
            {showSire ? <th className="px-3 py-2 font-medium">Sire NAAB</th> : null}
            {showSire ? <th className="px-3 py-2 font-medium text-right">#</th> : null}
            {showSire ? <th className="px-3 py-2 font-medium">Tech</th> : null}
            {showResult ? <th className="px-3 py-2 font-medium">Result</th> : null}
            {showResult ? <th className="px-3 py-2 font-medium">Method</th> : null}
            {showResult ? <th className="px-3 py-2 font-medium text-right">DP</th> : null}
            <th className="px-3 py-2 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-3 py-4 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-t border-foreground/10">
                <td className="px-3 py-2">{r.event_date}</td>
                <td className="px-3 py-2 font-medium">{r.animal_label}</td>
                {showSire ? (
                  <td className="px-3 py-2 font-mono text-[11px]">{r.sire_naab ?? "—"}</td>
                ) : null}
                {showSire ? (
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.service_number ?? "—"}
                  </td>
                ) : null}
                {showSire ? (
                  <td className="px-3 py-2 text-muted-foreground">{r.technician ?? "—"}</td>
                ) : null}
                {showResult ? (
                  <td className="px-3 py-2 font-medium">{r.result ?? "—"}</td>
                ) : null}
                {showResult ? (
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.preg_check_method ?? "—"}
                  </td>
                ) : null}
                {showResult ? (
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.days_pregnant ?? "—"}
                  </td>
                ) : null}
                <td className="px-3 py-2 text-muted-foreground">{r.notes ?? ""}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function CalvingList({ rows }: { rows: CalvingRow[] }) {
  return (
    <div className="ring-1 ring-foreground/10 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-foreground/5">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Dam</th>
            <th className="px-3 py-2 font-medium text-right">Parity</th>
            <th className="px-3 py-2 font-medium text-right">Ease</th>
            <th className="px-3 py-2 font-medium">Calf sex</th>
            <th className="px-3 py-2 font-medium text-right">Birth wt</th>
            <th className="px-3 py-2 font-medium">Flags</th>
            <th className="px-3 py-2 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">
                No calvings logged yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-t border-foreground/10">
                <td className="px-3 py-2">{r.calving_date}</td>
                <td className="px-3 py-2 font-medium">{r.dam_label}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.parity}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.calving_ease ?? "—"}</td>
                <td className="px-3 py-2">{r.calf_sex ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.calf_birth_weight_kg ?? "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {[
                    r.twin_flag ? "twin" : null,
                    r.stillborn ? "stillborn" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.notes ?? ""}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Semen inventory tab
// =============================================================================
function SemenInventoryTab({
  straws,
  onNew,
}: {
  straws: SemenStrawRow[];
  locationId: string;
  vendors: VendorOpt[];
  onNew: () => void;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const onDelete = (id: string, naab: string) => {
    if (!confirm(`Delete ${naab}? Its stock line is also removed.`)) return;
    setBusyId(id);
    startTransition(async () => {
      const r = await deleteSemenStraw(id);
      setBusyId(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Semen straw deleted.");
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {straws.length} sire{straws.length === 1 ? "" : "s"} on file. Doses
          deduct one per breeding when linked.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={onNew}>
          <HugeiconsIcon icon={PlusSignIcon} />
          Add sire / lot
        </Button>
      </div>
      <div className="ring-1 ring-foreground/10 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-foreground/5">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">NAAB</th>
              <th className="px-3 py-2 font-medium">Sire</th>
              <th className="px-3 py-2 font-medium">Breed</th>
              <th className="px-3 py-2 font-medium">Lot</th>
              <th className="px-3 py-2 font-medium">Tank position</th>
              <th className="px-3 py-2 font-medium text-right">Doses on hand</th>
              <th className="px-3 py-2 font-medium text-right">Unit cost</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {straws.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">
                  No semen straws yet.
                </td>
              </tr>
            ) : (
              straws.map((s) => (
                <tr key={s.id} className="border-t border-foreground/10">
                  <td className="px-3 py-2 font-mono">{s.naab}</td>
                  <td className="px-3 py-2 font-medium">{s.sire_name ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.breed_code ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.lot ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.tank_position ?? "—"}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${s.on_hand_doses <= 0 ? "text-destructive font-medium" : ""}`}>
                    {s.on_hand_doses}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {s.unit_cost_current === null ? "—" : s.unit_cost_current.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(s.id, s.naab)}
                      disabled={busyId === s.id}
                    >
                      <HugeiconsIcon icon={Delete02Icon} />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// =============================================================================
// Dialogs
// =============================================================================
function todayIso(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function AnimalSelect({
  animals,
  field,
  filter,
}: {
  animals: AnimalOpt[];
  field: { value: string; onChange: (v: string) => void };
  filter?: (a: AnimalOpt) => boolean;
}) {
  const filtered = filter ? animals.filter(filter) : animals;
  return (
    <Select onValueChange={field.onChange} value={field.value}>
      <FormControl>
        <SelectTrigger>
          <SelectValue placeholder="Pick a cow" />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {filtered.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.animal_id}
            {a.name ? ` · ${a.name}` : ""}
            {a.life_stage ? ` · ${a.life_stage}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---- Heat ------------------------------------------------------------------
const heatFormSchema = z.object({
  animal_id: z.string().uuid("Pick a cow."),
  event_date: z.string().min(1),
  notes: z.string().optional(),
});
function HeatDialog({
  open,
  onOpenChange,
  animals,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  animals: AnimalOpt[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<z.infer<typeof heatFormSchema>>({
    resolver: zodResolver(heatFormSchema),
    defaultValues: { animal_id: "", event_date: todayIso(), notes: "" },
  });
  const onSubmit = (v: z.infer<typeof heatFormSchema>) =>
    startTransition(async () => {
      const r = await createHeat({ ...v, notes: v.notes || null });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Heat logged.");
      onOpenChange(false);
      form.reset({ animal_id: "", event_date: todayIso(), notes: "" });
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log heat</DialogTitle>
          <DialogDescription>
            Standing heat observed. Drives breeding decisions and timing.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormField
              control={form.control}
              name="animal_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cow</FormLabel>
                  <AnimalSelect animals={animals} field={field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="event_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Log heat"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Breeding --------------------------------------------------------------
const NONE = "__none__";
const breedingFormSchema = z.object({
  animal_id: z.string().uuid("Pick a cow."),
  event_date: z.string().min(1),
  semen_straw_id: z.string(),
  sire_naab: z.string().optional(),
  service_number: z.number().int().nullable().optional(),
  technician: z.string().optional(),
  sync_protocol: z.string().optional(),
  notes: z.string().optional(),
});
function BreedingDialog({
  open,
  onOpenChange,
  animals,
  straws,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  animals: AnimalOpt[];
  straws: SemenStrawRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<z.infer<typeof breedingFormSchema>>({
    resolver: zodResolver(breedingFormSchema),
    defaultValues: {
      animal_id: "",
      event_date: todayIso(),
      semen_straw_id: NONE,
      sire_naab: "",
      service_number: null,
      technician: "",
      sync_protocol: "",
      notes: "",
    },
  });

  const onSubmit = (v: z.infer<typeof breedingFormSchema>) =>
    startTransition(async () => {
      const straw = v.semen_straw_id === NONE ? null : straws.find((s) => s.id === v.semen_straw_id);
      const r = await createBreeding({
        animal_id: v.animal_id,
        event_date: v.event_date,
        semen_straw_id: straw?.id ?? null,
        sire_naab: (straw?.naab ?? v.sire_naab) || null,
        service_number: v.service_number ?? null,
        technician: v.technician || null,
        sync_protocol: v.sync_protocol || null,
        notes: v.notes || null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Breeding logged. Dose deducted if straw was linked.");
      onOpenChange(false);
      form.reset({
        animal_id: "",
        event_date: todayIso(),
        semen_straw_id: NONE,
        sire_naab: "",
        service_number: null,
        technician: "",
        sync_protocol: "",
        notes: "",
      });
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log breeding</DialogTitle>
          <DialogDescription>
            AI or natural service. Linking a semen straw deducts one dose from
            inventory.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="animal_id"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Cow</FormLabel>
                    <AnimalSelect animals={animals} field={field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="event_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="service_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service #</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="semen_straw_id"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Semen straw (deducts 1 dose)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>— no straw / natural —</SelectItem>
                        {straws.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.naab}
                            {s.sire_name ? ` · ${s.sire_name}` : ""}
                            {` · ${s.on_hand_doses} on hand`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sire_naab"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sire NAAB (override)</FormLabel>
                    <FormControl>
                      <Input placeholder="014HO07419" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="technician"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Technician</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sync_protocol"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Sync protocol</FormLabel>
                    <FormControl>
                      <Input placeholder="OvSynch / Double-Ovsynch / …" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Log breeding"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Preg check ------------------------------------------------------------
const pcFormSchema = z.object({
  animal_id: z.string().uuid("Pick a cow."),
  event_date: z.string().min(1),
  result: z.enum(["pregnant", "open", "recheck"]),
  preg_check_method: z.string().optional(),
  days_pregnant: z.number().int().nullable().optional(),
  notes: z.string().optional(),
});
function PregCheckDialog({
  open,
  onOpenChange,
  animals,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  animals: AnimalOpt[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<z.infer<typeof pcFormSchema>>({
    resolver: zodResolver(pcFormSchema),
    defaultValues: {
      animal_id: "",
      event_date: todayIso(),
      result: "pregnant",
      preg_check_method: "palpation",
      days_pregnant: null,
      notes: "",
    },
  });

  const onSubmit = (v: z.infer<typeof pcFormSchema>) =>
    startTransition(async () => {
      const r = await createPregCheck({
        animal_id: v.animal_id,
        event_date: v.event_date,
        result: v.result,
        preg_check_method: v.preg_check_method || null,
        days_pregnant: v.days_pregnant ?? null,
        notes: v.notes || null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Preg check logged.");
      onOpenChange(false);
      form.reset({
        animal_id: "",
        event_date: todayIso(),
        result: "pregnant",
        preg_check_method: "palpation",
        days_pregnant: null,
        notes: "",
      });
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log preg check</DialogTitle>
          <DialogDescription>
            Pregnant / open / recheck. Days-pregnant is required for confirmed
            pregnancies.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormField
              control={form.control}
              name="animal_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cow</FormLabel>
                  <AnimalSelect animals={animals} field={field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="event_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="result"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Result</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pregnant">Pregnant</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="recheck">Recheck</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="preg_check_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Method</FormLabel>
                    <FormControl>
                      <Input placeholder="palpation / ultrasound / blood test" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="days_pregnant"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Days pregnant</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Log preg check"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Calving ---------------------------------------------------------------
const calvingFormSchema = z.object({
  dam_animal_id: z.string().uuid("Pick a dam."),
  calving_date: z.string().min(1),
  parity: z.number().int().min(1).max(20),
  calving_ease: z.number().int().nullable().optional(),
  twin_flag: z.boolean().optional(),
  stillborn: z.boolean().optional(),
  calf_sex: z.enum(["male", "female"]).nullable().optional(),
  calf_birth_weight_kg: z.number().nullable().optional(),
  retained_placenta: z.boolean().optional(),
  notes: z.string().optional(),
});
function CalvingDialog({
  open,
  onOpenChange,
  animals,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  animals: AnimalOpt[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<z.infer<typeof calvingFormSchema>>({
    resolver: zodResolver(calvingFormSchema),
    defaultValues: {
      dam_animal_id: "",
      calving_date: todayIso(),
      parity: 1,
      calving_ease: 1,
      twin_flag: false,
      stillborn: false,
      calf_sex: null,
      calf_birth_weight_kg: null,
      retained_placenta: false,
      notes: "",
    },
  });

  const onSubmit = (v: z.infer<typeof calvingFormSchema>) =>
    startTransition(async () => {
      const r = await createCalving({
        dam_animal_id: v.dam_animal_id,
        calving_date: v.calving_date,
        parity: v.parity,
        calving_ease: v.calving_ease ?? null,
        twin_flag: v.twin_flag ?? false,
        stillborn: v.stillborn ?? false,
        calf_sex: v.calf_sex ?? null,
        calf_birth_weight_kg: v.calf_birth_weight_kg ?? null,
        retained_placenta: v.retained_placenta ?? false,
        notes: v.notes || null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Calving logged. Dam moved to fresh / lactating.");
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log calving</DialogTitle>
          <DialogDescription>
            Dam moves to fresh / lactating with this parity and date.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormField
              control={form.control}
              name="dam_animal_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dam</FormLabel>
                  <AnimalSelect
                    animals={animals}
                    field={field}
                    filter={(a) => a.life_stage === "lactating" || a.life_stage === "dry" || a.life_stage === "bred_heifer"}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="calving_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={field.value || 1}
                        onChange={(e) => field.onChange(Number(e.target.value || 1))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="calving_ease"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ease (1–5)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="calf_sex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calf sex</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                      value={field.value ?? NONE}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>— unknown —</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="calf_birth_weight_kg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birth weight (kg)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FlagsRow form={form} />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Log calving"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function FlagsRow({ form }: { form: ReturnType<typeof useForm<z.infer<typeof calvingFormSchema>>> }) {
  return (
    <div className="col-span-2 flex flex-wrap gap-4 text-xs">
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!form.watch("twin_flag")}
          onChange={(e) => form.setValue("twin_flag", e.target.checked)}
        />
        Twin
      </label>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!form.watch("stillborn")}
          onChange={(e) => form.setValue("stillborn", e.target.checked)}
        />
        Stillborn
      </label>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!form.watch("retained_placenta")}
          onChange={(e) => form.setValue("retained_placenta", e.target.checked)}
        />
        Retained placenta
      </label>
    </div>
  );
}

// ---- Semen straw -----------------------------------------------------------
const strawFormSchema = z.object({
  naab: z.string().min(1, "NAAB required."),
  sire_name: z.string().optional(),
  breed_code: z.string().optional(),
  lot: z.string().optional(),
  tank_position: z.string().optional(),
  vendor_id: z.string(),
  initial_doses: z.number().int().min(0).nullable().optional(),
  unit_cost: z.number().min(0).nullable().optional(),
});
function SemenStrawDialog({
  open,
  onOpenChange,
  locationId,
  vendors,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  locationId: string;
  vendors: VendorOpt[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<z.infer<typeof strawFormSchema>>({
    resolver: zodResolver(strawFormSchema),
    defaultValues: {
      naab: "",
      sire_name: "",
      breed_code: "HO",
      lot: "",
      tank_position: "",
      vendor_id: NONE,
      initial_doses: null,
      unit_cost: null,
    },
  });

  const onSubmit = (v: z.infer<typeof strawFormSchema>) =>
    startTransition(async () => {
      const payload: SemenStrawInput = {
        location_id: locationId,
        naab: v.naab,
        sire_name: v.sire_name || null,
        breed_code: v.breed_code || null,
        lot: v.lot || null,
        tank_position: v.tank_position || null,
        vendor_id: v.vendor_id === NONE ? null : v.vendor_id,
        initial_doses: v.initial_doses ?? null,
        unit_cost: v.unit_cost ?? null,
      };
      const r = await upsertSemenStraw(payload);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Sire added. Stock line provisioned.");
      onOpenChange(false);
      form.reset({
        naab: "",
        sire_name: "",
        breed_code: "HO",
        lot: "",
        tank_position: "",
        vendor_id: NONE,
        initial_doses: null,
        unit_cost: null,
      });
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add sire / lot</DialogTitle>
          <DialogDescription>
            Creates the semen straw row and a paired stock_items line (unit:
            dose). Opening doses + unit cost lay down a stock_movements row.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="naab"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NAAB</FormLabel>
                    <FormControl>
                      <Input placeholder="014HO07419" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sire_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sire name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="breed_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Breed code</FormLabel>
                    <FormControl>
                      <Input placeholder="HO / JE / BS" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lot"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lot</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tank_position"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Tank position</FormLabel>
                    <FormControl>
                      <Input placeholder="Tank-1 / Cane-3 / Goblet-A" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vendor_id"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Vendor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>— none —</SelectItem>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="initial_doses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening doses</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit cost / dose</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Add sire"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
