// The live Apps Script getAll measured ~18s. A read budget at or below that aborted
// every attempt, so hydration never latched and the shell never loaded.
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("sheets read timeout exceeds the measured Apps Script latency", () => {
  const src = readFileSync(new URL("../../lib/sheets/index.ts", import.meta.url), "utf8");
  const start = src.indexOf("export async function fetchAllFromSheets");
  const read = src.slice(start, src.indexOf("export async function upsertRowsToSheet", start));
  const ms = Number(/AbortSignal\.timeout\((\d[\d_]*)\)/.exec(read)![1]!.replace(/_/g, ""));
  expect(ms).toBeGreaterThan(20_000);
});
