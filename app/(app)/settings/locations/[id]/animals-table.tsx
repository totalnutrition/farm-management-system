"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  PencilEdit02Icon,
  Delete02Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  Search01Icon,
  DownloadCircle01Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Switch } from "@/components/ui/switch";
import {
  createAnimal,
  deleteAnimal,
  updateAnimal,
  type AnimalRow,
} from "./animals-actions";

type PenLite = { id: string; name: string };
type GroupLite = { id: string; label: string };
type BreedLite = { code: string; name: string };

const sexOptions = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "freemartin", label: "Freemartin" },
  { value: "castrated", label: "Castrated" },
] as const;

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "sold", label: "Sold" },
  { value: "dead", label: "Dead" },
  { value: "culled", label: "Culled" },
  { value: "reference", label: "Reference only" },
] as const;

const lifeStageOptions = [
  { value: "calf", label: "Calf (pre-weaning)" },
  { value: "weaned_heifer", label: "Weaned heifer" },
  { value: "breeding_heifer", label: "Breeding heifer (open)" },
  { value: "bred_heifer", label: "Bred heifer (pregnant)" },
  { value: "lactating", label: "Lactating cow" },
  { value: "dry", label: "Dry cow" },
  { value: "bull", label: "Bull" },
  { value: "other", label: "Other" },
] as const;

const originOptions = [
  { value: "born_on_farm", label: "Born on farm" },
  { value: "purchased", label: "Purchased" },
  { value: "imported", label: "Imported" },
  { value: "leased", label: "Leased" },
  { value: "other", label: "Other" },
] as const;

const formSchema = z.object({
  animal_id: z.string().trim().min(1, "Animal ID required."),
  name: z.string(),
  official_id: z.string(),
  registration_number: z.string(),
  breed_code: z.string(),
  sex: z.enum(sexOptions.map((s) => s.value) as [string, ...string[]]),
  birth_date: z.string().min(10),
  entry_date: z.string().min(10),
  origin: z.enum(originOptions.map((o) => o.value) as [string, ...string[]]),
  source_farm: z.string(),
  status: z.enum(statusOptions.map((s) => s.value) as [string, ...string[]]),
  status_date: z.string(),
  current_pen_id: z.string(),
  current_group_id: z.string(),
  current_lactation: z.union([z.number(), z.literal("")]),
  last_calving_date: z.string(),
  sire_naab: z.string(),
  sire_name: z.string(),
  dam_tag_external: z.string(),
  notes: z.string(),
  life_stage: z.enum(
    lifeStageOptions.map((s) => s.value) as [string, ...string[]],
  ),
  is_pregnant: z.boolean(),
  last_breeding_date: z.string(),
  last_breeding_sire_naab: z.string(),
  preg_check_date: z.string(),
  days_pregnant: z.union([z.number(), z.literal("")]),
});
type FormValues = z.infer<typeof formSchema>;

const today = () => new Date().toISOString().slice(0, 10);

const empty: FormValues = {
  animal_id: "",
  name: "",
  official_id: "",
  registration_number: "",
  breed_code: "",
  sex: "female",
  birth_date: today(),
  entry_date: today(),
  origin: "born_on_farm",
  source_farm: "",
  status: "active",
  status_date: "",
  current_pen_id: "",
  current_group_id: "",
  current_lactation: "" as unknown as number,
  last_calving_date: "",
  sire_naab: "",
  sire_name: "",
  dam_tag_external: "",
  notes: "",
  life_stage: "breeding_heifer",
  is_pregnant: false,
  last_breeding_date: "",
  last_breeding_sire_naab: "",
  preg_check_date: "",
  days_pregnant: "" as unknown as number,
};

