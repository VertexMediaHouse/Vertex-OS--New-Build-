import { betterAuth } from "better-auth";
import { authOptions } from "@/lib/auth/config";
import { sessionsKv } from "./kv";

// No nextCookies() plugin: better-auth's core sets Set-Cookie on its own responses,
// which is all Hono needs.
const kv = sessionsKv();

export const auth = betterAuth({
  ...authOptions,
  // Cloudflare Workers has no sticky isolate per user: the in-memory db (lib/db,
  // Sheets-backed) that lib/auth/config.ts points `database` at lives in one
  // isolate's memory only, so a session written at login is invisible to whichever
  // isolate handles the next request — every request after login 401s and the
  // client bounces back to /login. secondaryStorage makes session reads/writes go
  // through KV instead, which is shared across isolates. Falls back to the
  // in-memory db under `npm run dev`/`start` (plain Node, no KV binding there).
  secondaryStorage: kv && {
    get: (key) => kv.get(key),
    set: (key, value, ttlSeconds) => kv.put(key, value, ttlSeconds ? { expirationTtl: ttlSeconds } : undefined),
    delete: (key) => kv.delete(key),
    async getAndDelete(key) {
      const value = await kv.get(key);
      await kv.delete(key);
      return value;
    },
    // Only used by the rate-limiter plugin, which this app doesn't enable.
    increment() {
      throw new Error("not implemented");
    },
  },
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? 4000}`,
  // In dev the SPA (5173) and the API (4000) are different origins. Deployed, the
  // Cloudflare Worker serves both from one origin (wrangler.json's run_worker_first),
  // so there's no single known production URL to list ahead of time — trust whatever
  // origin the request actually arrived on, which is exactly that one shared domain.
  trustedOrigins: (request?: Request) => {
    const dev = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000", process.env.WEB_ORIGIN].filter(
      (x): x is string => Boolean(x),
    );
    try {
      return [...dev, new URL(request!.url).origin];
    } catch {
      return dev;
    }
  },
});
