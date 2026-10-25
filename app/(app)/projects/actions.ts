"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import { logActivity, notify } from "@/lib/activity";
import { canSeeFile } from "@/lib/files/access";
import { invitePortalContact } from "@/lib/clients/portal-invite";
import { PROJECT_STATUS } from "@/lib/status";
import { projectProgress, TEMPLATES } from "@/lib/projects/templates";
import type { ActionResult } from "@/lib/validation/result";
import { mentionedUsers } from "@/lib/mentions";

const id = z.string().min(1).max(64);

async function projectFor(action: "update" | "create", projectId: string) {
  const { user } = await getRequestContext();
  const project = await db.project.findUniqueOrThrow({ where: { id: id.parse(projectId) } });
  assertCan(user, action, "project", project.companyId);
  return { user, project };
}

const projectSchema = z.object({
  companyId: z.enum(["vmh", "vth"]),
  clientId: z.string().max(64),
  name: z.string().trim().min(1, "Name is required").max(160),
  typeLabel: z.string().trim().min(1, "Type is required").max(120),
  category: z.enum(["VIDEO_EDITING", "WEBSITE_DEVELOPMENT", "CRM_ERP", "AUTOMATION", "DESIGN", "OTHER"]),
  billingType: z.enum(["MONTHLY_RETAINER", "FIXED_SCOPE", "RETAINER_HOURS", "TIME_AND_MATERIALS"]),
  value: z.coerce.number().min(0).max(1e10),
  retainerHours: z.coerce.number().int().min(0).max(10000).optional(),
  startDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  summary: z.string().trim().max(200).optional(),
  description: z.string().trim().max(5000).optional(),
});

export async function createProject(input: z.input<typeof projectSchema>): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  assertCan(user, "create", "project", d.companyId);
  const template = d.companyId === "vmh" ? "VMH" : "VTH";
  const project = await db.$transaction(async (tx) => {
    const p = await tx.project.create({ data: { ...d, template, status: TEMPLATES[template].statuses[0], members: { create: { userId: user.id } } } });
    await tx.clientCompany.upsert({ where: { clientId_companyId: { clientId: d.clientId, companyId: d.companyId } }, create: { clientId: d.clientId, companyId: d.companyId }, update: {} });
    await logActivity(tx, { companyId: d.companyId, actorId: user.id, verb: "created", entityType: "PROJECT", entityId: p.id, summary: `${user.name} started project ${p.name}` });
    return p;
  });
  refresh();
  return { ok: true, id: project.id };
}

/** The company and template are fixed at creation; everything else on the form can change. */
export async function updateProject(projectId: string, input: z.input<typeof projectSchema>): Promise<ActionResult> {
  const { user, project } = await projectFor("update", projectId);
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const { companyId, ...d } = parsed.data;
  void companyId;
  await db.$transaction(async (tx) => {
    await tx.project.update({ where: { id: project.id }, data: d });
    // Moving the project to another client has to link that client to the company, as create does.
    await tx.clientCompany.upsert({ where: { clientId_companyId: { clientId: d.clientId, companyId: project.companyId } }, create: { clientId: d.clientId, companyId: project.companyId }, update: {} });
    await logActivity(tx, { companyId: project.companyId, actorId: user.id, verb: "updated", entityType: "PROJECT", entityId: project.id, summary: `${user.name} updated project ${d.name}` });
  });
  refresh();
  return { ok: true, id: project.id };
}

export async function setProjectStatus(projectId: string, status: string) {
  const { user, project } = await projectFor("update", projectId);
  const allowed = TEMPLATES[project.template].statuses as readonly string[];
  const s = z.string().refine((v) => allowed.includes(v), "Invalid status").parse(status);
  await db.$transaction([
    db.project.update({ where: { id: project.id }, data: { status: s as never, completedAt: s === "COMPLETED" ? new Date() : null } }),
    db.activity.create({ data: { companyId: project.companyId, actorId: user.id, verb: "status", entityType: "PROJECT", entityId: project.id, summary: `${user.name} set ${project.name} to ${PROJECT_STATUS[s]!.label}` } }),
  ]);
  refresh();
}

