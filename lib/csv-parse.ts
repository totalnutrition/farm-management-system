// CSV parse — pure, zero-dependency, RFC-4180. Handles quoted fields
// with commas/newlines, escaped "" quotes, CRLF or LF. Returns header
// list + row objects keyed by header. Used by bulk import.

export type Parsed = { headers: string[]; rows: Record<string, string>[] };

export function parseCsv(text: string): Parsed {
  const t = text.replace(/^﻿/, ""); // strip BOM
  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    records.push(row);
    row = [];
  };

  while (i < t.length) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      endField();
      i++;
      continue;
    }
    if (c === "\r") {
      if (t[i + 1] === "\n") i++;
      endRow();
      i++;
      continue;
    }
    if (c === "\n") {
      endRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // trailing field/row (unless the text ended exactly on a newline)
  if (field !== "" || row.length > 0) endRow();

  const nonEmpty = records.filter(
    (r) => !(r.length === 1 && r[0].trim() === ""),
  );
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((h) => h.trim());
  const rows = nonEmpty.slice(1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, idx) => {
      o[h] = (r[idx] ?? "").trim();
    });
    return o;
  });
  return { headers, rows };
}
