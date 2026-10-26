"use client";

import { createAuthClient } from "better-auth/react";

// The API lives on its own origin, so the session cookie has to be sent explicitly.
export const authClient = createAuthClient({
  baseURL: import.meta.env?.VITE_API_URL ?? "http://localhost:4000",
  fetchOptions: { credentials: "include" },
});
