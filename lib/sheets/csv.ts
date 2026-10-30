// Fast reads straight from Google Sheets' CSV export endpoint.
//
// Why this exists: the Apps Script `getAll` measured 16.0s for 149 rows across 45
// tabs — ~350ms of per-tab RPC overhead, independent of data size. The CSV endpoint
// is served from Google's edge, so one tab lands in ~0.45s and a page's worth
// (4 tabs, fetched in parallel) in ~0.67s.
//
// Measured on the live sheet:
//   1 tab  0.45s  |  4 tabs parallel 0.67s  |  all 44 parallel 8.96s
// The all-44 number is Google throttling concurrency — that's why callers read the
// tabs a page needs, on demand, instead of slurping the workbook.
//
// Read-only by design: there is no CSV write path. Writes stay on Apps Script
// (upsertRows/deleteRows in ./index.ts), which is row-level and doesn't pay the
// 45-tab penalty.

/** Requires the sheet to be link-viewable ("Anyone with the link can view"). */
export function isCsvConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SHEET_ID);
}

function sheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID is not set in environment");
  return id;
}

/**
 * Parses a CSV body into row objects keyed by the header row.
 *
 * Headers are kept verbatim: the store's columns are camelCase (`companyId`,
 * `lastActivityAt`) and lib/db matches ~32 date fields by exact name, so
 * lowercasing them would silently blank every date and foreign key.
 *
 * Values stay strings; lib/db's hydrateDates() turns ISO timestamps into Dates and
 * parses the JSON-stringified arrays/objects (`tags`, `steps`, `settings`).
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch; // includes newlines inside quotes (campaign bodies, notes)
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c !== "")) rows.push(row);

  if (rows.length < 2) return [];

  // Trailing blank headers are real: the sheet has padding columns ("","","").
  // Dropping them keeps junk keys like "" off every row object.
  const headers = rows[0]!.map((h) => h.trim());
  const width = headers.reduce((last, h, i) => (h !== "" ? i + 1 : last), 0);

  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < width; i++) {
      const key = headers[i];
      if (key) obj[key] = (r[i] ?? "").trim();
    }
    return obj;
  });
}

/** Fetches one tab by name. Returns null so callers can fall back rather than crash. */
export async function fetchTableCsv(table: string): Promise<Record<string, string>[] | null> {
  if (!isCsvConfigured()) return null;
  // gviz/tq addresses a tab by name, so no gid lookup is needed.
  const url = `https://docs.google.com/spreadsheets/d/${sheetId()}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(table)}`;

  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.warn(`[csv] ${table} failed with status ${res.status}`);
      return null;
    }
    // A private sheet answers with an HTML sign-in page under a 200, so trust the
    // content type rather than the status code.
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("csv")) {
      console.warn(`[csv] ${table} returned ${type}, not CSV — is the sheet link-viewable?`);
      return null;
    }
    // `_placeholder` rows are the sheet's own empty-tab markers, not data.
    return parseCsv(await res.text()).filter((r) => !r._placeholder);
  } catch (err) {
    console.error(`[csv] Error fetching ${table}:`, err);
    return null;
  }
}

/**
 * Fetches several tabs, at most `limit` at a time.
 *
 * The pool matters: an unbounded Promise.all over all 44 tabs took ~9s and timed
 * some out, while a pool gets every tab back. Measured on the live sheet —
 * limit 4: 5.98s, 6: 4.26s, 10: 2.80s, 16: 1.94s, 24: 1.97s (all 44/44). It
 * plateaus at 16, so that's the default. One page's 4 tabs land in ~0.69s.
 *
 * Always resolves. A tab that fails is simply absent from the result, so the caller
 * merges what did arrive instead of losing the batch (lib/db treats a missing table
 * as "no update for this table", which is the right behaviour here).
 */
export async function fetchTablesCsv(tables: string[], limit = 16): Promise<Record<string, any[]>> {
  const out: Record<string, any[]> = {};
  const queue = [...tables];

  const worker = async () => {
    for (let t = queue.shift(); t !== undefined; t = queue.shift()) {
      try {
        const rows = await fetchTableCsv(t);
        if (rows) out[t] = rows;
      } catch (err) {
        // fetchTableCsv already catches its own failures; this guards the stray
        // AbortSignal.timeout rejection so one slow tab can't reject the batch.
        console.warn(`[csv] ${t} failed:`, err);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, tables.length) }, worker));
  return out;
}
