"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/context";
import { logActivity, notify } from "@/lib/activity";

/** Portal client approves or asks for changes on a deliverable of their own project. */
export async function respondToApproval(approvalId: string, decision: "APPROVED" | "REVISION", comment?: string) {
  const user = await getCurrentUser();
  if (user.kind !== "CLIENT") redirect("/dashboard");
  const d = z.enum(["APPROVED", "REVISION"]).parse(decision);
  const note = z.string().trim().max(2000).optional().parse(comment);
  const contact = await db.clientContact.findUnique({ where: { userId: user.id } });
  if (!contact?.portalAccess) throw new Error("No portal access.");
  const approval = await db.approval.findUniqueOrThrow({ where: { id: z.string().max(64).parse(approvalId) }, include: { project: { include: { members: true } } } });
  if (approval.project.clientId !== contact.clientId || approval.status !== "PENDING") throw new Error("Not allowed.");
  await db.$transaction(async (tx) => {
    await tx.approval.update({ where: { id: approval.id }, data: { status: d, respondedAt: new Date(), respondedByContactId: contact.id, comment: note } });
    const summary = `${contact.name} ${d === "APPROVED" ? "approved" : "requested changes on"} ${approval.title}`;
    await logActivity(tx, { companyId: approval.project.companyId, actorId: null, verb: d === "APPROVED" ? "approved" : "revision", entityType: "APPROVAL", entityId: approval.projectId, summary });
    await notify(tx, { userIds: approval.project.members.map((m) => m.userId), type: "approval", title: summary, link: `/projects?id=${approval.projectId}&tab=access` });
  });
  refresh();
}
