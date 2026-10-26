// Ported from app/(app)/calendar/{page.tsx,actions.ts}. Query and mutation bodies are
// unchanged; only the context and input plumbing differs. refresh() is gone — the
// frontend invalidates its query after a successful mutation instead.
import { Hono } from "hono";
import { z } from "zod";
import { staffContext, type Env } from "../context";
import { assertCan } from "@/lib/auth/permissions";
import { addDays, now, startOfWeekIST } from "@/lib/clock";
import { db } from "@/lib/db";
import { dayKey, parseDay } from "@/lib/period";
import type { ActionResult } from "@/lib/validation/result";

export const calendar = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const companyIds = c.get("companyIds");
    const week = startOfWeekIST(parseDay(c.req.query("week")) ?? now());
    const [events, clients] = await Promise.all([
      db.calendarEvent.findMany({ where: { OR: [{ companyId: { in: companyIds } }, { companyId: null }], start: { gte: week, lt: addDays(week, 7) } }, orderBy: { start: "asc" }, include: { client: { select: { name: true } }, project: { select: { name: true } } } }),
      db.client.findMany({ where: { archivedAt: null, companies: { some: { companyId: { in: companyIds } } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    return c.json({ week: dayKey(week), events, clients, companies: companyIds });
  })
  .post("/events", async (c) => {
    const user = c.get("user");
    const d = z.object({ title: z.string().trim().min(1).max(160), type: z.enum(["CALL", "REVIEW", "FOLLOW_UP", "MEETING"]), companyId: z.enum(["vmh", "vth", ""]), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.string().regex(/^\d{2}:\d{2}$/), minutes: z.number().int().min(5).max(600), clientId: z.string().max(64).optional(), projectId: z.string().max(64).optional() }).safeParse(await c.req.json());
    if (!d.success) return c.json<ActionResult>({ ok: false, error: d.error.issues[0]!.message });
    assertCan(user, "create", "task", d.data.companyId || undefined);
    const start = new Date(`${d.data.date}T${d.data.start}:00+05:30`);
    await db.calendarEvent.create({ data: { title: d.data.title, type: d.data.type, companyId: d.data.companyId || null, start, end: new Date(start.getTime() + d.data.minutes * 60_000), clientId: d.data.clientId || null, projectId: d.data.projectId || null, attendeeIds: [user.id] } });
    return c.json<ActionResult>({ ok: true });
  });
