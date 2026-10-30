// Cloudflare Workers entry point. Node-only concerns (the HTTP listener, cron
// job scheduler) live in index.ts instead — that one's for `npm run start`.
//
// Workers never populate process.env from wrangler vars/secrets or KV bindings —
// those only arrive per-request as the `env` param below. Every module in this
// app reads config via process.env (shared with the Node server in index.ts), so
// the first request copies the real Worker env into it before anything else
// loads. Module-level code that reads process.env (server/app.ts's WEB_ORIGIN,
// server/auth.ts's auth singleton, lib/email, lib/storage, ...) only runs once,
// on the first import — so this has to happen before that first `import("./app")`,
// not in a Hono middleware (which runs per-request, too late for module init).
let appPromise: Promise<typeof import("./app")> | undefined;

export default {
  async fetch(request: Request, env: Record<string, string>, ctx: unknown) {
    if (!appPromise) {
      for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
      appPromise = import("./app");
    }
    const { app } = await appPromise;
    // Requests answer in ms: reads are served from the in-memory store and hydration
    // runs in the background. Reads come from the CSV endpoint now (~2s for all 44
    // tabs, ~0.6s for a few), so a refresh no longer costs the old ~16s Apps Script
    // getAll — but it still isn't on the request's critical path.
    //
    // What makes that safe is in lib/db: hydration MERGES the arriving snapshot into
    // the store instead of replacing it, and rows this isolate created/deleted while
    // the fetch was in flight are preserved (see writtenIds/deletedIds). Before that,
    // a landing snapshot wiped concurrent writes — the "saved it, then it vanished"
    // inconsistency.
    //
    // /api/auth/* is the one path that does wait, in server/app.ts: a cold isolate has
    // no users until the auth tabs land, so the first login would otherwise fail.
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/health")) {
      const { initDbFromSheets } = await import("@/lib/db");
      const hydrating = initDbFromSheets().catch((err: unknown) => console.error("[worker] Background hydration error:", err));
      // With waitUntil (Workers) the isolate is kept alive past the response. Without
      // it, awaiting keeps hydration from being dropped entirely — a bare floating
      // promise let the first request read a store that was still empty.
      if (ctx && typeof (ctx as any).waitUntil === "function") (ctx as any).waitUntil(hydrating);
      else await hydrating;
    }
    return app.fetch(request, env, ctx as any);
  },
};
