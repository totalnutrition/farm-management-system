"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  KPI_GROUPS,
  KPI_LABELS,
  DEFAULT_KPIS,
  type KpiKey,
  type Playbook,
} from "@/lib/playbook";
import { setActiveProtocol, setKpiOverrides } from "./actions";

export type ProtocolOption = {
  id: string;
  name: string;
  detail: string | null;
};

export function PlaybookClient({
  locationId,
  playbook,
  reproOptions,
  vaccinationOptions,
  treatmentOptions,
  hoofTrimOptions,
  dewormingOptions,
  dryOffOptions,
  groups,
  reproductionSettings,
  recordingProfile,
}: {
  locationId: string;
  playbook: Playbook;
  reproOptions: ProtocolOption[];
  vaccinationOptions: ProtocolOption[];
  treatmentOptions: ProtocolOption[];
  hoofTrimOptions: ProtocolOption[];
  dewormingOptions: ProtocolOption[];
  dryOffOptions: ProtocolOption[];
  groups: Array<{ id: string; label: string; group_class: string }>;
  reproductionSettings: {
    vwp_days: number | null;
    preg_check_initial_days: number | null;
    preg_check_confirm_days: number | null;
    expected_gestation_days: number | null;
  } | null;
  recordingProfile: {
    milkings_per_day: number | null;
    recording_method: string | null;
  } | null;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <GroupingCard locationId={locationId} groups={groups} />

      <ReproductionCard
        locationId={locationId}
        playbook={playbook}
        options={reproOptions}
        settings={reproductionSettings}
      />

      <HealthCard
        locationId={locationId}
        playbook={playbook}
        vaxOptions={vaccinationOptions}
        treatmentOptions={treatmentOptions}
        hoofOptions={hoofTrimOptions}
        dewormOptions={dewormingOptions}
        dryOffOptions={dryOffOptions}
      />

      <MilkRecordingCard
        locationId={locationId}
        playbook={playbook}
        recordingProfile={recordingProfile}
      />

      <FeedingCard locationId={locationId} playbook={playbook} />

      <CapacityCard locationId={locationId} playbook={playbook} />
    </div>
  );
}

