// Universal CSV — pure, zero-dependency. Any rows → RFC-4180 CSV
// (quote fields containing , " or newline; escape " as ""; null/
// undefined → empty). Used by the Query "Download CSV" and any
// list/record export (data portability).

export type Row = Record<string, unknown>;

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Row[], columns?: string[]): string {
  const cols =
    columns ??
    (rows.length ? Object.keys(rows[0]) : []);
  const head = cols.map(cell).join(",");
  const body = rows.map((r) => cols.map((c) => cell(r[c])).join(","));
  return [head, ...body].join("\r\n");
}
