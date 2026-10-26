import { hc, type ClientResponse } from "hono/client";
import type { AppType } from "@/server/app";
import type { ActionResult } from "@/lib/validation/result";

/** Also used for plain hrefs (CSV exports, file downloads, PDFs). */
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const api = hc<AppType>(API_URL, { init: { credentials: "include" } });

/**
 * Reads: unwrap or throw, so React Query sees an error. Dates arrive as ISO strings
 * (server components used to hand down real Dates), so call sites parse them.
 *
 * The status/format generics stay loose so a handler that answers with more than one
 * shape (a permission-gated page: `{canView:false}` or the data) infers as that union.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T>(p: Promise<ClientResponse<T, any, any>>): Promise<T> {
  const res = await p;
  if (res.status === 401) {
    window.location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    throw new Error("Not signed in.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Request failed.");
  }
  return (await res.json()) as T;
}

/** Writes: always resolves to the ActionResult shape the call sites already branch on. */
export async function call(p: Promise<Response>): Promise<ActionResult> {
  const res = await p;
  if (res.status === 401) {
    window.location.assign("/login");
    return { ok: false, error: "Not signed in." };
  }
  return (await res.json()) as ActionResult;
}
