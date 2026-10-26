// Ported from app/portal/{page.tsx,actions.ts}. Client-portal users are CLIENT kind, so
// this sub-app uses requireUser only — requireStaff would lock out exactly its audience.
import { Hono } from "hono";
import { z } from "zod";
import { requireUser, type Env } from "../context";
import { logActivity, notify } from "@/lib/activity";
import type { CurrentUser } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import type { ActionResult } from "@/lib/validation/result";

/** One return point, so the RPC client sees a single discriminated union. */
async function portalData(user: CurrentUser) {
  // The page used to redirect staff to /dashboard; the frontend does that on this state.
  if (user.kind !== "CLIENT") return { state: "staff" as const };

  const contact = await db.clientContact.findUnique({ where: { userId: user.id }, include: { client: true, projects: { select: { projectId: true } } } });
  if (!contact?.portalAccess) return { state: "no-access" as const };

  // Access is per project: without one shared with them, there is nothing to show.
  const projectIds = contact.projects.map((p) => p.projectId);
  if (projectIds.length === 0) return { state: "no-projects" as const };

  const [projects, approvals, files, invoices, tasks] = await Promise.all([
      db.project.findMany({ where: { id: { in: projectIds } }, include: { company: true, members: { include: { user: { select: { name: true } } } } }, orderBy: { startDate: "desc" } }),
      db.approval.findMany({ where: { projectId: { in: projectIds } }, include: { project: { select: { name: true } }, file: true }, orderBy: { requestedAt: "desc" }, take: 20 }),
      db.file.findMany({ where: { projectId: { in: projectIds }, deletedAt: null, sharedWithPortal: true }, orderBy: { updatedAt: "desc" }, take: 20 }),
      db.invoice.findMany({ where: { projectId: { in: projectIds }, status: { not: "DRAFT" } }, orderBy: { issueDate: "desc" }, take: 20 }),
      // Most recently touched first, so a status change the team just made is at the top.
      db.task.findMany({
        where: { projectId: { in: projectIds } },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: { id: true, title: true, status: true, progress: true, dueDate: true, completedAt: true, project: { select: { name: true } } },
      }),
    ]);
  const brand = projects.every((p) => p.companyId === "vth") ? "vth" : "vmh";
  return {
    state: "ok" as const,
    contact: { name: contact.name, client: { name: contact.client.name } },
    brand,
    projects,
    approvals,
    files,
    invoices,
    tasks,
  };
}

export const portal = new Hono<Env>()
  .use(requireUser)
  .get("/", async (c) => c.json(await portalData(c.get("user"))))
  /** Portal client approves or asks for changes on a deliverable of their own project. */
  .post("/respond", async (c) => {
    const user = c.get("user");
    if (user.kind !== "CLIENT") throw new Error("Not allowed.");
    const body = await c.req.json<{ approvalId: string; decision: "APPROVED" | "REVISION"; comment?: string }>();
    const d = z.enum(["APPROVED", "REVISION"]).parse(body.decision);
    const note = z.string().trim().max(2000).optional().parse(body.comment);
    const contact = await db.clientContact.findUnique({ where: { userId: user.id } });
    if (!contact?.portalAccess) throw new Error("No portal access.");
    const approval = await db.approval.findUniqueOrThrow({ where: { id: z.string().max(64).parse(body.approvalId) }, include: { project: { include: { members: true } } } });
    if (approval.project.clientId !== contact.clientId || approval.status !== "PENDING") throw new Error("Not allowed.");
    await db.$transaction(async (tx) => {
      await tx.approval.update({ where: { id: approval.id }, data: { status: d, respondedAt: new Date(), respondedByContactId: contact.id, comment: note } });
      const summary = `${contact.name} ${d === "APPROVED" ? "approved" : "requested changes on"} ${approval.title}`;
      await logActivity(tx, { companyId: approval.project.companyId, actorId: null, verb: d === "APPROVED" ? "approved" : "revision", entityType: "APPROVAL", entityId: approval.projectId, summary });
      await notify(tx, { userIds: approval.project.members.map((m) => m.userId), type: "approval", title: summary, link: `/projects?id=${approval.projectId}&tab=access` });
    });
    return c.json<ActionResult>({ ok: true });
  });
