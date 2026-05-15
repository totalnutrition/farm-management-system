"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { EVENT_LABEL, EVENT_TYPES, type EventType } from "@/lib/herd";
import { cowPath } from "@/lib/misc";
import { bulkAddEvent } from "./actions";

export type PopRow = {
  tag: string;
  name: string | null;
  pen: string | null;
  lact: number;
  repro: string;
  dim: number | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PopulationTable({
  listKey,
  rows,
  defaultAction,
}: {
  listKey: string;
  rows: PopRow[];
  defaultAction: EventType | null;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [type, setType] = useState<EventType>(defaultAction ?? "note");
  const [date, setDate] = useState(today());
  const [isPending, startTransition] = useTransition();

  const allOn = rows.length > 0 && sel.size === rows.length;
  const toggleAll = () =>
    setSel(allOn ? new Set() : new Set(rows.map((r) => r.tag)));
  const toggle = (tag: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  const apply = () => {
    const tags = [...sel];
    if (tags.length === 0) {
      toast.error("Select at least one cow.");
      return;
    }
    startTransition(async () => {
      const result = await bulkAddEvent({
        listKey,
        tags,
        event_type: type,
        event_date: date,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Recorded ${EVENT_LABEL[type]} for ${result.count} cows.`);
      setSel(new Set());
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 p-3 ring-1 ring-foreground/10">
        <span className="text-xs text-muted-foreground">
          {sel.size} selected
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={type} onValueChange={(v) => setType(v as EventType)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.filter((t) => t !== "correction").map((t) => (
                <SelectItem key={t} value={t}>
                  {EVENT_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
          <Button
            type="button"
            disabled={isPending || sel.size === 0}
            onClick={apply}
          >
            {isPending ? "Recording..." : `Apply to ${sel.size}`}
          </Button>
        </div>
      </div>

      <div className="ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Tag</TableHead>
              <TableHead>Pen</TableHead>
              <TableHead>Lact</TableHead>
              <TableHead>Repro</TableHead>
              <TableHead>DIM</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  No cows in this population.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.tag}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={sel.has(r.tag)}
                      onChange={() => toggle(r.tag)}
                      aria-label={`Select ${r.tag}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={cowPath(r.tag)}
                      className="font-mono underline-offset-2 hover:underline"
                    >
                      {r.tag}
                    </Link>
                    {r.name ? (
                      <span className="ml-2 text-muted-foreground">
                        {r.name}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{r.pen ?? "—"}</TableCell>
                  <TableCell>{r.lact}</TableCell>
                  <TableCell className="uppercase">{r.repro}</TableCell>
                  <TableCell className="font-mono">
                    {r.dim === null ? "—" : r.dim}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
