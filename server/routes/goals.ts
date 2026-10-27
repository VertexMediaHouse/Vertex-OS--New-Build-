// Ported from app/(app)/goals/{page.tsx,actions.ts}. The page's period maths and
// filtering stay on the client; the Prisma reads and every mutation live here.
import { Hono } from "hono";
import { z } from "zod";
import { staffContext, type Env } from "../context";
import { logActivity } from "@/lib/activity";
import { assertCan, can, isMemberOnly, type CurrentUser } from "@/lib/auth/permissions";
import { addMonthsIST, now, startOfMonthIST } from "@/lib/clock";
import { db, Prisma } from "@/lib/db";
import { recomputeGoals } from "@/lib/jobs/goals";
import { formatRelative } from "@/lib/format";
import { goalProgress } from "@/lib/metrics/goals";
import { parseDay } from "@/lib/period";
import type { ActionResult } from "@/lib/validation/result";

const id = z.string().min(1).max(64);

const goalSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  subtitle: z.string().trim().max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  companyId: z.enum(["vmh", "vth", ""]),
  scope: z.enum(["COMPANY", "TEAM", "PERSONAL"]),
  category: z.enum(["REVENUE_SALES", "CLIENT_ACQUISITION", "PROJECT_DELIVERY", "PRODUCT_DEVELOPMENT", "TEAM_HIRING", "PROCESS_AUTOMATION", "CONTENT_CREATION", "CLIENT_SUCCESS", "LEARNING_GROWTH"]),
  metricType: z.enum(["MANUAL", "REVENUE", "NEW_CLIENTS", "PROJECTS_COMPLETED", "VIDEOS_DELIVERED", "LEADS_WON", "BILLABLE_HOURS"]),
  unit: z.enum(["CURRENCY", "COUNT", "PERCENT", "HOURS"]),
  targetValue: z.coerce.number().positive().max(1e12),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  memberIds: z.array(id).max(50).default([]),
});

async function goalFor(user: CurrentUser, goalId: string) {
  const goal = await db.goal.findUniqueOrThrow({ where: { id: id.parse(goalId) }, include: { members: true } });
  const mine = goal.ownerId === user.id || goal.members.some((m: any) => m.userId === user.id);
  if (!mine) assertCan(user, "update", "goal", goal.companyId ?? undefined);
  return goal;
}

