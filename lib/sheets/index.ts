// Direct Google Sheets Integration using Web App webhook.
// Provides zero-auth direct reading and writing to Google Sheets.

export function isSheetsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SHEET_WEBAPP_URL);
}

function getUrl(): string {
  const url = process.env.GOOGLE_SHEET_WEBAPP_URL;
  if (!url) {
    throw new Error("GOOGLE_SHEET_WEBAPP_URL is not set in environment");
  }
  return url;
}

/**
 * Serializes row values for Google Sheets (Dates to ISO, objects to JSON).
 */
export function serializeRowForSheet(row: Record<string, any>): Record<string, any> {
  const serialized: Record<string, any> = {};
  for (const [key, val] of Object.entries(row)) {
    if (val instanceof Date) {
      serialized[key] = val.toISOString();
    } else if (val && typeof val === "object" && typeof (val as any).toNumber === "function") {
      // Prisma Decimal
      serialized[key] = (val as any).toNumber();
    } else if (val !== null && typeof val === "object") {
      serialized[key] = JSON.stringify(val);
    } else {
      serialized[key] = val;
    }
  }
  return serialized;
}

/**
 * Fetches all sheets and rows from the Google Sheet.
 */
export async function fetchAllFromSheets(): Promise<Record<string, any[]> | null> {
  if (!isSheetsConfigured()) return null;
  const url = getUrl();

  try {
    const res = await fetch(`${url}?action=getAll`, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "follow",
      // Measured: getAll takes ~18s against the live Apps Script. A 10s budget aborted
      // every attempt, so hydration never latched and every request re-paid the wait.
      // ponytail: fixed budget; cache the payload in KV if the sheet keeps growing.
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      console.warn(`[sheets] fetchAll failed with status ${res.status}`);
      return null;
    }

    const json = (await res.json()) as { ok: boolean; data?: Record<string, any[]>; error?: string };
    if (!json.ok || !json.data) {
      console.warn(`[sheets] fetchAll returned error:`, json.error);
      return null;
    }

    // Dates stay as the raw ISO strings the sheet sends; lib/db/index.ts hydrates them
    // into real Date objects on the way into the store (and double-hydrating a Date
    // turns it into `{}` — it has no enumerable own properties to walk).
    const result: Record<string, any[]> = {};
    for (const [table, rows] of Object.entries(json.data)) {
      if (Array.isArray(rows)) result[table] = rows;
    }

    return result;
  } catch (err) {
    console.error("[sheets] Failed to fetch data from Google Sheets:", err);
    return null;
  }
}

/**
 * Upserts specific rows (by `id`) into a Sheet tab — row-level, not a whole-table
 * overwrite. Two Worker isolates touching different rows of the same table can both
 * sync without one clobbering the other's write (the old `syncTable` sent the whole
 * table every time, so whichever isolate synced last wiped out the other's change).
 */
export async function upsertRowsToSheet(table: string, rows: any[]): Promise<boolean> {
  if (!isSheetsConfigured() || rows.length === 0) return true;
  const url = getUrl();

  try {
    const serializedRows = rows.map(serializeRowForSheet);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsertRows", table, rows: serializedRows }),
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[sheets] upsertRowsToSheet(${table}) failed with status ${res.status}`);
      return false;
    }

    const json = (await res.json()) as { ok: boolean; count?: number; error?: string };
    if (!json.ok) {
      console.warn(`[sheets] upsertRowsToSheet(${table}) error:`, json.error);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[sheets] Error upserting rows for ${table} to Google Sheets:`, err);
    return false;
  }
}

/** Deletes specific rows (by `id`) from a Sheet tab. */
export async function deleteRowsFromSheet(table: string, ids: string[]): Promise<boolean> {
  if (!isSheetsConfigured() || ids.length === 0) return true;
  const url = getUrl();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteRows", table, ids }),
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[sheets] deleteRowsFromSheet(${table}) failed with status ${res.status}`);
      return false;
    }

    const json = (await res.json()) as { ok: boolean; count?: number; error?: string };
    if (!json.ok) {
      console.warn(`[sheets] deleteRowsFromSheet(${table}) error:`, json.error);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[sheets] Error deleting rows for ${table} from Google Sheets:`, err);
    return false;
  }
}

