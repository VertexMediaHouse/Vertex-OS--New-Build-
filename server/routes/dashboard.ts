// Ported from app/(app)/dashboard/{page.tsx,actions.ts}. The page's cards were async
// server components that each awaited one metric; the GET below resolves them all at
// once and the cards now take the values as props.
import { Hono } from "hono";
import { z } from "zod";
import { staffContext, type Env } from "../context";
import { logActivity } from "@/lib/activity";
import { assertCan, can, isMemberOnly, roleLabel } from "@/lib/auth/permissions";
import { now } from "@/lib/clock";
import { db } from "@/lib/db";
import * as M from "@/lib/metrics/dashboard";
import { resolvePeriod } from "@/lib/period";
import type { ActionResult } from "@/lib/validation/result";

const id = z.string().min(1).max(64);

const TASK_FILTERS = ["today", "overdue", "week", "all"] as const;

const noteSchema = z.object({
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(1, "Write something first.").max(4000),
  companyId: z.enum(["vmh", "vth", ""]).optional(),
});

/** Notes are personal: you only ever read, write or delete your own. */
async function myNote(userId: string, noteId: string) {
  const note = await db.note.findUniqueOrThrow({ where: { id: id.parse(noteId) } });
  if (note.authorId !== userId) throw new Error("That note belongs to someone else.");
  return note;
}

export const dashboard = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const user = c.get("user");
    const scope = c.get("scope");
    const ctx = { user, scope, companyIds: c.get("companyIds") };
    const period = resolvePeriod({ range: c.req.query("range") ?? null, from: c.req.query("from") ?? null, to: c.req.query("to") ?? null }, now());
    const taskFilter = (TASK_FILTERS as readonly string[]).includes(c.req.query("tasks") ?? "") ? (c.req.query("tasks") as M.TaskFilter) : "today";
    const isMember = isMemberOnly(user);
    const canViewInvoice = can(user, "view", "invoice");
    const canViewLead = can(user, "view", "lead");
    const isOwnerScope = scope === "ALL";

    // Baseline metrics required by all dashboards
    const [openTasks, projects, taskSummary, notes, goals, agenda, myHours] = await Promise.all([
      M.openTasks(ctx, taskFilter),
      M.projectSummary(ctx, period),
      M.taskSummary(ctx, period),
      M.notes(ctx, user.id),
      M.goalsProgress(ctx),
      M.todaysAgenda(ctx),
      M.myLoggedHours(user, ctx),
    ]);

    // Role- and scope-specific metrics (only computed when visible in UI)
    const emptyRevenue = { total: 0, trend: 0, collected: 0, outstanding: 0, vmh: 0, vth: 0 };
    const emptyLeads = { total: 0, delta: 0, stages: [] as { stage: string; count: number }[], pipeline: 0, vmh: 0, vth: 0 };

    const [revenue, leads, tasksByPerson, campaigns, workload, crossSell, revenueTrend] = isMember
      ? [emptyRevenue, emptyLeads, [], [], [], [], []]
      : await Promise.all([
          canViewInvoice ? M.revenueSummary(ctx, period) : Promise.resolve(emptyRevenue),
          canViewLead ? M.leadSummary(ctx, period) : Promise.resolve(emptyLeads),
          M.tasksByPerson(ctx),
          isOwnerScope ? M.activeCampaigns(ctx) : Promise.resolve([]),
          M.teamWorkload(ctx),
          isOwnerScope ? M.crossSellAlerts(ctx) : Promise.resolve([]),
          !isOwnerScope && canViewInvoice ? M.revenueTrend(ctx) : Promise.resolve([]),
        ]);

    // leadsPipeline reuses leads (pipeline value and stage breakdown are identical, avoiding duplicate queries)
    const leadsPipeline = leads;

    return c.json({
      scope,
      name: user.name,
      role: roleLabel(user),
      title: user.title,
      isMember: isMemberOnly(user),
      canViewInvoice: can(user, "view", "invoice"),
      canViewLead: can(user, "view", "lead"),
      companyIds: ctx.companyIds,
      period: { preset: period.preset, from: period.from, to: period.to },
      taskFilter,
      revenue, projects, taskSummary, leads, openTasks, tasksByPerson, notes, goals, campaigns, workload, agenda, crossSell, revenueTrend, leadsPipeline, myHours,
    });
  })
  /** Turns a cross-sell alert into a NEW lead in the other company, prefilled with the client. */
  .post("/opportunities", async (c) => {
    const user = c.get("user");
    const { alertId } = await c.req.json<{ alertId: string }>();
    const alert = await db.crossSellAlert.findUniqueOrThrow({ where: { id: id.parse(alertId) }, include: { client: true } });
    assertCan(user, "create", "lead", alert.toCompanyId);
    if (alert.status !== "OPEN") return c.json<ActionResult>({ ok: true });
    await db.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: { companyId: alert.toCompanyId, name: alert.client.name, clientId: alert.clientId, service: alert.toCompanyId === "vth" ? "Website / CRM" : "Video Content", value: 0, stage: "NEW", source: "REFERRAL", ownerId: user.id, notes: `Cross-sell: ${alert.reason}` },
      });
      await tx.crossSellAlert.update({ where: { id: alert.id }, data: { status: "CONVERTED", leadId: lead.id } });
      await logActivity(tx, { companyId: alert.toCompanyId, actorId: user.id, verb: "created", entityType: "LEAD", entityId: lead.id, summary: `${user.name} created a cross-sell opportunity for ${alert.client.name}` });
    });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/alerts/dismiss", async (c) => {
    const user = c.get("user");
    const { alertId } = await c.req.json<{ alertId: string }>();
    const alert = await db.crossSellAlert.findUniqueOrThrow({ where: { id: id.parse(alertId) } });
    assertCan(user, "update", "lead", alert.toCompanyId);
    await db.crossSellAlert.update({ where: { id: alert.id }, data: { status: "DISMISSED" } });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/notes", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ noteId: string | null; input: z.input<typeof noteSchema> }>();
    const parsed = noteSchema.safeParse(body.input);
    if (!parsed.success) return c.json<ActionResult>({ ok: false, error: parsed.error.issues[0]!.message });
    const { companyId, title, body: text } = parsed.data;
    const data = { title: title || null, body: text, companyId: companyId || null };
    if (body.noteId) {
      await myNote(user.id, body.noteId);
      await db.note.update({ where: { id: body.noteId }, data });
    } else {
      await db.note.create({ data: { ...data, authorId: user.id } });
    }
    return c.json<ActionResult>({ ok: true });
  })
  .post("/notes/delete", async (c) => {
    const { noteId } = await c.req.json<{ noteId: string }>();
    const note = await myNote(c.get("user").id, noteId);
    await db.note.delete({ where: { id: note.id } });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/notes/pin", async (c) => {
    const { noteId, pinned } = await c.req.json<{ noteId: string; pinned: boolean }>();
    const note = await myNote(c.get("user").id, noteId);
    await db.note.update({ where: { id: note.id }, data: { pinned } });
    return c.json<ActionResult>({ ok: true });
  });
