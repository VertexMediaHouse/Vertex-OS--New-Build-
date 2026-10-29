// Self-check for the row-level sync queue: rows queued while a sync is already in
// flight for the same table must not be dropped. Run with: npx tsx lib/sheets/index.test.ts
import assert from "node:assert";

process.env.GOOGLE_SHEET_WEBAPP_URL = "https://example.com/exec";

const sent: { action: string; rows?: any[]; ids?: string[] }[] = [];
let resolveFirstFetch!: () => void;
let fetchCount = 0;

(globalThis as any).fetch = async (_url: string, opts: { body: string }) => {
  const body = JSON.parse(opts.body);
  sent.push(body);
  fetchCount++;
  if (fetchCount === 1) {
    // Hold the first upsertRows call open until a second scheduleTableSync fires mid-flight.
    await new Promise<void>((resolve) => (resolveFirstFetch = resolve));
  }
  return { ok: true, json: async () => ({ ok: true, count: body.rows?.length ?? body.ids?.length ?? 0 }) };
};

const { scheduleTableSync, scheduleTableDelete, setWaitUntil } = await import("./index");

const waits: Promise<unknown>[] = [];
setWaitUntil((p) => waits.push(p));

scheduleTableSync("task", [{ id: "t1", status: "TODO" }]);
// Second call lands while the first fetch is still "in flight" (held by resolveFirstFetch).
scheduleTableSync("task", [{ id: "t2", status: "TODO" }]);
scheduleTableDelete("task", ["t3"]);

await new Promise((r) => setTimeout(r, 10)); // let the microtask queue settle
resolveFirstFetch();
await Promise.all(waits);

const upsertCalls = sent.filter((s) => s.action === "upsertRows");
const allUpsertedIds = upsertCalls.flatMap((c) => c.rows!.map((r) => r.id));
assert.deepStrictEqual(new Set(allUpsertedIds), new Set(["t1", "t2"]), "both rows queued during the in-flight window must reach the sheet");

const deleteCalls = sent.filter((s) => s.action === "deleteRows");
const allDeletedIds = deleteCalls.flatMap((c) => c.ids!);
assert.deepStrictEqual(allDeletedIds, ["t3"], "delete queued during the in-flight window must reach the sheet");

console.log("ok — rows queued mid-flight are not dropped");
