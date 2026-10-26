// Hono equivalent of lib/auth/context.ts. Where the Next version redirects, these
// return 401/403 and let the frontend decide where to send the user.
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { auth } from "./auth";
import { db } from "@/lib/db";
import { allowedCompanyIds, type CurrentUser } from "@/lib/auth/permissions";
import { companyIdOf, parseScope, SCOPE_COOKIE, type Scope } from "@/lib/scope";

export type Vars = { user: CurrentUser; scope: Scope; companyIds: string[] };
export type Env = { Variables: Vars };

/** The signed-in user for this request, or 401. */
export const requireUser = createMiddleware<Env>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) throw new HTTPException(401, { message: "Not signed in." });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { memberships: { select: { companyId: true, role: true, modules: true } } },
  });
  if (!user || !user.active) throw new HTTPException(401, { message: "Not signed in." });

  c.set("user", {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    isOwner: user.isOwner,
    kind: user.kind,
    title: user.title,
    weeklyCapacityHours: user.weeklyCapacityHours,
    memberships: user.memberships,
  });
  await next();
});

/** Staff only: client-portal users belong on /portal. */
export const requireStaff = createMiddleware<Env>(async (c, next) => {
  if (c.get("user").kind === "CLIENT") throw new HTTPException(403, { message: "Staff only." });
  await next();
});

/**
 * Company scope from the cookie, narrowed to the companies the user belongs to.
 * Mirrors getRequestContext(): sets `scope` and the `companyIds` filter.
 */
export const withScope = createMiddleware<Env>(async (c, next) => {
  const user = c.get("user");
  const allowed = allowedCompanyIds(user);
  let scope: Scope = parseScope(getCookie(c, SCOPE_COOKIE)) ?? "ALL";

  if (scope !== "ALL" && !allowed.includes(companyIdOf(scope))) scope = "ALL";
  if (scope === "ALL" && allowed.length === 1) scope = allowed[0]!.toUpperCase() as Scope;

  c.set("scope", scope);
  c.set("companyIds", scope === "ALL" ? allowed : [companyIdOf(scope)]);
  await next();
});

/** What route handlers use in place of `await getRequestContext()`. */
export const staffContext = [requireUser, requireStaff, withScope] as const;
