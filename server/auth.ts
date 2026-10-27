import { betterAuth } from "better-auth";
import { authOptions } from "@/lib/auth/config";

// No nextCookies() plugin: better-auth's core sets Set-Cookie on its own responses,
// which is all Hono needs.
export const auth = betterAuth({
  ...authOptions,
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
