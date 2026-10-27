// Ported from app/(app)/projects/{page.tsx,actions.ts}. Query and mutation bodies are
// unchanged; only the context and input plumbing differs. refresh() is gone — the
// frontend invalidates its query after a successful mutation.
import { Hono } from "hono";
import { z } from "zod";
import { staffContext, type Env } from "../context";
import { logActivity, notify } from "@/lib/activity";
import { assertCan, can, isMemberOnly, type CurrentUser } from "@/lib/auth/permissions";
import { now } from "@/lib/clock";
import { invitePortalContact } from "@/lib/clients/portal-invite";
import { db, type Prisma } from "@/lib/db";
import { canSeeFile } from "@/lib/files/access";
import { mentionedUsers } from "@/lib/mentions";
import { parsePage } from "@/lib/pagination";
import { projectProgress, LIST_TABS, TEMPLATES } from "@/lib/projects/templates";
import { PROJECT_STATUS } from "@/lib/status";
import type { ActionResult } from "@/lib/validation/result";

const id = z.string().min(1).max(64);
const PAGE = 10;

async function projectFor(user: CurrentUser, action: "update" | "create" | "delete", projectId: string) {
  const project = await db.project.findUniqueOrThrow({ where: { id: id.parse(projectId) } });
  assertCan(user, action, "project", project.companyId);
  return project;
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

async function recomputeProgress(projectId: string) {
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { deliverables: true, milestones: true } });
  const input = p as unknown as { template: "VMH" | "VTH"; deliverables: { targetCount: number | null; completedCount: number | null; percent: number | null }[]; milestones: { status: string }[] };
  await db.project.update({ where: { id: projectId }, data: { progress: projectProgress(input) } });
}

