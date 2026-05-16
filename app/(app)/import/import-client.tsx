"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  importAnimals,
  importMilkings,
  type ImportResult,
} from "./actions";

const ANIMAL_TEMPLATE =
  "cohort,animalId,name,breed,birthDate,lactation,freshDate,lastBredDate,serviceSire,dueDate,dryOffDate,pen,eid,damId,sireId,registration,entryReason,entryDate\r\n" +
  "lactating,1001,Bessie,HO,2022-03-01,3,2026-04-16,2026-05-10,7HO1234,,,1,,,,,existing,2026-05-16\r\n" +
  "open_heifer,H10,,HO,2024-11-16,0,,,,,,,,,,,born,2026-05-16";

const MILK_TEMPLATE =
  "animalId,date,yield,fat,prot,scc\r\n" +
  "1001,2026-05-16,38.5,3.8,3.1,150\r\n" +
  "1001,2026-05-16,12.0,,,";

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Panel({
  title,
  template,
  templateName,
  run,
  guide,
}: {
  title: string;
  template: string;
  templateName: string;
  run: (csv: string) => Promise<ImportResult>;
  guide: { col: string; req?: string; note: string }[];
}) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [res, setRes] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{title}</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => download(templateName, template)}
          >
            Download template
          </Button>
        </div>
        <details className="rounded border bg-muted/30 text-xs">
          <summary className="cursor-pointer px-3 py-2 font-medium">
            Field guide — allowed values &amp; what each column means
          </summary>
          <div className="overflow-x-auto px-3 pb-3">
            <table className="w-full">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 text-left">Column</th>
                  <th className="py-1 text-left">Required</th>
                  <th className="py-1 text-left">Notes / allowed values</th>
                </tr>
              </thead>
              <tbody>
                {guide.map((g) => (
                  <tr key={g.col} className="border-t border-border/50">
                    <td className="py-1 pr-3 font-mono">{g.col}</td>
                    <td className="py-1 pr-3">{g.req ?? "optional"}</td>
                    <td className="py-1 text-muted-foreground">{g.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <Textarea
          className="h-40 font-mono text-xs"
          placeholder="Paste CSV here…"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <Button
          size="sm"
          disabled={pending || !csv.trim()}
          onClick={() =>
            start(async () => {
              const r = await run(csv);
              setRes(r);
              if (r.created > 0) {
                toast.success(`Imported ${r.created} row(s).`);
                router.refresh();
              }
              if (r.failed > 0) toast.error(`${r.failed} row(s) failed.`);
            })
          }
        >
          {pending ? "Importing…" : "Import"}
        </Button>
        {res && (
          <div className="text-xs">
            <p className="text-muted-foreground">
              Created {res.created} · Failed {res.failed}
            </p>
            {res.errors.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-destructive">
                {res.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ANIMAL_GUIDE: { col: string; req?: string; note: string }[] = [
  {
    col: "cohort",
    req: "required",
    note: "one of: lactating · dry · bred_heifer · open_heifer · calf",
  },
  { col: "animalId", req: "required", note: "unique animal/barn ID" },
  { col: "entryDate", req: "required", note: "yyyy-mm-dd; when added to the herd" },
  {
    col: "lactation",
    req: "required",
    note: "0 for heifers/calves; ≥1 for lactating/dry cows",
  },
  {
    col: "freshDate",
    req: "lactating & dry",
    note: "last calving date — required for calved cows",
  },
  {
    col: "dryOffDate",
    req: "dry only",
    note: "required when cohort = dry",
  },
  {
    col: "lastBredDate",
    req: "bred_heifer",
    note: "required for a bred heifer; optional for a bred cow",
  },
  {
    col: "serviceSire",
    req: "if bred",
    note: "required whenever lastBredDate is given",
  },
  { col: "dueDate", note: "expected calving date if pregnant" },
  { col: "name / breed / pen", note: "optional descriptive fields" },
  {
    col: "eid / damId / sireId / registration",
    note: "optional identity / pedigree",
  },
  { col: "entryReason", note: "e.g. born / purchased / existing" },
];

const MILK_GUIDE: { col: string; req?: string; note: string }[] = [
  { col: "animalId", req: "required", note: "must already exist in Animals" },
  { col: "date", req: "required", note: "yyyy-mm-dd of the milking" },
  { col: "yield", req: "required", note: "kg, one row per milking (2×/3×/robotic all sum per day)" },
  { col: "fat / prot", note: "components, % (optional)" },
  { col: "scc", note: "somatic cell count, 1000s/mL (optional)" },
];

export function ImportClient() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="Animals (cohort intake)"
        template={ANIMAL_TEMPLATE}
        templateName="animals-template.csv"
        run={importAnimals}
        guide={ANIMAL_GUIDE}
      />
      <Panel
        title="Milkings"
        template={MILK_TEMPLATE}
        templateName="milk-template.csv"
        run={importMilkings}
        guide={MILK_GUIDE}
      />
    </div>
  );
}
