// Brings every Sheet tab up to the full row shape the app writes.
//
// A tab only grows a column when some write happens to carry that field, so tabs for
// features nobody has used yet (invoices, goals, time entries) sit at a bare
// `id`/`_placeholder` header. Reads then return those fields as null/[] — fine for the
// app, but the sheet is also something people open and read, and a tab with one column
// tells them nothing.
//
// Appends missing headers only: existing columns keep their positions and no data cell
// is touched (see ensureColumnsOnSheet in docs/apps-script-upsert-rows.gs).
//
// Usage:  node scripts/ensure-sheet-columns.mjs [--dry]
import { SCHEMA } from "../lib/db/schema.ts";

const url = process.env.GOOGLE_SHEET_WEBAPP_URL;
const sheetId = process.env.GOOGLE_SHEET_ID;
if (!url) {
  console.error("GOOGLE_SHEET_WEBAPP_URL is not set — writes go through the Apps Script web app.");
  process.exit(1);
}
const dry = process.argv.includes("--dry");

/** Current header row of a tab, via the CSV endpoint (fast, read-only). */
async function headersOf(tab) {
  if (!sheetId) return null;
  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`,
  );
  if (!res.ok) return null;
  const first = (await res.text()).split(/\r?\n/)[0] ?? "";
  return [...first.matchAll(/"([^"]*)"/g)].map((m) => m[1]).filter((h) => h !== "");
}

const tables = Object.keys(SCHEMA);
const plan = {};
let total = 0;

// Batched so the CSV endpoint isn't hit with 41 parallel requests (it throttles).
for (let i = 0; i < tables.length; i += 12) {
  const batch = tables.slice(i, i + 12);
  const got = await Promise.all(batch.map(async (t) => [t, await headersOf(t)]));
  for (const [tab, have] of got) {
    const want = Object.keys(SCHEMA[tab]);
    // A tab we couldn't read gets the full shape; ensureColumns is a no-op per column
    // that already exists, so this is safe.
    const missing = have === null ? want : want.filter((c) => !have.includes(c));
    if (missing.length) {
      plan[tab] = want; // send the full list; the script adds only what's absent
      total += missing.length;
      console.log(`${tab.padEnd(20)} +${String(missing.length).padStart(2)}  ${missing.join(", ")}`);
    }
  }
}

if (total === 0) {
  console.log("Every tab already has the full column set.");
  process.exit(0);
}
console.log(`\n${total} columns missing across ${Object.keys(plan).length} tabs.`);

if (dry) {
  console.log("--dry: nothing written.");
  process.exit(0);
}

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "ensureColumns", tables: plan }),
  redirect: "follow",
  signal: AbortSignal.timeout(120_000),
});
const json = await res.json();
if (!json.ok) {
  console.error("Failed:", json.error ?? `HTTP ${res.status}`);
  if (/Unknown action/.test(json.error ?? "")) {
    console.error("The deployed Apps Script predates `ensureColumns` — redeploy docs/apps-script-upsert-rows.gs.");
  }
  process.exit(1);
}
const added = Object.entries(json.added ?? {}).filter(([, v]) => v.length);
console.log(`\nAdded ${added.reduce((n, [, v]) => n + v.length, 0)} columns:`);
for (const [tab, cols] of added) console.log(`  ${tab.padEnd(20)} ${cols.join(", ")}`);
