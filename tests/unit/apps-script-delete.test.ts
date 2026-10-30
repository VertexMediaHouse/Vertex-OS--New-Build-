// Exercises deleteRowsFromSheet() from the real .gs source against a fake Sheet, so
// the contiguous-block batching can't silently delete the wrong rows.
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

/** Minimal SpreadsheetApp stand-in: one tab, `id` in column A. */
function fakeSheet(ids: string[]) {
  const rows = [["id"], ...ids.map((i) => [i])];
  const calls: Array<[number, number]> = [];
  const sheet = {
    getLastRow: () => rows.length,
    getLastColumn: () => 1,
    getRange: (r: number, c: number, nr: number, _nc: number) => ({
      getValues: () => rows.slice(r - 1, r - 1 + nr).map((x) => [x[c - 1]]),
    }),
    deleteRows: (start: number, n: number) => {
      calls.push([start, n]);
      rows.splice(start - 1, n);
    },
  };
  return { ss: { getSheetByName: () => sheet }, rows, calls };
}

function loadFn() {
  const src = readFileSync(new URL("../../docs/apps-script-upsert-rows.gs", import.meta.url), "utf8");
  return new Function(`${src}; return deleteRowsFromSheet;`)() as (ss: any, t: string, ids: string[]) => number;
}

test("deletes a contiguous run in one call", () => {
  const del = loadFn();
  const { ss, rows, calls } = fakeSheet(["a", "b", "c", "d"]);
  expect(del(ss, "t", ["b", "c"])).toBe(2);
  expect(rows.slice(1).flat()).toEqual(["a", "d"]);
  expect(calls).toEqual([[3, 2]]); // rows 3-4 as a single block
});

test("non-adjacent rows become separate calls, bottom-up", () => {
  const del = loadFn();
  const { ss, rows, calls } = fakeSheet(["a", "b", "c", "d", "e"]);
  expect(del(ss, "t", ["b", "d"])).toBe(2);
  expect(rows.slice(1).flat()).toEqual(["a", "c", "e"]);
  expect(calls).toEqual([[5, 1], [3, 1]]); // bottom-up keeps indices valid
});

test("deleting every row leaves the header", () => {
  const del = loadFn();
  const { ss, rows } = fakeSheet(["a", "b", "c"]);
  expect(del(ss, "t", ["a", "b", "c"])).toBe(3);
  expect(rows).toEqual([["id"]]);
});

test("unknown ids delete nothing", () => {
  const del = loadFn();
  const { ss, rows, calls } = fakeSheet(["a", "b"]);
  expect(del(ss, "t", ["zz"])).toBe(0);
  expect(rows.slice(1).flat()).toEqual(["a", "b"]);
  expect(calls).toEqual([]);
});

test("first and last row together", () => {
  const del = loadFn();
  const { ss, rows } = fakeSheet(["a", "b", "c"]);
  expect(del(ss, "t", ["a", "c"])).toBe(2);
  expect(rows.slice(1).flat()).toEqual(["b"]);
});