function toSubmit(locationId: string, values: FormValues) {
  return {
    location_id: locationId,
    animal_id: values.animal_id,
    name: values.name || null,
    official_id: values.official_id || null,
    registration_number: values.registration_number || null,
    breed_code: values.breed_code || null,
    sex: values.sex as "female" | "male" | "freemartin" | "castrated",
    birth_date: values.birth_date,
    entry_date: values.entry_date,
    origin: values.origin as
      | "born_on_farm"
      | "purchased"
      | "imported"
      | "leased"
      | "other",
    source_farm: values.source_farm || null,
    status: values.status as
      | "active"
      | "sold"
      | "dead"
      | "culled"
      | "reference",
    status_date: values.status_date || null,
    current_pen_id: values.current_pen_id || null,
    current_group_id: values.current_group_id || null,
    current_lactation:
      typeof values.current_lactation === "number"
        ? values.current_lactation
        : null,
    last_calving_date: values.last_calving_date || null,
    sire_naab: values.sire_naab || null,
    sire_name: values.sire_name || null,
    dam_tag_external: values.dam_tag_external || null,
    notes: values.notes || null,
    life_stage: values.life_stage as
      | "calf"
      | "weaned_heifer"
      | "breeding_heifer"
      | "bred_heifer"
      | "lactating"
      | "dry"
      | "bull"
      | "other",
    is_pregnant: values.is_pregnant,
    last_breeding_date: values.last_breeding_date || null,
    last_breeding_sire_naab: values.last_breeding_sire_naab || null,
    preg_check_date: values.preg_check_date || null,
    days_pregnant:
      typeof values.days_pregnant === "number" ? values.days_pregnant : null,
  };
}

