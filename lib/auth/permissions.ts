// Role-based permissions. Checked on the server in every action and route handler;
// the UI only uses can() to hide controls. Record-level limits for MEMBER (own tasks,
// own time, assigned projects) are applied in each module's queries via isMemberOnly().

import { ALL_COMPANY_IDS } from "@/lib/scope";

export type MemberRoleName = "ADMIN" | "MANAGER" | "MEMBER";
export type Role = "OWNER" | MemberRoleName;

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  isOwner: boolean;
  kind: "STAFF" | "CLIENT";
  title: string | null;
  weeklyCapacityHours: number;
  memberships: { companyId: string; role: MemberRoleName }[];
};

export type Resource =
  | "dashboard"
  | "lead"
  | "client"
  | "project"
  | "task"
  | "time"
  | "invoice"
  | "goal"
  | "file"
  | "campaign"
  | "report"
  | "team"
  | "settings";

export type Action = "view" | "create" | "update" | "delete" | "approve";

const ALL: Action[] = ["view", "create", "update", "delete", "approve"];
const EDIT: Action[] = ["view", "create", "update"];

const MATRIX: Record<MemberRoleName, Partial<Record<Resource, Action[]>>> = {
  ADMIN: {
    dashboard: ALL, lead: ALL, client: ALL, project: ALL, task: ALL, time: ALL, invoice: ALL,
    goal: ALL, file: ALL, campaign: ALL, report: ALL, team: ALL, settings: ALL,
  },
  MANAGER: {
    dashboard: ["view"], lead: EDIT, client: EDIT, project: EDIT, task: [...EDIT, "delete"],
    time: [...EDIT, "approve"], invoice: EDIT, goal: EDIT, file: [...EDIT, "delete"], campaign: EDIT,
    report: ["view"], team: ["view"],
  },
  MEMBER: {
    dashboard: ["view"], client: ["view"], project: ["view"], task: EDIT, time: EDIT,
    goal: ["view", "update"], file: ["view", "create", "update"], team: ["view"],
  },
};

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Company ids the user can see at all. */
export function allowedCompanyIds(user: CurrentUser): string[] {
  if (user.isOwner) return [...ALL_COMPANY_IDS];
  return user.memberships.map((m) => m.companyId);
}

/** The user's role in one company, or null when they're not a member. */
export function roleIn(user: CurrentUser, companyId: string): Role | null {
  if (user.isOwner) return "OWNER";
  return user.memberships.find((m) => m.companyId === companyId)?.role ?? null;
}

/**
 * Can the user do `action` on `resource`? With a companyId, the user's role in that
 * company decides; without one (page-level checks), any company where it's allowed counts.
 */
export function can(user: CurrentUser, action: Action, resource: Resource, companyId?: string): boolean {
  if (user.kind === "CLIENT") return false;
  if (user.isOwner) return true;
  const roles = companyId
    ? [roleIn(user, companyId)].filter((r): r is MemberRoleName => r !== null && r !== "OWNER")
    : user.memberships.map((m) => m.role);
  return roles.some((r) => MATRIX[r][resource]?.includes(action) ?? false);
}

export function assertCan(user: CurrentUser, action: Action, resource: Resource, companyId?: string): void {
  if (!can(user, action, resource, companyId)) throw new ForbiddenError();
}

/** MEMBERs only see their own tasks/time and projects they're assigned to. */
export function isMemberOnly(user: CurrentUser, companyId?: string): boolean {
  if (user.isOwner) return false;
  const roles = companyId ? [roleIn(user, companyId)] : user.memberships.map((m) => m.role);
  return roles.every((r) => r === "MEMBER" || r === null);
}

/** Label shown under the user's name in the topbar. */
export function roleLabel(user: CurrentUser): string {
  if (user.isOwner) return "Owner (Super Admin)";
  if (user.title) return user.title;
  const top = (["ADMIN", "MANAGER", "MEMBER"] as const).find((r) => user.memberships.some((m) => m.role === r));
  return top ? top[0] + top.slice(1).toLowerCase() : "Member";
}
