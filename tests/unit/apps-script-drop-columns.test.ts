// dropColumnsOnSheet() deletes cells, so these pin the two things that would corrupt
// the sheet: rows must stay aligned with headers, and a row with real content in any
// surviving column must never be removed.
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

function fakeSheet(grid: string[][]) {
  const g = grid.map((r) => r.slice());
  const sheet = {
    getLastRow: () => g.length,
    getLastColumn: () => Math.max(...g.map((r) => r.length), 0),
    getRange: (r: number, c: number, nr: number, nc: number) => ({
      getValues: () => g.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc)),
    }),
    deleteRow: (r: number) => g.splice(r - 1, 1),
    deleteColumns: (c: number, n: number) => g.forEach((row) => row.splice(c - 1, n)),
  };
  return { ss: { getSheetByName: () => sheet }, g };
}

function load() {
  const src = readFileSync(new URL("../../docs/apps-script-upsert-rows.gs", import.meta.url), "utf8");
  return new Function(`${src}; return dropColumnsOnSheet;`)() as (ss: any, t: string, d: string[]) => string[];
}

test("removes the column and keeps every surviving cell under its own header", () => {
  const fn = load();
  const { ss, g } = fakeSheet([
    ["id", "_placeholder", "name", "status"],
    ["l1", "", "Acme", "NEW"],
    ["l2", "", "Beta", "WON"],
  ]);
  expect(fn(ss, "lead", ["_placeholder"])).toEqual(["_placeholder"]);
  expect(g[0]).toEqual(["id", "name", "status"]);
  expect(g[1]).toEqual(["l1", "Acme", "NEW"]); // not shifted
  expect(g[2]).toEqual(["l2", "Beta", "WON"]);
});

test("a marker-only row is removed, real rows are kept", () => {
  const fn = load();
  const { ss, g } = fakeSheet([
    ["id", "_placeholder", "name"],
    ["", "TRUE", ""],          // the placeholder row: nothing else in it
    ["c1", "", "Real Client"], // must survive
  ]);
  fn(ss, "t", ["_placeholder"]);
  expect(g).toEqual([["id", "name"], ["c1", "Real Client"]]);
});

test("dropping several columns at once stays aligned", () => {
  const fn = load();
  const { ss, g } = fakeSheet([
    ["a", "junk1", "b", "junk2", "c"],
    ["1", "x", "2", "y", "3"],
  ]);
  expect(fn(ss, "t", ["junk1", "junk2"]).sort()).toEqual(["junk1", "junk2"]);
  expect(g[0]).toEqual(["a", "b", "c"]);
  expect(g[1]).toEqual(["1", "2", "3"]);
});

test("absent column is a no-op", () => {
  const fn = load();
  const { ss, g } = fakeSheet([["id", "name"], ["x", "y"]]);
  expect(fn(ss, "t", ["_placeholder"])).toEqual([]);
  expect(g).toEqual([["id", "name"], ["x", "y"]]);
});

test("header-only tab loses the column without error", () => {
  const fn = load();
  const { ss, g } = fakeSheet([["id", "_placeholder"]]);
  expect(fn(ss, "t", ["_placeholder"])).toEqual(["_placeholder"]);
  expect(g).toEqual([["id"]]);
});
