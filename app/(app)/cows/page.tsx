import Link from "next/link";
import { requireUser } from "@/lib/supabase-auth";
import { loadHerd } from "@/lib/herd-data";
import { daysInMilk } from "@/lib/herd";
import { cowPath } from "@/lib/misc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cows" };

export default async function CowsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q } = await searchParams;
  const { animals } = await loadHerd();
  const needle = (q ?? "").trim().toLowerCase();
  const rows = needle
    ? animals.filter(
        (a) =>
          a.tag.toLowerCase().includes(needle) ||
          (a.name ?? "").toLowerCase().includes(needle),
      )
    : animals;

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Cows</h1>
        <p className="text-xs text-muted-foreground">
          {rows.length} of {animals.length} animals
        </p>
      </header>
      <form className="flex gap-2" action="/cows">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search tag or name…"
          className="h-9 w-full max-w-xs border border-input bg-transparent px-3 text-sm"
          autoComplete="off"
        />
      </form>
      <div className="ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
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
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  No animals.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((a) => {
                const dim = daysInMilk(a);
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link
                        href={cowPath(a.tag)}
                        className="font-mono underline-offset-2 hover:underline"
                      >
                        {a.tag}
                      </Link>
                      {a.name ? (
                        <span className="ml-2 text-muted-foreground">
                          {a.name}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{a.current_pen ?? "—"}</TableCell>
                    <TableCell>{a.lactation_number}</TableCell>
                    <TableCell className="uppercase">
                      {a.repro_status}
                    </TableCell>
                    <TableCell className="font-mono">
                      {dim === null ? "—" : dim}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