export function AnimalsTable({
  locationId,
  rows,
  pens,
  groups,
  breeds,
  statusFilter,
  totalsByStatus,
}: {
  locationId: string;
  rows: AnimalRow[];
  pens: PenLite[];
  groups: GroupLite[];
  breeds: BreedLite[];
  statusFilter: string | null;
  totalsByStatus: Record<string, number>;
}) {
  const [editing, setEditing] = useState<AnimalRow | null>(null);
  const [deleting, setDeleting] = useState<AnimalRow | null>(null);
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [sexFilter, setSexFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [breedFilter, setBreedFilter] = useState<string>("all");
  const [penFilter, setPenFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("animal_id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [density, setDensity] = useState<"compact" | "cozy">("compact");

  const penLabel = useCallback(
    (id: string | null) => pens.find((p) => p.id === id)?.name ?? "—",
    [pens],
  );
  const groupLabel = useCallback(
    (id: string | null) => groups.find((g) => g.id === id)?.label ?? "—",
    [groups],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((a) => {
      if (q) {
        const hit =
          (a.animal_id ?? "").toLowerCase().includes(q) ||
          (a.name ?? "").toLowerCase().includes(q) ||
          (a.official_id ?? "").toLowerCase().includes(q) ||
          (a.sire_naab ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (sexFilter !== "all" && a.sex !== sexFilter) return false;
      if (stageFilter !== "all" && (a.life_stage ?? "other") !== stageFilter) return false;
      if (breedFilter !== "all" && (a.breed_code ?? "—") !== breedFilter) return false;
      if (penFilter !== "all" && (a.current_pen_id ?? "—") !== penFilter) return false;
      if (groupFilter !== "all" && (a.current_group_id ?? "—") !== groupFilter) return false;
      return true;
    });
  }, [rows, search, sexFilter, stageFilter, breedFilter, penFilter, groupFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => dir * compareRow(a, b, sortKey, penLabel, groupLabel));
    return copy;
  }, [filtered, sortKey, sortDir, penLabel, groupLabel]);

  const onSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const breedsInUse = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.breed_code ?? "—"))).sort(),
    [rows],
  );
  const lifeStages = [
    "calf",
    "weaned_heifer",
    "breeding_heifer",
    "bred_heifer",
    "lactating",
    "dry",
    "bull",
    "other",
  ];

  const exportCsv = () => {
    const header = [
      "animal_id",
      "name",
      "official_id",
      "breed_code",
      "sex",
      "life_stage",
      "birth_date",
      "current_lactation",
      "last_calving_date",
      "dim",
      "pen",
      "group",
      "status",
    ];
    const lines = [header.join(",")];
    for (const a of sorted) {
      const dim = a.last_calving_date ? diffDays(a.last_calving_date) : "";
      const cells = [
        a.animal_id,
        a.name ?? "",
        a.official_id ?? "",
        a.breed_code ?? "",
        a.sex,
        a.life_stage ?? "",
        a.birth_date,
        a.current_lactation ?? "",
        a.last_calving_date ?? "",
        dim,
        penLabel(a.current_pen_id),
        groupLabel(a.current_group_id),
        a.status,
      ];
      lines.push(
        cells
          .map((c) => {
            const s = String(c ?? "");
            return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `animals_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cellPad = density === "compact" ? "px-2 py-1" : "px-3 py-2";
  const headPad = density === "compact" ? "px-2 py-1.5" : "px-3 py-2";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID / name / official ID / NAAB"
            className="h-8 w-64 pl-7 pr-2 text-xs border border-foreground/10 bg-background"
          />
        </div>
        <FilterSelect
          label="Sex"
          value={sexFilter}
          onChange={setSexFilter}
          options={[
            ["all", "All sex"],
            ["female", "Female"],
            ["male", "Male"],
            ["freemartin", "Freemartin"],
            ["castrated", "Castrated"],
          ]}
        />
        <FilterSelect
          label="Stage"
          value={stageFilter}
          onChange={setStageFilter}
          options={[["all", "All stages"], ...lifeStages.map((s) => [s, s.replace("_", " ")] as [string, string])]}
        />
        <FilterSelect
          label="Breed"
          value={breedFilter}
          onChange={setBreedFilter}
          options={[["all", "All breeds"], ...breedsInUse.map((b) => [b, b] as [string, string])]}
        />
        <FilterSelect
          label="Pen"
          value={penFilter}
          onChange={setPenFilter}
          options={[
            ["all", "All pens"],
            ["—", "(no pen)"],
            ...pens.map((p) => [p.id, p.name] as [string, string]),
          ]}
        />
        <FilterSelect
          label="Group"
          value={groupFilter}
          onChange={setGroupFilter}
          options={[
            ["all", "All groups"],
            ["—", "(no group)"],
            ...groups.map((g) => [g.id, g.label] as [string, string]),
          ]}
        />

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {sorted.length}/{rows.length}
          </span>
          <button
            type="button"
            className="h-7 px-2 text-[10px] uppercase tracking-wide border border-foreground/10 hover:bg-foreground/5"
            onClick={() => setDensity((d) => (d === "compact" ? "cozy" : "compact"))}
          >
            {density === "compact" ? "Compact" : "Cozy"}
          </button>
          <Button type="button" size="sm" variant="outline" onClick={exportCsv}>
            <HugeiconsIcon icon={DownloadCircle01Icon} />
            CSV
          </Button>
          <CreateDialog
            locationId={locationId}
            pens={pens}
            groups={groups}
            breeds={breeds}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <StatusFilter
          current={statusFilter}
          totals={totalsByStatus}
          onChange={(s) => {
            const url = new URL(window.location.href);
            if (s) url.searchParams.set("status", s);
            else url.searchParams.delete("status");
            router.push(url.pathname + (url.search ? url.search : ""));
          }}
        />
      </div>

      <div className="ring-1 ring-foreground/10 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-foreground/5">
            <tr className="text-left">
              <SortHead label="ID" k="animal_id" sortKey={sortKey} sortDir={sortDir} onSort={onSort} pad={headPad} />
              <SortHead label="Name" k="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} pad={headPad} />
              <SortHead label="Breed" k="breed_code" sortKey={sortKey} sortDir={sortDir} onSort={onSort} pad={headPad} />
              <SortHead label="Sex" k="sex" sortKey={sortKey} sortDir={sortDir} onSort={onSort} pad={headPad} />
              <SortHead label="Stage" k="life_stage" sortKey={sortKey} sortDir={sortDir} onSort={onSort} pad={headPad} />
              <SortHead label="Birth" k="birth_date" sortKey={sortKey} sortDir={sortDir} onSort={onSort} pad={headPad} />
              <SortHead label="Lact" k="current_lactation" sortKey={sortKey} sortDir={sortDir} onSort={onSort} pad={headPad} align="right" />
              <SortHead label="Last fresh" k="last_calving_date" sortKey={sortKey} sortDir={sortDir} onSort={onSort} pad={headPad} />
              <SortHead label="DIM" k="dim" sortKey={sortKey} sortDir={sortDir} onSort={onSort} pad={headPad} align="right" />
              <SortHead label="Pen" k="pen" sortKey={sortKey} sortDir={sortDir} onSort={onSort} pad={headPad} />
              <SortHead label="Group" k="group" sortKey={sortKey} sortDir={sortDir} onSort={onSort} pad={headPad} />
              <SortHead label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} pad={headPad} />
              <th className={`${headPad} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={13} className={`${cellPad} text-center text-muted-foreground`}>
                  No animals match.
                </td>
              </tr>
            ) : (
              sorted.map((a) => {
                const dim = a.last_calving_date ? diffDays(a.last_calving_date) : null;
                return (
                  <tr key={a.id} className="border-t border-foreground/10 hover:bg-foreground/[0.025]">
                    <td className={`${cellPad} font-mono font-medium`}>
                      <Link
                        href={`/settings/locations/${locationId}/animals/${a.id}`}
                        className="hover:underline"
                      >
                        {a.animal_id}
                      </Link>
                    </td>
                    <td className={cellPad}>{a.name ?? "—"}</td>
                    <td className={`${cellPad} font-mono text-muted-foreground`}>
                      {a.breed_code ?? "—"}
                    </td>
                    <td className={`${cellPad} capitalize text-muted-foreground`}>{a.sex}</td>
                    <td className={`${cellPad} text-muted-foreground`}>
                      {(a.life_stage ?? "—").replace("_", " ")}
                    </td>
                    <td className={`${cellPad} text-muted-foreground tabular-nums`}>{a.birth_date}</td>
                    <td className={`${cellPad} text-right tabular-nums`}>
                      {a.current_lactation ?? "—"}
                    </td>
                    <td className={`${cellPad} text-muted-foreground tabular-nums`}>
                      {a.last_calving_date ?? "—"}
                    </td>
                    <td className={`${cellPad} text-right tabular-nums`}>
                      {dim ?? "—"}
                    </td>
                    <td className={`${cellPad} text-muted-foreground`}>
                      {penLabel(a.current_pen_id)}
                    </td>
                    <td className={`${cellPad} text-muted-foreground`}>
                      {groupLabel(a.current_group_id)}
                    </td>
                    <td className={`${cellPad} capitalize text-muted-foreground`}>{a.status}</td>
                    <td className={`${cellPad} text-right`}>
                      <div className="flex justify-end gap-1">
                        <Button type="button" size="sm" variant="ghost" asChild>
                          <Link href={`/settings/locations/${locationId}/animals/${a.id}`}>
                            <HugeiconsIcon icon={ArrowRight01Icon} />
                          </Link>
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(a)}>
                          <HugeiconsIcon icon={PencilEdit02Icon} />
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setDeleting(a)}>
                          <HugeiconsIcon icon={Delete02Icon} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <EditDialog
        row={editing}
        locationId={locationId}
        pens={pens}
        groups={groups}
        breeds={breeds}
        onClose={() => setEditing(null)}
      />
      <DeleteDialog
        row={deleting}
        locationId={locationId}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

type SortKey =
  | "animal_id"
  | "name"
  | "breed_code"
  | "sex"
  | "life_stage"
  | "birth_date"
  | "current_lactation"
  | "last_calving_date"
  | "dim"
  | "pen"
  | "group"
  | "status";

function diffDays(from: string): number {
  return Math.floor((Date.now() - new Date(from).getTime()) / 86400000);
}

function compareRow(
  a: AnimalRow,
  b: AnimalRow,
  k: SortKey,
  penLabel: (id: string | null) => string,
  groupLabel: (id: string | null) => string,
): number {
  switch (k) {
    case "animal_id":
      return cmpStr(a.animal_id, b.animal_id);
    case "name":
      return cmpStr(a.name, b.name);
    case "breed_code":
      return cmpStr(a.breed_code, b.breed_code);
    case "sex":
      return cmpStr(a.sex, b.sex);
    case "life_stage":
      return cmpStr(a.life_stage, b.life_stage);
    case "birth_date":
      return cmpStr(a.birth_date, b.birth_date);
    case "current_lactation":
      return cmpNum(a.current_lactation, b.current_lactation);
    case "last_calving_date":
      return cmpStr(a.last_calving_date, b.last_calving_date);
    case "dim":
      return cmpNum(
        a.last_calving_date ? diffDays(a.last_calving_date) : null,
        b.last_calving_date ? diffDays(b.last_calving_date) : null,
      );
    case "pen":
      return cmpStr(penLabel(a.current_pen_id), penLabel(b.current_pen_id));
    case "group":
      return cmpStr(groupLabel(a.current_group_id), groupLabel(b.current_group_id));
    case "status":
      return cmpStr(a.status, b.status);
  }
}

function cmpStr(a: string | null | undefined, b: string | null | undefined): number {
  const av = (a ?? "").toLowerCase();
  const bv = (b ?? "").toLowerCase();
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return av.localeCompare(bv);
}
function cmpNum(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

function SortHead({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  pad,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  pad: string;
  align?: "left" | "right";
}) {
  const isActive = sortKey === k;
  return (
    <th className={`${pad} font-medium ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          isActive ? "text-foreground" : "text-muted-foreground"
        } ${align === "right" ? "ml-auto" : ""}`}
      >
        {label}
        {isActive ? (
          <HugeiconsIcon
            icon={sortDir === "asc" ? ArrowUp01Icon : ArrowDown01Icon}
            className="size-3"
          />
        ) : null}
      </button>
    </th>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 px-2 text-xs border border-foreground/10 bg-background"
    >
      {options.map(([v, lbl]) => (
        <option key={v} value={v}>
          {lbl}
        </option>
      ))}
    </select>
  );
}

function StatusFilter({
  current,
  totals,
  onChange,
}: {
  current: string | null;
  totals: Record<string, number>;
  onChange: (s: string | null) => void;
}) {
  const options: { value: string | null; label: string }[] = [
    { value: null, label: `All (${Object.values(totals).reduce((a, b) => a + b, 0)})` },
    ...statusOptions.map((s) => ({
      value: s.value,
      label: `${s.label} (${totals[s.value] ?? 0})`,
    })),
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const active = (o.value ?? null) === current;
        return (
          <button
            key={o.value ?? "__all"}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-2.5 py-1 text-xs ring-1 ${
              active
                ? "bg-primary/10 ring-primary/30 text-primary"
                : "ring-foreground/10 hover:ring-foreground/20"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function AnimalFormBody({
  form,
  pens,
  groups,
  breeds,
}: {
  form: ReturnType<typeof useForm<FormValues>>;
  pens: PenLite[];
  groups: GroupLite[];
  breeds: BreedLite[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="animal_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Animal ID</FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="breed_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Breed</FormLabel>
              <FormControl>
                <Select
                  value={field.value || "__none"}
                  onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">
                      <span className="italic text-muted-foreground">—</span>
                    </SelectItem>
                    {breeds.map((b) => (
                      <SelectItem key={b.code} value={b.code}>
                        {b.code} — {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sex"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sex</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sexOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="birth_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Birth date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3 border-t pt-3">
        <FormField
          control={form.control}
          name="official_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Official ID (840/ISO)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="registration_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reg #</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="origin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Origin</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {originOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="source_farm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Source farm</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="entry_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Entry date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t pt-3">
        <FormField
          control={form.control}
          name="current_pen_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pen</FormLabel>
              <FormControl>
                <Select
                  value={field.value || "__none"}
                  onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">
                      <span className="italic text-muted-foreground">Unassigned</span>
                    </SelectItem>
                    {pens.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="current_group_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Group</FormLabel>
              <FormControl>
                <Select
                  value={field.value || "__none"}
                  onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">
                      <span className="italic text-muted-foreground">Unassigned</span>
                    </SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="current_lactation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current lactation</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={field.value === "" || field.value === undefined ? "" : (field.value as number)}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="last_calving_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last calving date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3 border-t pt-3">
        <FormField
          control={form.control}
          name="sire_naab"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sire NAAB</FormLabel>
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
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dam_tag_external"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dam tag (external)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3 border-t pt-3">
        <FormField
          control={form.control}
          name="life_stage"
          render={({ field }) => (
            <FormItem className="sm:col-span-3">
              <FormLabel>Life stage</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {lifeStageOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="is_pregnant"
          render={({ field }) => (
            <FormItem className="sm:col-span-3 flex flex-row items-center justify-between gap-3 ring-1 ring-foreground/10 p-3">
              <div className="flex flex-col gap-0.5">
                <FormLabel className="font-normal">Currently pregnant</FormLabel>
                <span className="text-[10px] text-muted-foreground">
                  Toggling on captures last breeding + preg-check as repro events.
                </span>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        {form.watch("is_pregnant") ? (
          <>
            <FormField
              control={form.control}
              name="last_breeding_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last breeding date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="last_breeding_sire_naab"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Breeding sire NAAB</FormLabel>
                  <FormControl>
                    <Input placeholder="014HO07419" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="days_pregnant"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Days pregnant (today)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={field.value === "" || field.value === undefined ? "" : (field.value as number)}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === ""
                            ? ""
                            : Number(e.target.value),
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="preg_check_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preg check date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : null}
      </fieldset>

      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem className="border-t pt-3">
            <FormLabel>Notes</FormLabel>
            <FormControl>
              <Textarea rows={2} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function CreateDialog({
  locationId,
  pens,
  groups,
  breeds,
}: {
  locationId: string;
  pens: PenLite[];
  groups: GroupLite[];
  breeds: BreedLite[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: empty,
  });
  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await createAnimal(toSubmit(locationId, values));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Animal created.");
      form.reset(empty);
      setOpen(false);
      router.refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <HugeiconsIcon icon={PlusSignIcon} />
          New animal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create animal</DialogTitle>
          <DialogDescription>
            Identity + current state. Time-bound events (lactations, repro,
            health, etc) are added on the animal&apos;s detail page.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <AnimalFormBody form={form} pens={pens} groups={groups} breeds={breeds} />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  row,
  locationId,
  pens,
  groups,
  breeds,
  onClose,
}: {
  row: AnimalRow | null;
  locationId: string;
  pens: PenLite[];
  groups: GroupLite[];
  breeds: BreedLite[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: row
      ? ({
          ...empty,
          animal_id: row.animal_id,
          name: row.name ?? "",
          official_id: row.official_id ?? "",
          registration_number: row.registration_number ?? "",
          breed_code: row.breed_code ?? "",
          sex: row.sex as FormValues["sex"],
          birth_date: row.birth_date,
          entry_date: row.entry_date,
          origin: row.origin as FormValues["origin"],
          source_farm: row.source_farm ?? "",
          status: row.status as FormValues["status"],
          status_date: row.status_date ?? "",
          current_pen_id: row.current_pen_id ?? "",
          current_group_id: row.current_group_id ?? "",
          current_lactation: row.current_lactation ?? ("" as unknown as number),
          last_calving_date: row.last_calving_date ?? "",
          sire_naab: row.sire_naab ?? "",
          sire_name: row.sire_name ?? "",
          dam_tag_external: row.dam_tag_external ?? "",
          notes: row.notes ?? "",
          life_stage:
            (row.life_stage as FormValues["life_stage"]) ?? "other",
        } as FormValues)
      : empty,
  });
  if (!row) return null;
  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await updateAnimal({ id: row.id, ...toSubmit(locationId, values) });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Animal updated.");
      onClose();
      router.refresh();
    });
  };
  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit animal</DialogTitle>
          <DialogDescription>
            {row.animal_id}
            {row.name ? ` — ${row.name}` : ""}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <AnimalFormBody form={form} pens={pens} groups={groups} breeds={breeds} />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  row,
  locationId,
  onClose,
}: {
  row: AnimalRow | null;
  locationId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  if (!row) return null;
  const onConfirm = () => {
    startTransition(async () => {
      const result = await deleteAnimal({ id: row.id, location_id: locationId });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Animal deleted.");
      onClose();
      router.refresh();
    });
  };
  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete animal</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{row.animal_id}</strong> and
            cascade-delete all of her events (lactations, milkings, repro,
            health, etc).
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={isPending} onClick={onConfirm}>
            <HugeiconsIcon icon={Delete02Icon} />
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