export const goals = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const user = c.get("user");
    const companyIds = c.get("companyIds");
    if (!can(user, "view", "goal")) return c.json({ denied: true as const });
    const t = now();
    // Default period: this quarter-ish window (this month + 2), like "Oct 2026 - Dec 2026".
    const from = parseDay(c.req.query("from")) ?? startOfMonthIST(t);
    const toParam = parseDay(c.req.query("to"));
    const to = toParam ? new Date(toParam.getTime() + 86_400_000) : addMonthsIST(startOfMonthIST(t), 3);
    const base: Prisma.GoalWhereInput = { OR: [{ companyId: { in: companyIds } }, { companyId: null }], startDate: { lt: to }, endDate: { gte: from } };
    const rows = await db.goal.findMany({ where: base, orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { owner: { select: { name: true, image: true } }, members: { include: { user: { select: { id: true, name: true, image: true } } } } } });
    const people = await db.user.findMany({ where: { kind: "STAFF", memberships: { some: { companyId: { in: companyIds } } } }, select: { id: true, name: true } });
    return c.json({
      denied: false as const,
      rows: rows.map((g) => ({ ...g, progress: goalProgress(g) })),
      people,
      from: from.toISOString(),
      to: to.toISOString(),
      scope: c.get("scope"),
      userId: user.id,
      memberOnly: isMemberOnly(user),
      canCreate: can(user, "create", "goal"),
      companies: companyIds.filter((x): x is "vmh" | "vth" => x === "vmh" || x === "vth"),
    });
  })
  /** Milestones and activity for the open goal. */
  .get("/:id/panel", async (c) => {
    const user = c.get("user");
    const goalId = c.req.param("id");
    const [milestones, rows] = await Promise.all([
      db.goalMilestone.findMany({ where: { goalId }, orderBy: [{ order: "asc" }, { date: "asc" }] }),
      db.activity.findMany({ where: { entityType: "GOAL", entityId: goalId }, orderBy: { createdAt: "desc" }, take: 6, include: { actor: { select: { name: true, image: true } } } }),
    ]);
    const t = now();
    return c.json({
      milestones,
      activity: rows.map((a) => ({ id: a.id, actor: a.actor, summary: a.summary, time: formatRelative(a.createdAt, t) })),
      canUpdate: can(user, "update", "goal"),
    });
  })
  .post("/", async (c) => {
    const user = c.get("user");
    const parsed = goalSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json<ActionResult>({ ok: false, error: parsed.error.issues[0]!.message });
    const { memberIds, companyId, ...d } = parsed.data;
    if (d.endDate <= d.startDate) return c.json<ActionResult>({ ok: false, error: "End date must be after the start date." });
    assertCan(user, "update", "goal", companyId || undefined);
    if (companyId === "" || d.scope === "COMPANY") assertCan(user, "create", "goal", companyId || undefined);
    // A self-tracking goal reads revenue, clients, leads or hours, so it needs more than the
    // "update goal" right a member has: otherwise it's a side door into the money figures.
    if (d.metricType !== "MANUAL") assertCan(user, "create", "goal", companyId || undefined);
    const goal = await db.goal.create({ data: { ...d, companyId: companyId || null, ownerId: user.id, members: { create: memberIds.map((userId) => ({ userId })) } } });
    await logActivity(db, { companyId: goal.companyId, actorId: user.id, verb: "created", entityType: "GOAL", entityId: goal.id, summary: `${user.name} created goal ${goal.title}` });
    await recomputeGoals(db, now(), { id: goal.id });
    return c.json<ActionResult>({ ok: true, id: goal.id });
  })
  .post("/:id/progress", async (c) => {
    const user = c.get("user");
    const goal = await goalFor(user, c.req.param("id"));
    if (goal.metricType !== "MANUAL") return c.json<ActionResult>({ ok: false, error: "This goal tracks itself from live data." });
    const v = z.number().min(0).max(1e12).parse((await c.req.json<{ value: number }>()).value);
    await db.goal.update({ where: { id: goal.id }, data: { currentValue: v } });
    await recomputeGoals(db, now(), { id: goal.id });
    const pct = Math.round((v / Number(goal.targetValue)) * 100);
    await logActivity(db, { companyId: goal.companyId, actorId: user.id, verb: "updated", entityType: "GOAL", entityId: goal.id, summary: `${user.name} updated progress to ${pct}%` });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/:id/milestones", async (c) => {
    const goal = await goalFor(c.get("user"), c.req.param("id"));
    const body = await c.req.json<{ title: string; date: string }>();
    const count = await db.goalMilestone.count({ where: { goalId: goal.id } });
    await db.goalMilestone.create({ data: { goalId: goal.id, title: z.string().trim().min(1).max(160).parse(body.title), date: z.coerce.date().parse(body.date), order: count } });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/milestones/:milestoneId/toggle", async (c) => {
    const user = c.get("user");
    const m = await db.goalMilestone.findUniqueOrThrow({ where: { id: id.parse(c.req.param("milestoneId")) } });
    const goal = await goalFor(user, m.goalId);
    const done = z.boolean().parse((await c.req.json<{ done: boolean }>()).done);
    await db.goalMilestone.update({ where: { id: m.id }, data: { done } });
    if (done) await logActivity(db, { companyId: goal.companyId, actorId: user.id, verb: "milestone", entityType: "GOAL", entityId: goal.id, summary: `${user.name} marked milestone as completed` });
    return c.json<ActionResult>({ ok: true });
  });
