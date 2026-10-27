import { betterAuth } from "better-auth";
import { authOptions } from "@/lib/auth/config";

// No nextCookies() plugin: better-auth's core sets Set-Cookie on its own responses,
// which is all Hono needs.
export const auth = betterAuth({
  ...authOptions,
  baseURL: process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? 4000}`,
  // The SPA lives on a different origin than the API.
  trustedOrigins: [
    process.env.WEB_ORIGIN ?? "http://localhost:5173",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
});
