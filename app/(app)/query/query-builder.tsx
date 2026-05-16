"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  serializeCommand,
  parseCommand,
  type CmpOp,
  type Query,
} from "@/lib/derive/query";
import {
  ConditionBuilder,
  condsToPredicate,
  describeConds,
  labelOf,
  ITEMS,
  ITEM_GROUPS,
  type ConditionValue,
} from "@/components/condition-builder";
import { FieldPicker } from "@/components/field-picker";
import { runQueryAction, type QueryResponse } from "./actions";
import { toCsv } from "@/lib/csv";
import { saveView } from "../views/actions";
import { toast } from "sonner";

type Verb = "LIST" | "COUNT" | "SUM" | "PCT";
type AggOpt =
  | "mean"
  | "total"
  | "min"
  | "max"
  | "range"
  | "median"
  | "stdev";
const AGGS: AggOpt[] = [
  "mean",
  "total",
  "min",
  "max",
  "range",
  "median",
  "stdev",
];

export function QueryBuilder() {
  const [verb, setVerb] = useState<Verb>("LIST");
  const [columns, setColumns] = useState<string[]>(["ID", "RPRO", "DIM"]);
  const [cond, setCond] = useState<ConditionValue>({
    conds: [],
    matchAny: false,
  });
  const [sortItem, setSortItem] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showCmd, setShowCmd] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [asOf, setAsOf] = useState("");
  const [viewName, setViewName] = useState("");
  const [pending, start] = useTransition();
  const [saving, startSave] = useTransition();
  const [mode, setMode] = useState<"builder" | "command">("builder");
  const [cmdText, setCmdText] = useState("");
  const [agg, setAgg] = useState<AggOpt>("mean");
  const [g1, setG1] = useState("");
  const [g2, setG2] = useState("");
  const [hOp, setHOp] = useState("");
  const [hVal, setHVal] = useState("");

  const query: Query = useMemo(() => {
    const groupBy = [g1, g2].filter(Boolean);
    const grp = verb !== "LIST" && groupBy.length ? groupBy : undefined;
    const having =
      grp && hOp && hVal !== ""
        ? { op: hOp as CmpOp, value: Number(hVal) }
        : undefined;
    const base =
      verb === "PCT"
        ? { verb, items: [] as string[], pct: condsToPredicate(cond) }
        : {
            verb,
            items: verb === "COUNT" ? [] : columns,
            for: condsToPredicate(cond),
            by:
              !grp && sortItem
                ? { item: sortItem, dir: sortDir }
                : undefined,
            ...(verb === "SUM" && agg !== "mean" ? { agg } : {}),
          };
    return {
      ...base,
      ...(grp ? { groupBy: grp } : {}),
      ...(having ? { having } : {}),
    } as Query;
  }, [verb, columns, cond, sortItem, sortDir, agg, g1, g2, hOp, hVal]);

  const sentence = useMemo(() => {
    if (verb === "PCT")
      return `What % of animals${describeConds(cond) || " (all)"}?`;
    const verbText =
      verb === "LIST"
        ? "Show"
        : verb === "COUNT"
          ? "Count"
          : `Summarize (${agg})`;
    const cols =
      verb === "COUNT"
        ? "animals"
        : columns.length
          ? columns.map(labelOf).join(", ")
          : "animals";
    let s = `${verbText} ${cols}${describeConds(cond)}`;
    if (sortItem)
      s += `, sorted by ${labelOf(sortItem)} (${
        sortDir === "asc" ? "lowest" : "highest"
      } first)`;
    return s + ".";
  }, [verb, columns, cond, sortItem, sortDir, agg]);

  const toggleCol = (v: string) =>
    setColumns((c) =>
      c.includes(v) ? c.filter((x) => x !== v) : [...c, v],
    );

  const effective = useMemo<
    { ok: true; query: Query } | { ok: false; error: string }
  >(() => {
    if (mode === "builder") return { ok: true, query };
    try {
      return { ok: true, query: parseCommand(cmdText) };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }, [mode, query, cmdText]);

  const switchTo = (m: "builder" | "command") => {
    if (m === "command") setCmdText(serializeCommand(query));
    setMode(m);
  };

  const run = () =>
    start(async () => {
      if (!effective.ok) return void toast.error(effective.error);
      setResult(await runQueryAction(effective.query, asOf || undefined));
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 text-xs">
        {(["builder", "command"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchTo(m)}
            className={
              "rounded px-2 py-0.5 capitalize transition-colors " +
              (mode === m
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted")
            }
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "command" ? (
        <div className="space-y-1">
          <Input
            className="h-9 font-mono text-xs"
            placeholder="LIST ID RPRO FOR RC>5 DDRY=5-10 DOWNBY RPRO"
            value={cmdText}
            onChange={(e) => setCmdText(e.target.value)}
            spellCheck={false}
          />
          {effective.ok ? (
            <p className="text-[11px] text-muted-foreground">
              Parses OK · power mode — DC command syntax.
            </p>
          ) : (
            <p className="text-[11px] text-destructive">{effective.error}</p>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-sm">
            <Select value={verb} onValueChange={(v) => setVerb(v as Verb)}>
              <SelectTrigger className="h-7 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LIST">Show</SelectItem>
                <SelectItem value="COUNT">Count</SelectItem>
                <SelectItem value="SUM">Summarize</SelectItem>
                <SelectItem value="PCT">Percentage</SelectItem>
              </SelectContent>
            </Select>

            {verb === "SUM" && (
              <Select
                value={agg}
                onValueChange={(v) => setAgg(v as AggOpt)}
              >
                <SelectTrigger className="h-7 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGGS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {(verb === "LIST" || verb === "SUM") && (
              <FieldPicker
                multiple
                items={ITEMS}
                groups={ITEM_GROUPS}
                values={columns}
                onToggle={toggleCol}
                exclude={
                  verb === "SUM"
                    ? (i) => i.value === "PEN"
                    : undefined
                }
                placeholder={verb === "SUM" ? "Averaging" : "Columns"}
              />
            )}

            <ConditionBuilder value={cond} onChange={setCond} />

            {verb !== "LIST" && (
              <>
                <span className="text-xs text-muted-foreground">
                  group by
                </span>
                {[
                  [g1, setG1] as const,
                  [g2, setG2] as const,
                ].map(([gv, gs], idx) => (
                  <FieldPicker
                    key={idx}
                    items={ITEMS}
                    groups={ITEM_GROUPS}
                    value={gv}
                    onChange={gs}
                    clearLabel="— none —"
                    placeholder="—"
                    triggerClassName="w-[120px]"
                  />
                ))}
                {g1 && (
                  <>
                    <span className="text-xs text-muted-foreground">
                      having
                    </span>
                    <Select
                      value={hOp || "none"}
                      onValueChange={(v) => setHOp(v === "none" ? "" : v)}
                    >
                      <SelectTrigger className="h-7 w-[90px] text-xs">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {[">", ">=", "<", "<=", "=", "<>"].map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {hOp && (
                      <Input
                        className="h-7 w-16 text-xs"
                        type="number"
                        value={hVal}
                        onChange={(e) => setHVal(e.target.value)}
                      />
                    )}
                  </>
                )}
              </>
            )}

            <span className="text-xs text-muted-foreground">sort</span>
            <FieldPicker
              items={ITEMS}
              groups={ITEM_GROUPS}
              value={sortItem}
              onChange={setSortItem}
              clearLabel="Animal ID"
              triggerClassName="w-[130px]"
            />
            <Select
              value={sortDir}
              onValueChange={(v) => setSortDir(v as "asc" | "desc")}
            >
              <SelectTrigger className="h-7 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">lowest first</SelectItem>
                <SelectItem value="desc">highest first</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>{sentence}</span>
            <button
              type="button"
              onClick={() => setShowCmd((s) => !s)}
              className="underline-offset-2 hover:underline"
            >
              · {showCmd ? "hide command" : "command"}
            </button>
            {showCmd && (
              <code className="rounded bg-muted px-2 py-0.5 font-mono text-foreground">
                {serializeCommand(query)}
              </code>
            )}
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={run} disabled={pending}>
          {pending ? "Running…" : "Run"}
        </Button>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          as of
          <Input
            className="h-8 w-36 text-xs"
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            title="Leave blank for today (time-travel: herd as of any date)"
          />
        </span>
        <Input
          className="h-8 w-48 text-xs"
          placeholder="save as view…"
          value={viewName}
          onChange={(e) => setViewName(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={saving || !viewName.trim()}
          onClick={() =>
            startSave(async () => {
              if (!effective.ok) return void toast.error(effective.error);
              const res = await saveView({
                name: viewName.trim(),
                query: effective.query,
              });
              if (res.error) return void toast.error(res.error);
              toast.success(`Saved view “${viewName.trim()}”.`);
              setViewName("");
            })
          }
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {result && <Results result={result} />}
    </div>
  );
}

function downloadCsv(rows: Record<string, unknown>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `query-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function CsvButton({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <Button
      size="sm"
      variant="outline"
      className="mb-2"
      onClick={() => downloadCsv(rows)}
    >
      Download CSV
    </Button>
  );
}

function Results({ result }: { result: QueryResponse }) {
  if ("error" in result)
    return <p className="text-sm text-destructive">Error: {result.error}</p>;
  if (result.kind === "pct")
    return (
      <div>
        <CsvButton
          rows={[
            {
              pct: result.pct,
              numerator: result.numerator,
              denominator: result.denominator,
            },
          ]}
        />
        <Card>
          <CardContent className="py-6">
            <span className="font-heading text-3xl font-semibold">
              {result.pct ?? "—"}%
            </span>
            <span className="ml-2 text-sm text-muted-foreground">
              {result.numerator} of {result.denominator}
            </span>
          </CardContent>
        </Card>
      </div>
    );
  if (result.kind === "group") {
    if (result.rows.length === 0)
      return (
        <p className="text-sm text-muted-foreground">No groups match.</p>
      );
    const cols = Object.keys(result.rows[0]);
    return (
      <div>
        <CsvButton rows={result.rows} />
        <Card>
          <CardContent className="overflow-x-auto py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  {cols.map((c) => (
                    <TableHead key={c}>{labelOf(c)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((r, i) => (
                  <TableRow key={i}>
                    {cols.map((c) => (
                      <TableCell key={c}>{r[c] ?? "—"}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (result.kind === "count")
    return (
      <div>
        <CsvButton rows={[{ count: result.count }]} />
        <Card>
          <CardContent className="py-6">
            <span className="font-heading text-3xl font-semibold">
              {result.count}
            </span>
            <span className="ml-2 text-sm text-muted-foreground">
              animal{result.count === 1 ? "" : "s"}
            </span>
          </CardContent>
        </Card>
      </div>
    );
  if (result.kind === "sum")
    return (
      <div>
        <CsvButton rows={[result.sum]} />
        <Card>
          <CardContent className="py-4">
            <Table>
            <TableBody>
              {Object.entries(result.sum).map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell className="font-medium">{labelOf(k)}</TableCell>
                  <TableCell>{v ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </CardContent>
        </Card>
      </div>
    );
  if (result.rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No animals match. (The herd has no animals yet — intake comes in a
        later step.)
      </p>
    );
  const cols = Object.keys(result.rows[0]);
  return (
    <div>
      <CsvButton rows={result.rows} />
      <Card>
        <CardContent className="overflow-x-auto py-4">
          <Table>
          <TableHeader>
            <TableRow>
              {cols.map((c) => (
                <TableHead key={c}>{labelOf(c)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((r, i) => (
              <TableRow key={i}>
                {cols.map((c) => (
                  <TableCell key={c}>{r[c] ?? "—"}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