// ---------------------------------------------------------------------
// Section: Grouping
// ---------------------------------------------------------------------
function GroupingCard({
  locationId,
  groups,
}: {
  locationId: string;
  groups: Array<{ id: string; label: string; group_class: string }>;
}) {
  return (
    <SectionCard
      title="Grouping"
      hint="Active strategy + the rule predicates the engine uses for group moves."
      actionHref={`/settings/locations/${locationId}/groups`}
      actionLabel="Edit on Herd structure →"
    >
      {groups.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">
          No groups defined yet — pick a strategy on Herd structure.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {groups.map((g) => (
            <li
              key={g.id}
              className="flex items-baseline justify-between gap-2 text-xs"
            >
              <span className="font-medium">{g.label}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {g.group_class}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------
// Section: Reproduction
// ---------------------------------------------------------------------
function ReproductionCard({
  locationId,
  playbook,
  options,
  settings,
}: {
  locationId: string;
  playbook: Playbook;
  options: ProtocolOption[];
  settings: {
    vwp_days: number | null;
    preg_check_initial_days: number | null;
    preg_check_confirm_days: number | null;
    expected_gestation_days: number | null;
  } | null;
}) {
  const active = options.find((o) => o.id === playbook.repro_protocol_id);
  return (
    <SectionCard
      title="Reproduction"
      hint="Sync protocol + window settings + KPI targets."
      kpiGroup="reproduction"
      locationId={locationId}
      playbook={playbook}
    >
      <div className="flex flex-col gap-2">
        <SelectionRow
          label="Sync protocol"
          activeName={active?.name ?? null}
          activeDetail={active?.detail ?? null}
          editor={
            <ProtocolPicker
              kind="repro"
              locationId={locationId}
              activeId={playbook.repro_protocol_id}
              options={options}
              detailLabel="type"
            />
          }
        />
        <KvRow
          rows={[
            ["Voluntary waiting period (d)", settings?.vwp_days ?? "—"],
            [
              "Initial preg-check (d post-AI)",
              settings?.preg_check_initial_days ?? "—",
            ],
            [
              "Preg-check confirm (d post-AI)",
              settings?.preg_check_confirm_days ?? "—",
            ],
            [
              "Expected gestation (d)",
              settings?.expected_gestation_days ?? "—",
            ],
          ]}
          editHref={`/settings/locations/${locationId}/reproduction`}
        />
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------
// Section: Health
// ---------------------------------------------------------------------
function HealthCard({
  locationId,
  playbook,
  vaxOptions,
  treatmentOptions,
  hoofOptions,
  dewormOptions,
  dryOffOptions,
}: {
  locationId: string;
  playbook: Playbook;
  vaxOptions: ProtocolOption[];
  treatmentOptions: ProtocolOption[];
  hoofOptions: ProtocolOption[];
  dewormOptions: ProtocolOption[];
  dryOffOptions: ProtocolOption[];
}) {
  const items: Array<{
    label: string;
    kind:
      | "vaccination"
      | "treatment"
      | "hoof_trim"
      | "deworming"
      | "dry_off";
    activeId: string | null;
    options: ProtocolOption[];
    detailLabel: string;
  }> = [
    {
      label: "Vaccination schedule",
      kind: "vaccination",
      activeId: playbook.vaccination_protocol_id,
      options: vaxOptions,
      detailLabel: "class",
    },
    {
      label: "Treatment protocol",
      kind: "treatment",
      activeId: playbook.treatment_protocol_id,
      options: treatmentOptions,
      detailLabel: "diagnosis",
    },
    {
      label: "Hoof trim schedule",
      kind: "hoof_trim",
      activeId: playbook.hoof_trim_protocol_id,
      options: hoofOptions,
      detailLabel: "class",
    },
    {
      label: "Deworming schedule",
      kind: "deworming",
      activeId: playbook.deworming_protocol_id,
      options: dewormOptions,
      detailLabel: "class",
    },
    {
      label: "Dry-off protocol",
      kind: "dry_off",
      activeId: playbook.dry_off_protocol_id,
      options: dryOffOptions,
      detailLabel: "approach d",
    },
  ];

  return (
    <SectionCard
      title="Health"
      hint="Active SOPs across vaccination, treatment, hoof trim, deworming, dry-off + KPI targets."
      kpiGroup="health"
      locationId={locationId}
      playbook={playbook}
    >
      <div className="flex flex-col gap-2">
        {items.map((it) => {
          const active = it.options.find((o) => o.id === it.activeId);
          return (
            <SelectionRow
              key={it.kind}
              label={it.label}
              activeName={active?.name ?? null}
              activeDetail={active?.detail ?? null}
              editor={
                <ProtocolPicker
                  kind={it.kind}
                  locationId={locationId}
                  activeId={it.activeId}
                  options={it.options}
                  detailLabel={it.detailLabel}
                />
              }
            />
          );
        })}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------
// Section: Milk recording
// ---------------------------------------------------------------------
function MilkRecordingCard({
  locationId,
  playbook,
  recordingProfile,
}: {
  locationId: string;
  playbook: Playbook;
  recordingProfile: {
    milkings_per_day: number | null;
    recording_method: string | null;
  } | null;
}) {
  return (
    <SectionCard
      title="Milk recording"
      hint="Sessions per day, recording method, test-day cadence + KPI targets."
      kpiGroup="milk_recording"
      locationId={locationId}
      playbook={playbook}
    >
      <KvRow
        rows={[
          ["Milkings per day", recordingProfile?.milkings_per_day ?? "—"],
          [
            "Recording method",
            recordingProfile?.recording_method ?? "—",
          ],
        ]}
        editHref={`/settings/locations/${locationId}/recording`}
      />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------
// Section: Feeding
// ---------------------------------------------------------------------
function FeedingCard({
  locationId,
  playbook,
}: {
  locationId: string;
  playbook: Playbook;
}) {
  return (
    <SectionCard
      title="Feeding"
      hint="TMR recipes + bunk targets + KPI targets."
      kpiGroup="feeding"
      locationId={locationId}
      playbook={playbook}
    >
      <p className="text-[11px] text-muted-foreground">
        Recipe assignments live on{" "}
        <Link
          href={`/settings/locations/${locationId}/recipes`}
          className="underline underline-offset-2"
        >
          TMR recipes
        </Link>
        . Mix-sheet variance + DMI report coming next.
      </p>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------
// Section: Capacity
// ---------------------------------------------------------------------
function CapacityCard({
  locationId,
  playbook,
}: {
  locationId: string;
  playbook: Playbook;
}) {
  return (
    <SectionCard
      title="Capacity"
      hint="Stocking thresholds the Hot list uses to flag over- / under-stocked pens."
      kpiGroup="capacity"
      locationId={locationId}
      playbook={playbook}
    >
      <p className="text-[11px] text-muted-foreground">
        Per-group capacity defaults live on{" "}
        <Link
          href={`/settings/locations/${locationId}/groups`}
          className="underline underline-offset-2"
        >
          Herd structure → Capacity plan
        </Link>
        . Below: the alert thresholds.
      </p>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------

function SectionCard({
  title,
  hint,
  children,
  actionHref,
  actionLabel,
  kpiGroup,
  locationId,
  playbook,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
  actionHref?: string;
  actionLabel?: string;
  kpiGroup?: keyof typeof KPI_GROUPS;
  locationId?: string;
  playbook?: Playbook;
}) {
  return (
    <section className="ring-1 ring-foreground/10 flex flex-col">
      <header className="px-3 py-2 bg-foreground/5 flex items-baseline justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="text-[10px] text-muted-foreground">{hint}</p>
        </div>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="text-[10px] text-primary underline underline-offset-2"
          >
            {actionLabel}
          </Link>
        ) : null}
      </header>
      <div className="p-3 flex flex-col gap-3">{children}</div>
      {kpiGroup && locationId && playbook ? (
        <KpiBlock
          locationId={locationId}
          playbook={playbook}
          group={kpiGroup}
        />
      ) : null}
    </section>
  );
}

function SelectionRow({
  label,
  activeName,
  activeDetail,
  editor,
}: {
  label: string;
  activeName: string | null;
  activeDetail: string | null;
  editor: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className={`font-medium ${activeName ? "" : "italic text-muted-foreground"}`}>
          {activeName ?? "— not set —"}
        </span>
        {activeDetail ? (
          <span className="text-[10px] text-muted-foreground">
            ({activeDetail})
          </span>
        ) : null}
        {editor}
      </span>
    </div>
  );
}

function KvRow({
  rows,
  editHref,
}: {
  rows: Array<[string, string | number]>;
  editHref: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-t pt-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-muted-foreground">{k}</span>
          <span className="tabular-nums font-medium">{v}</span>
        </div>
      ))}
      <Link
        href={editHref}
        className="text-[10px] text-primary underline underline-offset-2 self-end"
      >
        Edit →
      </Link>
    </div>
  );
}

function ProtocolPicker({
  kind,
  locationId,
  activeId,
  options,
  detailLabel,
}: {
  kind:
    | "repro"
    | "vaccination"
    | "treatment"
    | "hoof_trim"
    | "deworming"
    | "dry_off";
  locationId: string;
  activeId: string | null;
  options: ProtocolOption[];
  detailLabel: string;
}) {
  void detailLabel;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string>(activeId ?? "__none");
  const [busy, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const r = await setActiveProtocol({
        location_id: locationId,
        kind,
        protocol_id: picked === "__none" ? null : picked,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Updated.");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 px-1.5 text-[10px]"
        onClick={() => setOpen(true)}
      >
        Change
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pick active protocol</DialogTitle>
            <DialogDescription>
              Choose from the org library. New options can be added on{" "}
              <Link
                href="/settings/organization/protocols"
                className="underline underline-offset-2"
              >
                Settings → Organization → Protocols
              </Link>
              .
            </DialogDescription>
          </DialogHeader>
          <Select value={picked} onValueChange={setPicked}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">
                <span className="italic text-muted-foreground">— not set —</span>
              </SelectItem>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                  {o.detail ? ` · ${o.detail}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function KpiBlock({
  locationId,
  playbook,
  group,
}: {
  locationId: string;
  playbook: Playbook;
  group: keyof typeof KPI_GROUPS;
}) {
  const router = useRouter();
  const keys = KPI_GROUPS[group];
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const k of keys) {
      const cur = playbook.kpi_overrides[k];
      v[k] = typeof cur === "number" ? String(cur) : "";
    }
    return v;
  });

  const submit = () => {
    const overrides: Record<string, number | null> = { ...playbook.kpi_overrides };
    for (const k of keys) {
      const raw = vals[k];
      overrides[k] = raw === "" ? null : Number(raw);
    }
    startTransition(async () => {
      const r = await setKpiOverrides({
        location_id: locationId,
        overrides,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("KPIs updated.");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="border-t border-foreground/10 px-3 py-2 flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          KPI thresholds
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[10px]"
          onClick={() => setOpen(true)}
        >
          Edit
        </Button>
      </div>
      <ul className="flex flex-col gap-0.5">
        {keys.map((k) => {
          const override = playbook.kpi_overrides[k];
          const value = typeof override === "number" ? override : DEFAULT_KPIS[k];
          return (
            <li
              key={k}
              className="flex items-baseline justify-between gap-2 text-[11px]"
            >
              <span className="text-muted-foreground truncate">
                {KPI_LABELS[k]}
              </span>
              <span className="tabular-nums font-medium">
                {value}
                {typeof override !== "number" ? (
                  <span className="text-[9px] text-muted-foreground italic ml-1">
                    default
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit KPI thresholds</DialogTitle>
            <DialogDescription>
              Leave blank to fall back to the hardcoded default. The Hot list
              and rule engines re-read these on every page load.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {keys.map((k) => (
              <div key={k} className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground">
                  {KPI_LABELS[k]} (default {DEFAULT_KPIS[k]})
                </label>
                <Input
                  type="number"
                  step="any"
                  value={vals[k]}
                  onChange={(e) =>
                    setVals((p) => ({ ...p, [k]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function _typecheck(_k: KpiKey) {
  return _k;
}
void _typecheck;
