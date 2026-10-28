// Minimal slice of Cloudflare's KVNamespace type actually used (better-auth's
// secondaryStorage shape) — not worth an @cloudflare/workers-types dependency for this.
type KVNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

// The Worker's KV binding, stashed by server/worker.ts on the first request.
// Undefined under `npm run dev`/`start` (plain Node, no Workers runtime) — callers
// fall back to the in-memory db there instead.
export function sessionsKv(): KVNamespace | undefined {
  return (globalThis as any).__CF_ENV__?.SESSIONS;
}
