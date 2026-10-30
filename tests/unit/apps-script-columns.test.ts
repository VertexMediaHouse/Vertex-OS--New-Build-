// ensureColumnsOnSheet() only ever appends headers. If it reordered or rewrote an
// existing one, every data cell below would shift into the wrong column — so these
// pin the exact behaviour against a fake Sheet.
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

function fakeSheet(headerRow: string[], dataRows: string[][] = []) {
  const grid: any[][] = [headerRow, ...dataRows];
  const sheet = {
    getLastRow: () => grid.length,
    getLastColumn: () => Math.max(...grid.map((r) => r.length), 0),
    getRange: (r: number, c: number, _nr: number, nc: number) => ({
      getValues: () => [grid[r - 1]!.slice(c - 1, c - 1 + nc)],
      setValues: (v: any[][]) => {
        grid[r - 1] = v[0]!.slice();
      },
    }),
    clear: () => {
      grid.length = 0;
      grid.push([]);
    },
    setFrozenRows: () => {},
  };
  return { ss: { getSheetByName: () => sheet, insertSheet: () => sheet }, grid };
}

function load() {
  const src = readFileSync(new URL("../../docs/apps-script-upsert-rows.gs", import.meta.url), "utf8");
  return new Function(`${src}; return ensureColumnsOnSheet;`)() as (ss: any, t: string, w: string[]) => string[];
}

test("appends only the missing columns, keeping existing order", () => {
  const fn = load();
  const { ss, grid } = fakeSheet(["name", "id", "createdAt"], [["Acme", "c1", "2026-01-01"]]);
  expect(fn(ss, "client", ["id", "name", "currency", "archivedAt"])).toEqual(["currency", "archivedAt"]);
  expect(grid[0]).toEqual(["name", "id", "createdAt", "currency", "archivedAt"]);
  expect(grid[1]).toEqual(["Acme", "c1", "2026-01-01"]); // data untouched
});

test("already-complete tab is left alone", () => {
  const fn = load();
  const { ss, grid } = fakeSheet(["id", "name"]);
  expect(fn(ss, "tag", ["id", "name"])).toEqual([]);
  expect(grid[0]).toEqual(["id", "name"]);
});

test("trailing padding blanks are not treated as columns", () => {
  const fn = load();
  const { ss, grid } = fakeSheet(["name", "id", "", "", ""]);
  expect(fn(ss, "client", ["status"])).toEqual(["status"]);
  expect(grid[0]).toEqual(["name", "id", "status"]); // blanks dropped, no gap
});

test("placeholder-only tab is replaced by the real shape", () => {
  const fn = load();
  const { ss, grid } = fakeSheet(["id", "_placeholder"]);
  const added = fn(ss, "invoice", ["id", "number", "total"]);
  expect(grid[0]).toEqual(["id", "number", "total"]);
  expect(added).toContain("number");
  expect(grid[0]).not.toContain("_placeholder");
});

test("a populated tab keeps _placeholder rather than shifting its cells", () => {
  const fn = load();
  const { ss, grid } = fakeSheet(["id", "_placeholder"], [["x1", "TRUE"]]);
  fn(ss, "t", ["name"]);
  expect(grid[0]).toEqual(["id", "_placeholder", "name"]);
  expect(grid[1]).toEqual(["x1", "TRUE"]);
});
