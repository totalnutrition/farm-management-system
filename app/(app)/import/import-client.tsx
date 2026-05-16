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
}: {
  title: string;
  template: string;
  templateName: string;
  run: (csv: string) => Promise<ImportResult>;
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

export function ImportClient() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="Animals (cohort intake)"
        template={ANIMAL_TEMPLATE}
        templateName="animals-template.csv"
        run={importAnimals}
      />
      <Panel
        title="Milkings"
        template={MILK_TEMPLATE}
        templateName="milk-template.csv"
        run={importMilkings}
      />
    </div>
  );
}
