import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { parseScope, SCOPE_COOKIE, SCOPE_PARAM } from "@/lib/scope";

const PUBLIC_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/api/auth", "/api/track"];

export function proxy(request: NextRequest) {
  const { pathname, searchParams, search } = request.nextUrl;

  // Optimistic check only; pages and actions verify the session themselves.
  if (!PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) && !getSessionCookie(request)) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  // ?company= wins over the cookie; copy it into the request cookie so this render
  // already sees the new scope, and persist it for later requests.
  const scope = parseScope(searchParams.get(SCOPE_PARAM));
  if (!scope) return NextResponse.next();
  const value = scope.toLowerCase();
  request.cookies.set(SCOPE_COOKIE, value);
  const headers = new Headers(request.headers);
  headers.set("cookie", request.cookies.toString());
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(SCOPE_COOKIE, value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)"],
};