export const projects = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const user = c.get("user");
    const companyIds = c.get("companyIds");
    const scope = c.get("scope");
    if (!can(user, "view", "project")) return c.json({ denied: true as const });
    const q = c.req.query("q") || null;
    const page = parsePage(c.req.query("page"));
    const base: Prisma.ProjectWhereInput = { companyId: { in: companyIds }, clientId: { not: null }, ...(c.req.query("client") && { clientId: c.req.query("client")! }) };
    if (isMemberOnly(user)) base.members = { some: { userId: user.id } };
    const tab = (c.req.query("list") ?? "all") as keyof typeof LIST_TABS;
    const statuses = LIST_TABS[tab] ?? null;
    const where: Prisma.ProjectWhereInput = { ...base, ...(statuses && { status: { in: [...statuses] as never } }), ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { client: { name: { contains: q, mode: "insensitive" } } }] }) };
    const [list, total, counts, clients] = await Promise.all([
      db.project.findMany({ where, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: (page - 1) * PAGE, take: PAGE, include: { client: { select: { name: true } }, members: { include: { user: { select: { name: true, image: true } } } } } }),
      db.project.count({ where }),
      db.project.groupBy({ by: ["status"], _count: true, where: base }),
      db.client.findMany({ where: { archivedAt: null, companies: { some: { companyId: { in: companyIds } } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    const tabCount = (k: keyof typeof LIST_TABS) => counts.filter((x) => !LIST_TABS[k] || (LIST_TABS[k] as readonly string[]).includes(x.status)).reduce((a, x) => a + x._count, 0);
    const rows = list.map((x) => ({
      ...x,
      template: x.template as "VMH" | "VTH",
      client: x.client as { name: string } | null,
      members: x.members as { userId: string; user: { name: string; image: string | null } }[],
    }));
    return c.json({
      denied: false as const,
      list: rows,
      total,
      page,
      pageSize: PAGE,
      clients,
      scope,
      tabCounts: { all: tabCount("all"), active: tabCount("active"), review: tabCount("review"), completed: tabCount("completed") },
      creatable: companyIds.filter((x): x is "vmh" | "vth" => can(user, "create", "project", x)),
    });
  })
  .get("/detail", async (c) => {
    const user = c.get("user");
    const companyIds = c.get("companyIds");
    const projectId = c.req.query("id") ?? "";
    const tab = c.req.query("tab") ?? "overview";
    const pr = await db.project.findFirst({
      // Same rule as the list: members only see projects they're on.
      where: { id: projectId, companyId: { in: companyIds }, ...(isMemberOnly(user) && { members: { some: { userId: user.id } } }) },
      include: {
        client: { include: { contacts: { orderBy: { isPrimary: "desc" }, include: { projects: { where: { projectId }, select: { projectId: true } } } } } },
        company: { select: { name: true, code: true } },
        members: { include: { user: { select: { name: true, image: true } } } },
        deliverables: { orderBy: { order: "asc" } },
        milestones: { orderBy: [{ order: "asc" }, { dueDate: "asc" }] },
        phases: { orderBy: { order: "asc" } },
        approvals: { orderBy: { requestedAt: "desc" }, take: 6 },
        invoices: { orderBy: { issueDate: "desc" } },
      },
    });
    if (!pr) return c.json({ project: null });
    const [tasks, taskCount, doneCount, files, time, notes, activity, clients, people] = await Promise.all([
      db.task.findMany({ where: { projectId }, orderBy: [{ dueDate: "asc" }], take: tab === "tasks" ? 100 : 5, include: { assignee: { select: { name: true, image: true } } } }),
      db.task.count({ where: { projectId } }),
      db.task.count({ where: { projectId, status: "COMPLETED" } }),
      db.file.findMany({ where: { projectId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: tab === "files" ? 100 : 5 }),
      db.timeEntry.groupBy({ by: ["billable"], _sum: { durationMin: true }, where: { projectId } }),
      db.comment.findMany({ where: { entityType: "PROJECT", entityId: projectId }, orderBy: { createdAt: "desc" }, take: tab === "notes" ? 100 : 3, include: { author: { select: { name: true, image: true } } } }),
      db.activity.findMany({ where: { entityId: projectId }, orderBy: { createdAt: "desc" }, take: 20, include: { actor: { select: { name: true } } } }),
      db.client.findMany({ where: { archivedAt: null, companies: { some: { companyId: pr.companyId } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      db.user.findMany({ where: { kind: "STAFF", memberships: { some: { companyId: pr.companyId } } }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    ]);
    return c.json({
      project: pr,
      tasks,
      taskCount,
      doneCount,
      files,
      notes,
      activity,
      clients,
      people,
      billable: Number(time.find((x) => x.billable)?._sum.durationMin ?? 0),
      nonBillable: Number(time.find((x) => !x.billable)?._sum.durationMin ?? 0),
      editable: can(user, "update", "project", pr.companyId),
      canDelete: can(user, "delete", "project", pr.companyId),
      canInvoice: can(user, "create", "invoice", pr.companyId),
      now: now().toISOString(),
    });
  })
  .post("/", async (c) => {
    const user = c.get("user");
    const parsed = projectSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json<ActionResult>({ ok: false, error: parsed.error.issues[0]!.message });
    const d = parsed.data;
    assertCan(user, "create", "project", d.companyId);
    const template = d.companyId === "vmh" ? "VMH" : "VTH";
    const project = await db.$transaction(async (tx) => {
      const p = await tx.project.create({ data: { ...d, template, status: TEMPLATES[template].statuses[0], members: { create: { userId: user.id } } } });
      await tx.clientCompany.upsert({ where: { clientId_companyId: { clientId: d.clientId, companyId: d.companyId } }, create: { clientId: d.clientId, companyId: d.companyId }, update: {} });
      await logActivity(tx, { companyId: d.companyId, actorId: user.id, verb: "created", entityType: "PROJECT", entityId: p.id, summary: `${user.name} started project ${p.name}` });
      return p;
    });
    return c.json<ActionResult>({ ok: true, id: project.id });
  })
  /** The company and template are fixed at creation; everything else on the form can change. */
  .post("/update", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ projectId: string; input: unknown }>();
    const project = await projectFor(user, "update", body.projectId);
    const parsed = projectSchema.safeParse(body.input);
    if (!parsed.success) return c.json<ActionResult>({ ok: false, error: parsed.error.issues[0]!.message });
    const { companyId, ...d } = parsed.data;
    void companyId;
    await db.$transaction(async (tx) => {
      await tx.project.update({ where: { id: project.id }, data: d });
      // Moving the project to another client has to link that client to the company, as create does.
      await tx.clientCompany.upsert({ where: { clientId_companyId: { clientId: d.clientId, companyId: project.companyId } }, create: { clientId: d.clientId, companyId: project.companyId }, update: {} });
      await logActivity(tx, { companyId: project.companyId, actorId: user.id, verb: "updated", entityType: "PROJECT", entityId: project.id, summary: `${user.name} updated project ${d.name}` });
    });
    return c.json<ActionResult>({ ok: true, id: project.id });
  })
  .post("/status", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ projectId: string; status: string }>();
    const project = await projectFor(user, "update", body.projectId);
    const allowed = TEMPLATES[project.template as "VMH" | "VTH"].statuses as readonly string[];
    const s = z.string().refine((v) => allowed.includes(v), "Invalid status").parse(body.status);
    await db.$transaction([
      db.project.update({ where: { id: project.id }, data: { status: s as never, completedAt: s === "COMPLETED" ? new Date() : null } }),
      db.activity.create({ data: { companyId: project.companyId, actorId: user.id, verb: "status", entityType: "PROJECT", entityId: project.id, summary: `${user.name} set ${project.name} to ${PROJECT_STATUS[s]!.label}` } }),
    ]);
    return c.json<ActionResult>({ ok: true });
  })
  /** VMH: +/- one delivered unit. VTH: set percent. Recomputes project progress. */
  .post("/deliverable", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ deliverableId: string; value: number }>();
    const d = await db.deliverable.findUniqueOrThrow({ where: { id: id.parse(body.deliverableId) } });
    const project = await projectFor(user, "update", d.projectId);
    const v = z.number().int().min(0).max(10000).parse(body.value);
    await db.deliverable.update({ where: { id: d.id }, data: d.targetCount !== null ? { completedCount: Math.min(v, d.targetCount) } : { percent: Math.min(v, 100) } });
    await recomputeProgress(project.id);
    return c.json<ActionResult>({ ok: true });
  })
  .post("/milestone", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ milestoneId: string; status: string }>();
    const m = await db.milestone.findUniqueOrThrow({ where: { id: id.parse(body.milestoneId) } });
    const project = await projectFor(user, "update", m.projectId);
    const s = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).parse(body.status);
    await db.$transaction([
      db.milestone.update({ where: { id: m.id }, data: { status: s } }),
      db.activity.create({ data: { companyId: project.companyId, actorId: user.id, verb: "milestone", entityType: "PROJECT", entityId: project.id, summary: `${user.name} marked "${m.title}" ${s === "COMPLETED" ? "completed" : s.toLowerCase().replace("_", " ")}` } }),
    ]);
    await recomputeProgress(project.id);
    return c.json<ActionResult>({ ok: true });
  })
  .post("/note", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ projectId: string; body: string }>();
    const project = await projectFor(user, "update", body.projectId);
    const text = z.string().trim().min(1).max(5000).parse(body.body);
    const mentions = await mentionedUsers(text);
    await db.$transaction(async (tx) => {
      await tx.comment.create({ data: { entityType: "PROJECT", entityId: project.id, authorId: user.id, body: text, mentions } });
      await notify(tx, { userIds: mentions, exceptUserId: user.id, type: "mention", title: `${user.name} mentioned you on ${project.name}`, link: `/projects?id=${project.id}&tab=notes` });
    });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/approval", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ projectId: string; title: string; fileId?: string }>();
    const project = await projectFor(user, "update", body.projectId);
    const t = z.string().trim().min(1).max(160).parse(body.title);
    // The file id comes from the browser: it must be one this user may see, on this project.
    if (body.fileId) {
      const f = await canSeeFile(user, id.parse(body.fileId));
      if (!f || f.projectId !== project.id) return c.json<ActionResult>({ ok: false, error: "That file isn't on this project." });
    }
    await db.$transaction(async (tx) => {
      await tx.approval.create({ data: { projectId: project.id, title: t, fileId: body.fileId || null } });
      await logActivity(tx, { companyId: project.companyId, actorId: user.id, verb: "approval", entityType: "APPROVAL", entityId: project.id, summary: `${user.name} sent ${t} for client approval` });
    });
    return c.json<ActionResult>({ ok: true });
  })
  /** Give a client contact portal access: creates a CLIENT login and emails a set-password link. */
  .post("/contacts/invite", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ contactId: string; projectId?: string }>();
    const contact = await db.clientContact.findUniqueOrThrow({ where: { id: id.parse(body.contactId) }, include: { client: { include: { companies: true } } } });
    contact.client.companies.forEach((x: any) => assertCan(user, "update", "client", x.companyId));
    const res = await invitePortalContact(contact.id);
    // A login on its own shows nothing: access is granted one project at a time.
    if (res.ok && body.projectId) {
      const project = await projectFor(user, "update", body.projectId);
      if (project.clientId !== contact.clientId) return c.json<ActionResult>({ ok: false, error: "That contact belongs to another client." });
      await db.projectContact.upsert({
        where: { projectId_contactId: { projectId: project.id, contactId: contact.id } },
        create: { projectId: project.id, contactId: contact.id },
        update: {},
      });
    }
    return c.json<ActionResult>(res);
  })
  /** Give an already-invited contact this project too. */
  .post("/contacts/share", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ contactId: string; projectId: string }>();
    const project = await projectFor(user, "update", body.projectId);
    const contact = await db.clientContact.findUniqueOrThrow({ where: { id: id.parse(body.contactId) } });
    if (project.clientId !== contact.clientId) return c.json<ActionResult>({ ok: false, error: "That contact belongs to another client." });
    if (!contact.portalAccess) return c.json<ActionResult>({ ok: false, error: "Invite them to the portal first." });
    await db.projectContact.upsert({
      where: { projectId_contactId: { projectId: project.id, contactId: contact.id } },
      create: { projectId: project.id, contactId: contact.id },
      update: {},
    });
    return c.json<ActionResult>({ ok: true });
  })
  /** Take this one project away without touching their login or other projects. */
  .post("/contacts/unshare", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ contactId: string; projectId: string }>();
    const project = await projectFor(user, "update", body.projectId);
    await db.projectContact.deleteMany({ where: { projectId: project.id, contactId: id.parse(body.contactId) } });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/contacts/revoke", async (c) => {
    const user = c.get("user");
    const { contactId } = await c.req.json<{ contactId: string }>();
    const contact = await db.clientContact.findUniqueOrThrow({ where: { id: id.parse(contactId) }, include: { client: { include: { companies: true } } } });
    contact.client.companies.forEach((x: any) => assertCan(user, "update", "client", x.companyId));
    await db.clientContact.update({ where: { id: contact.id }, data: { portalAccess: false } });
    if (contact.userId) await db.session.deleteMany({ where: { userId: contact.userId } });
    return c.json<ActionResult>({ ok: true });
  })
  /**
   * Hard delete, for a project started by mistake. Refused once anyone has logged time or
   * invoiced against it, since that history would go with it.
   */
  .post("/delete", async (c) => {
    const user = c.get("user");
    const { projectId } = await c.req.json<{ projectId: string }>();
    const project = await projectFor(user, "delete", projectId);
    const [time, invoices] = await Promise.all([
      db.timeEntry.count({ where: { projectId: project.id } }),
      db.invoice.count({ where: { projectId: project.id } }),
    ]);
    if (time || invoices) {
      const held = [time && `${time} time entr${time > 1 ? "ies" : "y"}`, invoices && `${invoices} invoice${invoices > 1 ? "s" : ""}`].filter(Boolean);
      return c.json<ActionResult>({ ok: false, error: `${project.name} has ${held.join(" and ")} against it. Mark it cancelled instead.` });
    }
    // Tasks, deliverables, milestones and notes belong to the project and go with it.
    await db.$transaction([
      db.task.deleteMany({ where: { projectId: project.id } }),
      db.project.delete({ where: { id: project.id } }),
      db.activity.create({ data: { companyId: project.companyId, actorId: user.id, verb: "deleted", entityType: "PROJECT", entityId: project.id, summary: `${user.name} deleted project ${project.name}` } }),
    ]);
    return c.json<ActionResult>({ ok: true });
  });
