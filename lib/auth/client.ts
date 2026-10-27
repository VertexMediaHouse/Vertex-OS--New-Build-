import { createAuthClient } from "better-auth/react";
import { API_URL } from "@/web/api";

// In dev the API lives on its own origin, so the session cookie has to be sent
// explicitly; same-origin in production (see web/api.ts).
export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: { credentials: "include" },
});
