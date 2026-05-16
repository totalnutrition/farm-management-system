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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  serializeCommand,
  parseCommand,
  type Query,
} from "@/lib/derive/query";
import {
  ConditionBuilder,
  condsToPredicate,
  describeConds,
  labelOf,
  ITEMS,
  type ConditionValue,
} from "@/components/condition-builder";
import { runQueryAction, type QueryResponse } from "./actions";
import { saveView } from "../views/actions";
import { toast } from "sonner";

type Verb = "LIST" | "COUNT" | "SUM";

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
  const [viewName, setViewName] = useState("");
  const [pending, start] = useTransition();
  const [saving, startSave] = useTransition();
  const [mode, setMode] = useState<"builder" | "command">("builder");
  const [cmdText, setCmdText] = useState("");

  const query: Query = useMemo(
    () => ({
      verb,
      items: verb === "COUNT" ? [] : columns,
      for: condsToPredicate(cond),
      by: sortItem ? { item: sortItem, dir: sortDir } : undefined,
    }),
    [verb, columns, cond, sortItem, sortDir],
  );

  const sentence = useMemo(() => {
    const verbText =
      verb === "LIST" ? "Show" : verb === "COUNT" ? "Count" : "Summarize";
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
  }, [verb, columns, cond, sortItem, sortDir]);

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
      setResult(await runQueryAction(effective.query));
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
              </SelectContent>
            </Select>

            {verb !== "COUNT" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs font-normal"
                  >
                    {columns.length
                      ? `${verb === "SUM" ? "Averaging" : "Columns"} · ${columns.length}`
                      : verb === "SUM"
                        ? "Pick columns"
                        : "Columns"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="max-h-72 overflow-y-auto"
                >
                  <DropdownMenuLabel className="text-xs">
                    {verb === "SUM" ? "Average these" : "Columns to show"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ITEMS.filter((i) => i.value !== "PEN" || verb !== "SUM").map(
                    (i) => (
                      <DropdownMenuCheckboxItem
                        key={i.value}
                        checked={columns.includes(i.value)}
                        onCheckedChange={() => toggleCol(i.value)}
                        onSelect={(e) => e.preventDefault()}
                        className="text-xs"
                      >
                        {i.label}
                      </DropdownMenuCheckboxItem>
                    ),
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <ConditionBuilder value={cond} onChange={setCond} />

            <span className="text-xs text-muted-foreground">sort</span>
            <Select
              value={sortItem || "none"}
              onValueChange={(v) => setSortItem(v === "none" ? "" : v)}
            >
              <SelectTrigger className="h-7 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Animal ID</SelectItem>
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

function Results({ result }: { result: QueryResponse }) {
  if ("error" in result)
    return <p className="text-sm text-destructive">Error: {result.error}</p>;
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
