"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DownloadCircle01Icon,
  Sparkles,
  Upload01Icon,
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
import { generateSampleAnimals } from "@/app/(app)/settings/locations/[id]/animals-actions";

const TEMPLATE_COLUMNS = [
  "animal_id",
  "name",
  "official_id",
  "registration_number",
  "breed_code",
  "sex",
  "birth_date",
  "entry_date",
  "origin",
  "source_farm",
  "status",
  "life_stage",
  "current_pen",
  "current_group",
  "current_lactation",
  "last_calving_date",
  "is_pregnant",
  "last_breeding_date",
  "last_breeding_sire_naab",
  "preg_check_date",
  "days_pregnant",
  "sire_naab",
  "sire_name",
  "dam_animal_id",
  "dam_tag_external",
  "a2_status",
  "polled",
  "notes",
];

const EXAMPLES: Record<string, string> = {
  animal_id: "1247",
  name: "Bessie",
  official_id: "840003123456789",
  registration_number: "",
  breed_code: "HO",
  sex: "female",
  birth_date: "2022-03-14",
  entry_date: "2022-03-14",
  origin: "born_on_farm",
  source_farm: "",
  status: "active",
  life_stage: "lactating",
  current_pen: "Pen 3",
  current_group: "High",
  current_lactation: "2",
  last_calving_date: "2025-04-12",
  is_pregnant: "true",
  last_breeding_date: "2025-06-20",
  last_breeding_sire_naab: "014HO07419",
  preg_check_date: "2025-07-25",
  days_pregnant: "65",
  sire_naab: "551HO03734",
  sire_name: "",
  dam_animal_id: "982",
  dam_tag_external: "",
  a2_status: "A2A2",
  polled: "No",
  notes: "Imported from prior system",
};

export function AnimalsToolbar({
  locationId,
  hasNoAnimals,
}: {
  locationId: string;
  hasNoAnimals: boolean;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const downloadTemplate = () => {
    const header = TEMPLATE_COLUMNS.join(",");
    const example = TEMPLATE_COLUMNS.map((c) => {
      const v = EXAMPLES[c] ?? "";
      return v.includes(",") ? `"${v}"` : v;
    }).join(",");
    const csv = `${header}\n${example}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "animals_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onGenerate = () => {
    startTransition(async () => {
      const result = await generateSampleAnimals(locationId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("20 sample animals generated.");
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {hasNoAnimals ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onGenerate}
            disabled={isPending}
          >
            <HugeiconsIcon icon={Sparkles} />
            {isPending ? "Generating..." : "Generate 20 sample animals"}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setImportOpen(true)}
        >
          <HugeiconsIcon icon={Upload01Icon} />
          Bulk import
        </Button>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Bulk import animals</DialogTitle>
            <DialogDescription>
              Download the CSV template, fill it offline, then upload it
              here. Full upload + column-mapping ships in PR-F.2; for now
              you can prepare the file and we&apos;ll wire ingestion next.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="ring-1 ring-foreground/10 p-3 flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">animals_template.csv</span>
                <span className="text-[10px] text-muted-foreground">
                  {TEMPLATE_COLUMNS.length} columns · one row per animal ·
                  joined by <span className="font-mono">animal_id</span>
                </span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                <HugeiconsIcon icon={DownloadCircle01Icon} />
                Download
              </Button>
            </div>
            <div className="ring-1 ring-foreground/10 p-3 flex flex-col gap-1">
              <span className="text-sm font-medium">Upload filled CSV</span>
              <input
                type="file"
                accept=".csv"
                className="text-xs"
                disabled
              />
              <span className="text-[10px] text-muted-foreground">
                Upload + dry-run preview ships in the next PR.
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Tip: see <span className="font-mono">docs/plan.md</span> §5 for
              the full multi-file import (lactations, repro, health, etc).
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
