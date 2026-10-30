// Reads now go through the CSV export endpoint (lib/sheets/csv.ts): ~0.6s for the
// tabs a page needs. The Apps Script getAll remains only as a fallback and measured
// 16.0s for 149 rows across 45 tabs, so its budget must still clear that — a smaller
// one aborted every attempt and hydration never latched.
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

function timeoutIn(src: string, fnName: string, until: string) {
  const start = src.indexOf(fnName);
  expect(start, `${fnName} not found`).toBeGreaterThan(-1);
  const end = src.indexOf(until, start);
  const body = src.slice(start, end === -1 ? undefined : end);
  return Number(/AbortSignal\.timeout\((\d[\d_]*)\)/.exec(body)![1]!.replace(/_/g, ""));
}

test("Apps Script fallback read still outlasts its measured 16s latency", () => {
  const src = readFileSync(new URL("../../lib/sheets/index.ts", import.meta.url), "utf8");
  expect(timeoutIn(src, "export async function fetchAllFromSheets", "export async function upsertRowsToSheet")).toBeGreaterThan(20_000);
});

test("CSV read budget is short — a hung tab must not stall the batch", () => {
  const src = readFileSync(new URL("../../lib/sheets/csv.ts", import.meta.url), "utf8");
  const ms = timeoutIn(src, "export async function fetchTableCsv", "export async function fetchTablesCsv");
  expect(ms).toBeGreaterThanOrEqual(5_000); // tolerate a slow tab
  expect(ms).toBeLessThan(20_000); // but never the old 16s-class wait
});
