// Ported from app/(app)/calendar/{page.tsx,actions.ts}. Query and mutation bodies are
// unchanged; only the context and input plumbing differs. refresh() is gone — the
// frontend invalidates its query after a successful mutation instead.
import { Hono } from "hono";
import { z } from "zod";
import { staffContext, type Env } from "../context";
import { assertCan, can } from "@/lib/auth/permissions";
import { addDays, now, startOfWeekIST } from "@/lib/clock";
import { db } from "@/lib/db";
import { dayKey, parseDay } from "@/lib/period";
import type { ActionResult } from "@/lib/validation/result";

export const calendar = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const user = c.get("user");
    const companyIds = c.get("companyIds");
    const week = startOfWeekIST(parseDay(c.req.query("week")) ?? now());
    const [events, clients] = await Promise.all([
      db.calendarEvent.findMany({ where: { OR: [{ companyId: { in: companyIds } }, { companyId: null }], start: { gte: week, lt: addDays(week, 7) } }, orderBy: { start: "asc" }, include: { client: { select: { name: true } }, project: { select: { name: true } } } }),
      db.client.findMany({ where: { archivedAt: null, companies: { some: { companyId: { in: companyIds } } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    // Events are created and removed under the "task" right (see the routes below).
    return c.json({ week: dayKey(week), events, clients, companies: companyIds, canDelete: can(user, "delete", "task") });
  })
  .post("/events", async (c) => {
    const user = c.get("user");
    const d = z.object({ title: z.string().trim().min(1).max(160), type: z.enum(["CALL", "REVIEW", "FOLLOW_UP", "MEETING"]), companyId: z.enum(["vmh", "vth", ""]), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.string().regex(/^\d{2}:\d{2}$/), minutes: z.number().int().min(5).max(600), clientId: z.string().max(64).optional(), projectId: z.string().max(64).optional() }).safeParse(await c.req.json());
    if (!d.success) return c.json<ActionResult>({ ok: false, error: d.error.issues[0]!.message });
    assertCan(user, "create", "task", d.data.companyId || undefined);
    const start = new Date(`${d.data.date}T${d.data.start}:00+05:30`);
    await db.calendarEvent.create({ data: { title: d.data.title, type: d.data.type, companyId: d.data.companyId || null, start, end: new Date(start.getTime() + d.data.minutes * 60_000), clientId: d.data.clientId || null, projectId: d.data.projectId || null, attendeeIds: [user.id] } });
    return c.json<ActionResult>({ ok: true });
  })

  .post("/events/delete", async (c) => {
    const user = c.get("user");
    const { eventId } = await c.req.json<{ eventId: string }>();
    const event = await db.calendarEvent.findUniqueOrThrow({ where: { id: z.string().max(64).parse(eventId) } });
    // Events are created under the "task" right (see the create above), so deleting one
    // uses the same subject rather than inventing a permission the matrix doesn't have.
    assertCan(user, "delete", "task", event.companyId ?? undefined);
    await db.$transaction([
      db.calendarEvent.delete({ where: { id: event.id } }),
      db.activity.create({ data: { companyId: event.companyId, actorId: user.id, verb: "deleted", entityType: "EVENT", entityId: event.id, summary: `${user.name} deleted event ${event.title}` } }),
    ]);
    return c.json<ActionResult>({ ok: true });
  });
