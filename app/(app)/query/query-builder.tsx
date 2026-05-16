"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  range,
  type Query,
  type Atom,
  type CmpOp,
} from "@/lib/derive/query";
import { runQueryAction, type QueryResponse } from "./actions";

// Only items the engine can actually compute are offered (no dead ends).
const ITEMS: { value: string; label: string }[] = [
  { value: "ID", label: "Animal ID" },
  { value: "RPRO", label: "Repro status" },
  { value: "RC", label: "Repro code (#)" },
  { value: "LACT", label: "Lactation #" },
  { value: "DIM", label: "Days in milk" },
  { value: "DDRY", label: "Days dry" },
  { value: "AGE", label: "Age (months)" },
  { value: "DCC", label: "Days carrying calf" },
  { value: "DUE", label: "Days to due" },
  { value: "DSLH", label: "Days since last heat" },
  { value: "DOPN", label: "Days open" },
  { value: "FDAT", label: "Fresh date" },
  { value: "DDAT", label: "Dry date" },
];
const labelOf = (v: string) =>
  ITEMS.find((i) => i.value === v)?.label ?? v;

const OPS: { value: string; label: string }[] = [
  { value: "=", label: "is" },
  { value: "<>", label: "is not" },
  { value: ">", label: "more than" },
  { value: ">=", label: "at least" },
  { value: "<", label: "less than" },
  { value: "<=", label: "at most" },
  { value: "between", label: "between" },
];
const opLabel = (v: string) => OPS.find((o) => o.value === v)?.label ?? v;

type Verb = "LIST" | "COUNT" | "SUM";
type Cond = { item: string; op: string; value: string; value2: string };

const num = (s: string) =>
  s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : s;

