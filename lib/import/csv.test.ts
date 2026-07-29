import { describe, expect, it } from "vitest";
import { parseCsv, toCsvTable, toCsvText } from "@/lib/import/csv";

describe("parseCsv", () => {
  it("parses a simple comma-separated table", () => {
    const rows = parseCsv("name,phone\nSara,0600000000\nYassine,0600000001");
    expect(rows).toEqual([
      ["name", "phone"],
      ["Sara", "0600000000"],
      ["Yassine", "0600000001"],
    ]);
  });

  it("handles quoted fields containing commas", () => {
    const rows = parseCsv('name,notes\n"Dupont, Marie","likes evening slots"');
    expect(rows).toEqual([
      ["name", "notes"],
      ["Dupont, Marie", "likes evening slots"],
    ]);
  });

  it("handles escaped double quotes inside quoted fields", () => {
    const rows = parseCsv('name,notes\nSara,"She said ""call me back"""');
    expect(rows).toEqual([
      ["name", "notes"],
      ["Sara", 'She said "call me back"'],
    ]);
  });

  it("handles embedded newlines inside quoted fields", () => {
    const rows = parseCsv('name,notes\nSara,"line one\nline two"');
    expect(rows).toEqual([
      ["name", "notes"],
      ["Sara", "line one\nline two"],
    ]);
  });

  it("normalizes CRLF line endings", () => {
    const rows = parseCsv("name,phone\r\nSara,0600000000\r\n");
    expect(rows).toEqual([
      ["name", "phone"],
      ["Sara", "0600000000"],
    ]);
  });

  it("ignores a trailing blank line", () => {
    const rows = parseCsv("name,phone\nSara,0600000000\n\n");
    expect(rows).toEqual([
      ["name", "phone"],
      ["Sara", "0600000000"],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("toCsvTable", () => {
  it("splits headers from data rows and trims header whitespace", () => {
    const table = toCsvTable([
      [" name ", " phone"],
      ["Sara", "0600000000"],
    ]);
    expect(table.headers).toEqual(["name", "phone"]);
    expect(table.rows).toEqual([["Sara", "0600000000"]]);
  });

  it("produces an empty header list for an empty table", () => {
    const table = toCsvTable([]);
    expect(table.headers).toEqual([]);
    expect(table.rows).toEqual([]);
  });
});

describe("toCsvText", () => {
  it("round-trips through parseCsv", () => {
    const original = [
      ["name", "notes"],
      ["Dupont, Marie", 'She said "hi"'],
    ];
    const text = toCsvText(original);
    expect(parseCsv(text)).toEqual(original);
  });

  it("leaves plain fields unquoted", () => {
    expect(toCsvText([["Sara", "0600000000"]])).toBe("Sara,0600000000");
  });
});
