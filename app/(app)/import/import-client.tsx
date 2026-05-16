"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { parseCsv } from "@/lib/csv-parse";
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
  "animalId,date,yield,fat,prot,snf,ts,scc\r\n" +
  "1001,2026-05-16,38.5,3.8,3.1,8.7,12.5,150\r\n" +
  "1001,2026-05-16,12.0,,,,,";

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const BATCH = 2000;

const esc = (v: string) =>
  /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

function chunkCsv(
  headers: string[],
  rows: Record<string, string>[],
): string {
  const head = headers.map(esc).join(",");
  const body = rows.map((r) =>
    headers.map((h) => esc(r[h] ?? "")).join(","),
  );
  return [head, ...body].join("\n");
}

function Panel({
  title,
  template,
  templateName,
  run,
  guide,
  required,
}: {
  title: string;
  template: string;
  templateName: string;
  run: (csv: string) => Promise<ImportResult>;
  guide: { col: string; req?: string; note: string }[];
  required: string[];
}) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [res, setRes] = useState<ImportResult | null>(null);
  const [prog, setProg] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const known = useMemo(
    () => template.split(/\r?\n/)[0].split(",").map((c) => c.trim()),
    [template],
  );

  // Client-side dry-run: parse + check column linkages before any
  // write. The server still re-validates every row (defence in depth).
  const check = useMemo(() => {
    const text = csv.trim();
    if (!text) return null;
    try {
      const { headers, rows } = parseCsv(text);
      const missing = required.filter((r) => !headers.includes(r));
      const unknown = headers.filter((h) => h && !known.includes(h));
      const recognized = headers.filter((h) => known.includes(h));
      return {
        ok: rows.length > 0 && missing.length === 0,
        rows,
        headers,
        missing,
        unknown,
        recognized,
      };
    } catch {
      return { ok: false, parseError: true } as const;
    }
  }, [csv, known, required]);

  const reset = () => {
    setCsv("");
    setFileName(null);
    setRes(null);
    setProg(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setRes(null);
    setCsv((await f.text()).trim());
    setFileName(f.name);
  };

  const preview =
    check && !("parseError" in check) ? check.rows.slice(0, 5) : [];

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

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="block text-xs file:mr-2 file:rounded file:border file:border-input file:bg-muted file:px-2 file:py-1 file:text-xs hover:file:bg-muted/70"
          />
          {fileName && (
            <span className="text-xs text-muted-foreground">
              {fileName} · {check && !("parseError" in check)
                ? `${check.rows.length} row(s)`
                : ""}
              <button
                type="button"
                onClick={reset}
                className="ml-2 underline-offset-2 hover:underline"
              >
                clear
              </button>
            </span>
          )}
        </div>

        {!fileName && (
          <Textarea
            className="h-40 font-mono text-xs"
            placeholder="…or paste CSV here"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
        )}

        {check && "parseError" in check && (
          <p className="text-xs text-destructive">
            Could not parse this file as CSV. Make sure it&apos;s a
            comma-separated export (Save As → CSV).
          </p>
        )}

        {check && !("parseError" in check) && (
          <div className="space-y-2 rounded border bg-muted/20 p-3 text-xs">
            <p className="font-medium">
              Verify before import — {check.rows.length} row(s)
            </p>
            <div className="flex flex-wrap gap-1">
              {check.recognized.map((c) => (
                <span
                  key={c}
                  className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-emerald-600 dark:text-emerald-400"
                >
                  {c}
                </span>
              ))}
              {check.unknown.map((c) => (
                <span
                  key={c}
                  className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-amber-600 dark:text-amber-400"
                  title="Not a template column — this column will be ignored"
                >
                  {c} (ignored)
                </span>
              ))}
            </div>
            {check.missing.length > 0 && (
              <p className="text-destructive">
                Missing required column(s):{" "}
                <span className="font-mono">
                  {check.missing.join(", ")}
                </span>
              </p>
            )}
            {preview.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="text-muted-foreground">
                    <tr>
                      {check.recognized.map((c) => (
                        <th key={c} className="py-1 pr-3 text-left font-mono">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} className="border-t border-border/50">
                        {check.recognized.map((c) => (
                          <td key={c} className="py-1 pr-3">
                            {r[c] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {check.rows.length > preview.length && (
                  <p className="mt-1 text-muted-foreground">
                    …and {check.rows.length - preview.length} more row(s)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <Button
          size="sm"
          disabled={pending || !check || !check.ok}
          onClick={() =>
            start(async () => {
              if (!check || "parseError" in check || !check.ok) return;
              const { headers, rows } = check;
              const agg: ImportResult = {
                created: 0,
                failed: 0,
                errors: [],
              };
              setProg({ done: 0, total: rows.length });
              for (let i = 0; i < rows.length; i += BATCH) {
                const slice = rows.slice(i, i + BATCH);
                const r = await run(chunkCsv(headers, slice));
                agg.created += r.created;
                agg.failed += r.failed;
                for (const e of r.errors)
                  if (agg.errors.length < 25) agg.errors.push(e);
                setProg({
                  done: Math.min(i + BATCH, rows.length),
                  total: rows.length,
                });
              }
              setProg(null);
              setRes(agg);
              if (agg.created > 0) {
                toast.success(`Imported ${agg.created} row(s).`);
                router.refresh();
              }
              if (agg.failed > 0)
                toast.error(`${agg.failed} row(s) failed.`);
            })
          }
        >
          {pending
            ? prog
              ? `Importing… ${prog.done}/${prog.total}`
              : "Importing…"
            : check && check.ok
              ? `Confirm & import ${check.rows.length} row(s)`
              : "Import"}
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
  {
    col: "snf / ts",
    note: "solids-not-fat % / total solids % (optional; TS derives from fat+snf if blank)",
  },
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
        required={["cohort", "animalId", "lactation", "entryDate"]}
      />
      <Panel
        title="Milkings"
        template={MILK_TEMPLATE}
        templateName="milk-template.csv"
        run={importMilkings}
        guide={MILK_GUIDE}
        required={["animalId", "date", "yield"]}
      />
    </div>
  );
}