// ───────────────────────────── Debounced Sync Queue ─────────────────────────────

/**
 * On Cloudflare Workers the isolate can be torn down the instant the response is
 * sent — a bare setTimeout() scheduled here is not guaranteed to ever fire. Workers'
 * ctx.waitUntil() keeps the isolate alive until the promise passed to it settles, so
 * server/app.ts registers the current request's waitUntil here before any route runs.
 * The Node server (npm run start) never calls this, and setTimeout there is fine
 * because the process stays up.
 */
let currentWaitUntil: ((p: Promise<unknown>) => void) | null = null;
export function setWaitUntil(fn: ((p: Promise<unknown>) => void) | null) {
  currentWaitUntil = fn;
}

/** Rows (and deletes) still waiting to go out for a table, keyed by id so repeat edits to the same row before the sync fires collapse into one. */
type Pending = { upserts: Map<string, any>; deletes: Set<string> };
const pendingByTable = new Map<string, Pending>();
const syncTimers = new Map<string, NodeJS.Timeout>();
const inFlightSyncs = new Set<string>();

function pendingFor(table: string): Pending {
  let p = pendingByTable.get(table);
  if (!p) {
    p = { upserts: new Map(), deletes: new Set() };
    pendingByTable.set(table, p);
  }
  return p;
}

async function runSync(table: string) {
  // A sync for this table is already draining the queue — rows added meanwhile stay in
  // `pending` and that run picks them up in its own next loop iteration below, so this
  // call can return without losing them (returning here must never silently drop rows).
  if (inFlightSyncs.has(table)) return;
  inFlightSyncs.add(table);
  try {
    // Loop instead of a single pass: more rows can be queued (by other work in this same
    // request, via waitUntil) while this fetch is in flight — drain until truly empty.
    let pending = pendingByTable.get(table);
    while (pending && (pending.upserts.size > 0 || pending.deletes.size > 0)) {
      const upserts = [...pending.upserts.values()];
      const deletes = [...pending.deletes];
      pending.upserts.clear();
      pending.deletes.clear();
      const [upOk, delOk] = await Promise.all([upsertRowsToSheet(table, upserts), deleteRowsFromSheet(table, deletes)]);
      if (upOk && delOk) console.log(`[sheets] Synced '${table}': ${upserts.length} upserted, ${deletes.length} deleted`);
      pending = pendingByTable.get(table);
    }
  } catch (e) {
    console.error(`[sheets] Background sync failed for '${table}':`, e);
  } finally {
    inFlightSyncs.delete(table);
  }
}

/**
 * Queues specific rows for a background upsert to their Sheet tab (row-level, not a
 * whole-table dump — see upsertRowsToSheet). The mutation in the local memory database
 * completes immediately (0ms latency); the Sheet tab updates async. With a waitUntil
 * registered (Workers), syncs immediately and is kept alive past the response.
 * Otherwise (Node), debounces on a timer since the process stays running.
 */
export function scheduleTableSync(table: string, rows: any[], delayMs = 1500) {
  if (!isSheetsConfigured() || rows.length === 0) return;
  const pending = pendingFor(table);
  for (const row of rows) pending.upserts.set(row.id, row);
  flush(table, delayMs);
}

/** Queues specific row ids for background deletion from their Sheet tab. */
export function scheduleTableDelete(table: string, ids: string[], delayMs = 1500) {
  if (!isSheetsConfigured() || ids.length === 0) return;
  const pending = pendingFor(table);
  for (const id of ids) {
    pending.upserts.delete(id);
    pending.deletes.add(id);
  }
  flush(table, delayMs);
}

function flush(table: string, delayMs: number) {
  if (currentWaitUntil) {
    currentWaitUntil(runSync(table));
    return;
  }
  const existingTimer = syncTimers.get(table);
  if (existingTimer) clearTimeout(existingTimer);
  const timer = setTimeout(() => {
    syncTimers.delete(table);
    void runSync(table);
  }, delayMs);
  syncTimers.set(table, timer);
}
