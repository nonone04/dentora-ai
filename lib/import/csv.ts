/**
 * Minimal RFC 4180-ish CSV parser: quoted fields, embedded commas/newlines
 * inside quotes, and "" as an escaped quote. No external dependency --
 * this is the only CSV shape the import wizard needs to round-trip
 * (Excel/Sheets/Numbers all export this dialect).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const source = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export type CsvTable = {
  headers: string[];
  rows: string[][];
};

/** Splits parsed rows into a header row + data rows, trimming header cells. */
export function toCsvTable(rows: string[][]): CsvTable {
  const [headerRow, ...rest] = rows;
  return {
    headers: (headerRow ?? []).map((h) => h.trim()),
    rows: rest,
  };
}

/** Serializes rows back to CSV text, quoting any field that needs it. */
export function toCsvText(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(","),
    )
    .join("\n");
}
