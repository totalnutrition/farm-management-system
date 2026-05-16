"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Query } from "@/lib/derive/query";
import { deleteView, runView } from "./actions";

export type ViewRow = {
  id: string;
  name: string;
  description: string | null;
  command: string;
  query: Query;
};

export function ViewsTable({ rows }: { rows: ViewRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Record<string, string>>({});

  const run = (r: ViewRow) =>
    start(async () => {
      const res = await runView(r.query);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const summary =
        res.kind === "count"
          ? `${res.count} animal(s)`
          : res.kind === "sum"
            ? `${res.sum.count} animal(s) summarized`
            : `${res.rows.length} row(s)`;
      setResult((m) => ({ ...m, [r.id]: summary }));
      toast.success(`${r.name}: ${summary}`);
    });

  const remove = (r: ViewRow) =>
    start(async () => {
      const res = await deleteView(r.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Deleted “${r.name}”.`);
      router.refresh();
    });

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="font-medium">{r.name}</p>
              {r.description ? (
                <p className="text-xs text-muted-foreground">
                  {r.description}
                </p>
              ) : null}
              <pre className="mt-1 overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-xs">
                {r.command}
              </pre>
              {result[r.id] ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Last run: {result[r.id]}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => run(r)}
                disabled={pending}
              >
                Run
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove(r)}
                disabled={pending}
              >
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