/** VMH: +/- one delivered unit. VTH: set percent. Recomputes project progress. */
export async function updateDeliverable(deliverableId: string, value: number) {
  const d = await db.deliverable.findUniqueOrThrow({ where: { id: id.parse(deliverableId) } });
  const { project } = await projectFor("update", d.projectId);
  const v = z.number().int().min(0).max(10000).parse(value);
  await db.deliverable.update({ where: { id: d.id }, data: d.targetCount !== null ? { completedCount: Math.min(v, d.targetCount) } : { percent: Math.min(v, 100) } });
  await recomputeProgress(project.id);
  refresh();
}

export async function setMilestoneStatus(milestoneId: string, status: string) {
  const m = await db.milestone.findUniqueOrThrow({ where: { id: id.parse(milestoneId) } });
  const { user, project } = await projectFor("update", m.projectId);
  const s = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).parse(status);
  await db.$transaction([
    db.milestone.update({ where: { id: m.id }, data: { status: s } }),
    db.activity.create({ data: { companyId: project.companyId, actorId: user.id, verb: "milestone", entityType: "PROJECT", entityId: project.id, summary: `${user.name} marked "${m.title}" ${s === "COMPLETED" ? "completed" : s.toLowerCase().replace("_", " ")}` } }),
  ]);
  await recomputeProgress(project.id);
  refresh();
}

async function recomputeProgress(projectId: string) {
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { deliverables: true, milestones: true } });
  await db.project.update({ where: { id: projectId }, data: { progress: projectProgress(p) } });
}

export async function addProjectNote(projectId: string, body: string) {
  const { user, project } = await projectFor("update", projectId);
  const text = z.string().trim().min(1).max(5000).parse(body);
  const mentions = await mentionedUsers(text);
  await db.$transaction(async (tx) => {
    await tx.comment.create({ data: { entityType: "PROJECT", entityId: project.id, authorId: user.id, body: text, mentions } });
    await notify(tx, { userIds: mentions, exceptUserId: user.id, type: "mention", title: `${user.name} mentioned you on ${project.name}`, link: `/projects?id=${project.id}&tab=notes` });
  });
  refresh();
}

export async function requestApproval(projectId: string, title: string, fileId?: string): Promise<ActionResult> {
  const { user, project } = await projectFor("update", projectId);
  const t = z.string().trim().min(1).max(160).parse(title);
  // The file id comes from the browser: it must be one this user may see, on this project.
  if (fileId) {
    const f = await canSeeFile(user, id.parse(fileId));
    if (!f || f.projectId !== project.id) return { ok: false, error: "That file isn't on this project." };
  }
  await db.$transaction(async (tx) => {
    await tx.approval.create({ data: { projectId: project.id, title: t, fileId: fileId || null } });
    await logActivity(tx, { companyId: project.companyId, actorId: user.id, verb: "approval", entityType: "APPROVAL", entityId: project.id, summary: `${user.name} sent ${t} for client approval` });
  });
  refresh();
  return { ok: true };
}

/** Give a client contact portal access: creates a CLIENT login and emails a set-password link. */
export async function inviteContact(contactId: string): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const contact = await db.clientContact.findUniqueOrThrow({ where: { id: id.parse(contactId) }, include: { client: { include: { companies: true } } } });
  contact.client.companies.forEach((c) => assertCan(user, "update", "client", c.companyId));
  const res = await invitePortalContact(contact.id);
  refresh();
  return res;
}

export async function revokeContact(contactId: string) {
  const { user } = await getRequestContext();
  const contact = await db.clientContact.findUniqueOrThrow({ where: { id: id.parse(contactId) }, include: { client: { include: { companies: true } } } });
  contact.client.companies.forEach((c) => assertCan(user, "update", "client", c.companyId));
  await db.clientContact.update({ where: { id: contact.id }, data: { portalAccess: false } });
  if (contact.userId) await db.session.deleteMany({ where: { userId: contact.userId } });
  refresh();
}
