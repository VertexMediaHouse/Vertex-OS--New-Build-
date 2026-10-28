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
    // Cold isolate: the in-memory store starts empty and lib/db/index.ts kicks off
    // Sheets hydration on import but doesn't await it — without this, a request that
    // lands on a fresh isolate can read/write that empty store before hydration lands.
    const { initDbFromSheets } = await import("@/lib/db");
    await initDbFromSheets();
    return app.fetch(request, env, ctx as any);
  },
};
