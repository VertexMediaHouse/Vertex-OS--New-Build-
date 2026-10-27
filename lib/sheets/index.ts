// Direct Google Sheets Integration using Web App webhook.
// Provides zero-auth direct reading and writing to Google Sheets.

const SCRIPT_URL = process.env.GOOGLE_SHEET_WEBAPP_URL;

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
 * Hydrates date strings back into JavaScript Date objects.
 */
export function hydrateDates(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d;
    }
    return val;
  }
  if (Array.isArray(val)) return val.map(hydrateDates);
  if (typeof val === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = hydrateDates(v);
    }
    return out;
  }
  return val;
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

    // Hydrate dates for all rows
    const result: Record<string, any[]> = {};
    for (const [table, rows] of Object.entries(json.data)) {
      if (Array.isArray(rows)) {
        result[table] = rows.map(hydrateDates);
      }
    }

    return result;
  } catch (err) {
    console.error("[sheets] Failed to fetch data from Google Sheets:", err);
    return null;
  }
}

/**
 * Syncs a single table's rows directly to its Google Sheet tab.
 */
export async function syncTableToSheet(table: string, rows: any[]): Promise<boolean> {
  if (!isSheetsConfigured()) return false;
  const url = getUrl();

  try {
    const serializedRows = rows.map(serializeRowForSheet);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "syncTable",
        table,
        rows: serializedRows,
      }),
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(`[sheets] syncTableToSheet(${table}) failed with status ${res.status}`);
      return false;
    }

    const json = (await res.json()) as { ok: boolean; count?: number; error?: string };
    if (!json.ok) {
      console.warn(`[sheets] syncTableToSheet(${table}) error:`, json.error);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[sheets] Error syncing table ${table} to Google Sheets:`, err);
    return false;
  }
}

// ───────────────────────────── Debounced Sync Queue ─────────────────────────────

const syncTimers = new Map<string, NodeJS.Timeout>();
const inFlightSyncs = new Set<string>();

/**
 * Schedules a debounced background sync of a table to Google Sheets.
 * The mutation in the local memory database completes immediately (0ms latency),
 * and the Google Sheet tab is updated asynchronously.
 */
export function scheduleTableSync(table: string, getRows: () => any[], delayMs = 1500) {
  if (!isSheetsConfigured()) return;

  const existingTimer = syncTimers.get(table);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    syncTimers.delete(table);
    if (inFlightSyncs.has(table)) {
      // Re-schedule if another sync is currently writing
      scheduleTableSync(table, getRows, 1000);
      return;
    }

    inFlightSyncs.add(table);
    try {
      const rows = getRows();
      const ok = await syncTableToSheet(table, rows);
      if (ok) {
        console.log(`[sheets] Synced '${table}' (${rows.length} rows) to Google Sheets`);
      }
    } catch (e) {
      console.error(`[sheets] Background sync failed for '${table}':`, e);
    } finally {
      inFlightSyncs.delete(table);
    }
  }, delayMs);

  syncTimers.set(table, timer);
}
