// Ported from app/(app)/team/{page.tsx,[id]/page.tsx,actions.ts}.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { auth } from "../auth";
import { staffContext, type Env } from "../context";
import { logActivity } from "@/lib/activity";
import { assertCan, can } from "@/lib/auth/permissions";
import { addDays, now, startOfWeekIST } from "@/lib/clock";
import { db } from "@/lib/db";
import * as M from "@/lib/metrics/dashboard";
import type { ActionResult } from "@/lib/validation/result";

const roles = z.enum(["ADMIN", "MANAGER", "MEMBER"]);

export const team = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const user = c.get("user");
    const companyIds = c.get("companyIds");
    if (!can(user, "view", "team")) return c.json({ allowed: false as const });
    const [workload, users, tasks] = await Promise.all([
      M.teamWorkload({ companyIds }),
      db.user.findMany({ where: { kind: "STAFF", memberships: { some: { companyId: { in: companyIds } } } }, include: { memberships: true }, orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }] }),
      db.task.groupBy({ by: ["assigneeId"], _count: true, where: { companyId: { in: companyIds }, status: { not: "COMPLETED" } } }),
    ]);
    const invitable = companyIds.filter((x) => can(user, "create", "team", x));
    return c.json({
      allowed: true as const,
      invitable,
      workload,
      users: users.map((u) => ({ id: u.id, name: u.name, image: u.image, active: u.active, isOwner: u.isOwner, title: u.title, weeklyCapacityHours: u.weeklyCapacityHours, memberships: u.memberships.map((m) => ({ companyId: m.companyId, role: m.role, modules: m.modules })) })),
      tasks: tasks.map((t) => ({ assigneeId: t.assigneeId, count: t._count })),
    });
  })
  .get("/:id", async (c) => {
    const viewer = c.get("user");
    const companyIds = c.get("companyIds");
    const id = c.req.param("id");
    const u = await db.user.findFirst({ where: { id, kind: "STAFF", memberships: { some: { companyId: { in: companyIds } } } }, include: { memberships: true } });
    if (!u) throw new HTTPException(404, { message: "No such team member." });
    const t = now();
    const week = startOfWeekIST(t);
    const [tasks, time, goals, activity] = await Promise.all([
      db.task.findMany({ where: { assigneeId: id, status: { not: "COMPLETED" }, companyId: { in: companyIds } }, orderBy: { dueDate: "asc" }, take: 15, include: { project: { select: { name: true } } } }),
      db.timeEntry.findMany({ where: { userId: id, start: { gte: addDays(week, -21) }, companyId: { in: companyIds } }, orderBy: { start: "desc" }, take: 20, include: { project: { select: { name: true } } } }),
      db.goal.findMany({ where: { OR: [{ ownerId: id }, { members: { some: { userId: id } } }] , endDate: { gte: addDays(t, -30) } } }),
      db.activity.findMany({ where: { actorId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
    ]);
    const weekMin = time.filter((e) => e.start >= week).reduce((a, e) => a + (e.durationMin ?? 0), 0);
    const editable = !u.isOwner && u.memberships.every((m) => can(viewer, "update", "team", m.companyId));
    return c.json({
      user: { id: u.id, name: u.name, email: u.email, image: u.image, isOwner: u.isOwner, title: u.title, active: u.active, weeklyCapacityHours: u.weeklyCapacityHours, memberships: u.memberships.map((m) => ({ companyId: m.companyId, role: m.role, modules: m.modules })) },
      tasks, time, goals, activity, weekMin, editable, companyIds,
    });
  })
  /** Invite a staff member: creates the account + memberships and emails a set-password link. */
  .post("/invite", async (c) => {
    const user = c.get("user");
    const d = z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().toLowerCase().email().max(200), title: z.string().trim().max(120).optional(), capacity: z.number().int().min(1).max(80), memberships: z.array(z.object({ companyId: z.enum(["vmh", "vth"]), role: roles })).min(1, "Pick a company") }).safeParse(await c.req.json());
    if (!d.success) return c.json<ActionResult>({ ok: false, error: d.error.issues[0]!.message });
    d.data.memberships.forEach((m) => assertCan(user, "create", "team", m.companyId));
    if (await db.user.findUnique({ where: { email: d.data.email } })) return c.json<ActionResult>({ ok: false, error: "Someone with that email already has an account." });
    const member = await db.user.create({ data: { name: d.data.name, email: d.data.email, title: d.data.title, weeklyCapacityHours: d.data.capacity, emailVerified: true, memberships: { create: d.data.memberships } } });
    await auth.api.requestPasswordReset({ body: { email: member.email, redirectTo: "/reset-password" } });
    await logActivity(db, { companyId: null, actorId: user.id, verb: "invited", entityType: "CLIENT", entityId: member.id, summary: `${user.name} invited ${member.name} to the team` });
    return c.json<ActionResult>({ ok: true, id: member.id });
  })
  .post("/update", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ userId: string; input: { title?: string; capacity?: number; active?: boolean; memberships?: { companyId: string; role: string }[] } }>();
    const target = await db.user.findUniqueOrThrow({ where: { id: z.string().max(64).parse(body.userId) }, include: { memberships: true } });
    if (target.isOwner) throw new Error("The owner's access can't be changed here.");
    const d = z.object({ title: z.string().max(120).optional(), capacity: z.number().int().min(1).max(80).optional(), active: z.boolean().optional(), memberships: z.array(z.object({ companyId: z.enum(["vmh", "vth"]), role: roles })).optional() }).parse(body.input);
    [...target.memberships.map((m) => m.companyId), ...(d.memberships?.map((m) => m.companyId) ?? [])].forEach((x) => assertCan(user, "update", "team", x));
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data: { title: d.title, weeklyCapacityHours: d.capacity, active: d.active } });
      if (d.memberships) {
        await tx.membership.deleteMany({ where: { userId: target.id } });
        await tx.membership.createMany({ data: d.memberships.map((m) => ({ ...m, userId: target.id })) });
      }
      if (d.active === false) await tx.session.deleteMany({ where: { userId: target.id } });
    });
    return c.json<ActionResult>({ ok: true });
  });
