import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./server";
import { allowedCompanyIds, type CurrentUser } from "./permissions";
import { db } from "@/lib/db";
import { companyIdOf, parseScope, SCOPE_COOKIE, type Scope } from "@/lib/scope";
import type { ScopeFilter } from "@/lib/db/scope";

/** The signed-in user for this request (deduplicated per request). Redirects to /login. */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { memberships: { select: { companyId: true, role: true, modules: true } } },
  });
  if (!user || !user.active) redirect("/login");
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    isOwner: user.isOwner,
    kind: user.kind,
    title: user.title,
    weeklyCapacityHours: user.weeklyCapacityHours,
    memberships: user.memberships,
  };
});

/** Staff only: client-portal users are sent to /portal. */
export const getStaffUser = cache(async (): Promise<CurrentUser> => {
  const user = await getCurrentUser();
  if (user.kind === "CLIENT") redirect("/portal");
  return user;
});

export type RequestContext = ScopeFilter & { user: CurrentUser; scope: Scope };

/**
 * Current user + company scope. Scope comes from the cookie, which proxy.ts keeps in
 * sync with ?company=. It's narrowed to the companies the user belongs to.
 */
export const getRequestContext = cache(async (): Promise<RequestContext> => {
  const user = await getStaffUser();
  const allowed = allowedCompanyIds(user);
  let scope: Scope = parseScope((await cookies()).get(SCOPE_COOKIE)?.value) ?? "ALL";

  if (scope !== "ALL" && !allowed.includes(companyIdOf(scope))) scope = "ALL";
  if (scope === "ALL" && allowed.length === 1) scope = allowed[0]!.toUpperCase() as Scope;

  const companyIds = scope === "ALL" ? allowed : [companyIdOf(scope)];
  return { user, scope, companyIds };
});