export function QueryBuilder() {
  const [verb, setVerb] = useState<Verb>("LIST");
  const [columns, setColumns] = useState<string[]>(["ID", "RPRO", "DIM"]);
  const [conds, setConds] = useState<Cond[]>([]);
  const [matchAny, setMatchAny] = useState(false);
  const [sortItem, setSortItem] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showCmd, setShowCmd] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [pending, start] = useTransition();

  const query: Query = useMemo(() => {
    const toAtom = (c: Cond): Atom => {
      if (c.op === "between") {
        return range(c.item, Number(c.value), Number(c.value2));
      }
      return {
        kind: "cmp",
        item: c.item,
        op: c.op as CmpOp,
        value: num(c.value),
      };
    };
    const valid = conds.filter(
      (c) => c.item && c.value !== "" && (c.op !== "between" || c.value2 !== ""),
    );
    const forPred =
      valid.length === 0
        ? undefined
        : matchAny
          ? valid.map((c) => [toAtom(c)])
          : [valid.map(toAtom)];
    return {
      verb,
      items: verb === "COUNT" ? [] : columns,
      for: forPred,
      by: sortItem ? { item: sortItem, dir: sortDir } : undefined,
    };
  }, [verb, columns, conds, matchAny, sortItem, sortDir]);

  const sentence = useMemo(() => {
    const verbText =
      verb === "LIST" ? "Show" : verb === "COUNT" ? "Count" : "Summarize";
    const cols =
      verb === "COUNT"
        ? "animals"
        : columns.length
          ? columns.map(labelOf).join(", ")
          : "animals";
    let s = `${verbText} ${cols}`;
    const valid = conds.filter((c) => c.item && c.value !== "");
    if (valid.length) {
      const join = matchAny ? " or " : " and ";
      s +=
        " where " +
        valid
          .map((c) =>
            c.op === "between"
              ? `${labelOf(c.item)} is between ${c.value} and ${c.value2}`
              : `${labelOf(c.item)} ${opLabel(c.op)} ${c.value}`,
          )
          .join(join);
    }
    if (sortItem)
      s += `, sorted by ${labelOf(sortItem)} (${
        sortDir === "asc" ? "lowest" : "highest"
      } first)`;
    return s + ".";
  }, [verb, columns, conds, matchAny, sortItem, sortDir]);

  const toggleCol = (v: string) =>
    setColumns((c) =>
      c.includes(v) ? c.filter((x) => x !== v) : [...c, v],
    );

  const run = () =>
    start(async () => setResult(await runQueryAction(query)));

  return (
    <div className="space-y-5">
      {/* verb */}
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-xs text-muted-foreground">I want to</Label>
        <Select value={verb} onValueChange={(v) => setVerb(v as Verb)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LIST">Show a list</SelectItem>
            <SelectItem value="COUNT">Count</SelectItem>
            <SelectItem value="SUM">Summarize (averages)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* columns */}
      {verb !== "COUNT" && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            {verb === "SUM" ? "Average these" : "Showing these columns"}
          </Label>
          <div className="flex flex-wrap gap-2">
            {ITEMS.map((i) => (
              <button
                key={i.value}
                type="button"
                onClick={() => toggleCol(i.value)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (columns.includes(i.value)
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:bg-muted")
                }
              >
                {i.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* conditions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">
            Only animals where…
          </Label>
          {conds.length > 1 && (
            <button
              type="button"
              onClick={() => setMatchAny((m) => !m)}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              match {matchAny ? "ANY" : "ALL"} of these
            </button>
          )}
        </div>

        {conds.map((c, idx) => (
          <div key={idx} className="flex flex-wrap items-center gap-2">
            <Select
              value={c.item}
              onValueChange={(v) =>
                setConds((cs) =>
                  cs.map((x, i) => (i === idx ? { ...x, item: v } : x)),
                )
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="field" />
              </SelectTrigger>
              <SelectContent>
                {ITEMS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={c.op}
              onValueChange={(v) =>
                setConds((cs) =>
                  cs.map((x, i) => (i === idx ? { ...x, op: v } : x)),
                )
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="is" />
              </SelectTrigger>
              <SelectContent>
                {OPS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="w-28"
              placeholder="value"
              value={c.value}
              onChange={(e) =>
                setConds((cs) =>
                  cs.map((x, i) =>
                    i === idx ? { ...x, value: e.target.value } : x,
                  ),
                )
              }
            />
            {c.op === "between" && (
              <Input
                className="w-28"
                placeholder="and"
                value={c.value2}
                onChange={(e) =>
                  setConds((cs) =>
                    cs.map((x, i) =>
                      i === idx ? { ...x, value2: e.target.value } : x,
                    ),
                  )
                }
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setConds((cs) => cs.filter((_, i) => i !== idx))
              }
            >
              Remove
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setConds((cs) => [
              ...cs,
              { item: "", op: "=", value: "", value2: "" },
            ])
          }
        >
          + Add condition
        </Button>
      </div>

      <Separator />

      {/* sort */}
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-xs text-muted-foreground">Sort by</Label>
        <Select
          value={sortItem || "none"}
          onValueChange={(v) => setSortItem(v === "none" ? "" : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Animal ID (default)</SelectItem>
            {ITEMS.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sortDir}
          onValueChange={(v) => setSortDir(v as "asc" | "desc")}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">lowest first</SelectItem>
            <SelectItem value="desc">highest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* sentence + command */}
      <Card>
        <CardContent className="space-y-2 py-4">
          <p className="text-sm">{sentence}</p>
          <button
            type="button"
            onClick={() => setShowCmd((s) => !s)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {showCmd ? "Hide command" : "Show as command"}
          </button>
          {showCmd && (
            <pre className="overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-xs">
              {serializeCommand(query)}
            </pre>
          )}
        </CardContent>
      </Card>

      <Button onClick={run} disabled={pending}>
        {pending ? "Running…" : "Run"}
      </Button>

      {result && <Results result={result} />}
    </div>
  );
}

function Results({ result }: { result: QueryResponse }) {
  if ("error" in result)
    return (
      <p className="text-sm text-destructive">Error: {result.error}</p>
    );
  if (result.kind === "count")
    return (
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
    );
  if (result.kind === "sum")
    return (
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
    );
  // list
  if (result.rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No animals match. (The herd has no animals yet — intake comes in a
        later step.)
      </p>
    );
  const cols = Object.keys(result.rows[0]);
  return (
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
  );
}
