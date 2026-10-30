// Removes the `_placeholder` column from every tab that still carries it.
//
// `_placeholder` was the marker an empty tab used before it had real columns. Now that
// every tab has its full header set (scripts/ensure-sheet-columns.mjs), the marker is
// dead weight sitting in column B, ahead of the real data.
//
// Rows that existed only to carry the marker are removed with it. A row with content in
// any surviving column is never touched — see dropColumnsOnSheet in
// docs/apps-script-upsert-rows.gs, which also keeps cells aligned with their headers.
//
// Usage:  node scripts/drop-placeholder-column.mjs [--dry]
import { SCHEMA } from "../lib/db/schema.ts";

const MARKER = "_placeholder";
const url = process.env.GOOGLE_SHEET_WEBAPP_URL;
const sheetId = process.env.GOOGLE_SHEET_ID;
if (!url) {
  console.error("GOOGLE_SHEET_WEBAPP_URL is not set — writes go through the Apps Script web app.");
  process.exit(1);
}
if (!sheetId) {
  console.error("GOOGLE_SHEET_ID is not set — needed to read which tabs still have the column.");
  process.exit(1);
}
const dry = process.argv.includes("--dry");

async function inspect(tab) {
  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`,
  );
  if (!res.ok) return null;
  const lines = (await res.text()).split(/\r?\n/).filter((l) => l.trim() !== "");
  const cells = (l) => [...l.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  const header = cells(lines[0] ?? "");
  const at = header.indexOf(MARKER);
  if (at === -1) return { has: false };
  // Rows that still hold something outside the marker column — these must survive.
  const keep = lines.slice(1).filter((l) => cells(l).some((c, i) => i !== at && c.trim() !== ""));
  return { has: true, at, dataRows: lines.length - 1, keep: keep.length };
}

// "Sheet1" is a leftover tab the app never reads, but clean it too if it has the marker.
const tabs = [...Object.keys(SCHEMA), "Sheet1"];
const plan = {};
for (let i = 0; i < tabs.length; i += 12) {
  const got = await Promise.all(tabs.slice(i, i + 12).map(async (t) => [t, await inspect(t)]));
  for (const [tab, info] of got) {
    if (!info?.has) continue;
    plan[tab] = [MARKER];
    const drops = info.dataRows - info.keep;
    console.log(`${tab.padEnd(18)} col ${info.at}  keeps ${info.keep} row(s)${drops ? `, clears ${drops} marker row(s)` : ""}`);
  }
}

const count = Object.keys(plan).length;
if (count === 0) {
  console.log(`No tab carries a ${MARKER} column.`);
  process.exit(0);
}
console.log(`\n${count} tabs to clean.`);
if (dry) {
  console.log("--dry: nothing written.");
  process.exit(0);
}

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "dropColumns", tables: plan }),
  redirect: "follow",
  signal: AbortSignal.timeout(120_000),
});
const json = await res.json();
if (!json.ok) {
  console.error("Failed:", json.error ?? `HTTP ${res.status}`);
  if (/Unknown action/.test(json.error ?? "")) {
    console.error("The deployed Apps Script predates `dropColumns` — redeploy docs/apps-script-upsert-rows.gs.");
  }
  process.exit(1);
}
const done = Object.entries(json.dropped ?? {}).filter(([, v]) => v.length);
console.log(`Cleaned ${done.length} tabs: ${done.map(([t]) => t).join(", ")}`);
