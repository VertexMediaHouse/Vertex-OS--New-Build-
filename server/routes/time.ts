// Ported from app/(app)/time/actions.ts. Bodies are unchanged; the request context is
// passed in explicitly and refresh() is gone (the frontend invalidates instead).
import { Hono } from "hono";
import { z } from "zod";
import { staffContext, type Env } from "../context";
import { logActivity } from "@/lib/activity";
import { assertCan, can, isMemberOnly, type CurrentUser } from "@/lib/auth/permissions";
import { addDays, now, startOfDayIST, startOfWeekIST } from "@/lib/clock";
import { toCsv } from "@/lib/csv";
import { db, type Prisma } from "@/lib/db";
import { formatShortDate } from "@/lib/format";
import { dayKey, resolvePeriod } from "@/lib/period";
import { readParams, subScope } from "@/lib/search-params";
import type { ActionResult } from "@/lib/validation/result";

const id = z.string().min(1).max(64);

/** Stops any running timer for the user; returns the stopped entry. */
async function stopRunning(userId: string) {
  const running = await db.timeEntry.findFirst({ where: { userId, status: "RUNNING" } });
  if (!running) return null;
  const end = new Date();
  const durationMin = Math.max(1, Math.round((end.getTime() - running.start.getTime()) / 60_000));
  return db.timeEntry.update({ where: { id: running.id }, data: { end, durationMin, status: "PENDING" }, include: { task: { select: { title: true } }, project: { select: { name: true } } } });
}

const manualSchema = z.object({
  projectId: id,
  taskId: id.optional().or(z.literal("")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().trim().min(1, "Say what you worked on").max(500),
  billable: z.boolean(),
});

async function entryFor(user: CurrentUser, entryId: string, action: "update" | "approve") {
  const entry = await db.timeEntry.findUniqueOrThrow({ where: { id: id.parse(entryId) } });
  assertCan(user, action, "time", entry.companyId);
  if (action === "update" && entry.userId !== user.id) assertCan(user, "approve", "time", entry.companyId);
  if (entry.invoiceId) throw new Error("This entry is already on an invoice.");
  return entry;
}

export const time = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const user = c.get("user");
    const companyIds = c.get("companyIds");
    if (!can(user, "view", "time")) return c.json({ allowed: false as const });
    const p = readParams(c.req.query());
    const t = now();
    const unit = p.str("view") ?? "week";
    const period = p.str("range") || p.str("from") ? p.period : resolvePeriod({}, t, "month");
    const mine = isMemberOnly(user);
    const base: Prisma.TimeEntryWhereInput = { companyId: { in: companyIds }, ...(mine && { userId: user.id }), status: { not: "RUNNING" } };
    const inP = { ...base, start: { gte: period.from, lt: period.to } };
    const prevP = { ...base, start: { gte: period.prevFrom, lt: period.prevTo } };
    const q = p.str("q");
    const sheetWhere: Prisma.TimeEntryWhereInput = {
      ...inP,
      companyId: { in: subScope(companyIds, p.str("co")) },
      ...(p.str("member") && { userId: p.str("member")! }),
      ...(p.str("project") && { projectId: p.str("project")! }),
      ...(p.str("status") === "NON_BILLABLE" ? { billable: false } : p.str("status") ? { status: p.str("status") as "APPROVED" } : {}),
      // ?cat= is what the "Hours by Project Type" donut links to; MEETINGS lives on the entry.
      ...(p.str("cat") === "MEETINGS" ? { category: "MEETINGS" as const } : p.str("cat") ? { project: { category: p.str("cat") as "DESIGN" } } : {}),
      ...(q && { OR: [{ note: { contains: q, mode: "insensitive" } }, { task: { title: { contains: q, mode: "insensitive" } } }, { project: { name: { contains: q, mode: "insensitive" } } }, { user: { name: { contains: q, mode: "insensitive" } } }] }),
    };
    const weekStart = startOfWeekIST(t);
    const chartFrom = unit === "day" ? startOfDayIST(t) : unit === "month" ? period.from : weekStart;
    const chartTo = unit === "day" ? addDays(chartFrom, 1) : unit === "month" ? period.to : addDays(weekStart, 7);
    const [agg, prevAgg, members, sheet, chartRows, team, recent, logs, projects, people] = await Promise.all([
      db.timeEntry.groupBy({ by: ["companyId", "billable"], _sum: { durationMin: true }, where: inP }),
      db.timeEntry.groupBy({ by: ["billable"], _sum: { durationMin: true }, where: prevP }),
      db.timeEntry.groupBy({ by: ["companyId", "userId"], where: { ...inP, user: { isOwner: false } } }),
      db.timeEntry.findMany({ where: sheetWhere, orderBy: { start: "desc" }, take: 50, include: { user: { select: { name: true, image: true } }, project: { select: { name: true, client: { select: { name: true } } } }, task: { select: { title: true } } } }),
      db.timeEntry.findMany({ where: { ...base, start: { gte: chartFrom, lt: chartTo } }, select: { start: true, durationMin: true, companyId: true, category: true, project: { select: { category: true } } } }),
      db.timeEntry.groupBy({ by: ["userId"], _sum: { durationMin: true }, where: { ...base, start: { gte: weekStart, lt: addDays(weekStart, 7) }, user: { isOwner: false } } }),
      db.timeEntry.findMany({ where: base, orderBy: { start: "desc" }, take: 4, include: { user: { select: { name: true, image: true } }, task: { select: { title: true } }, project: { select: { name: true, client: { select: { name: true } } } } } }),
      db.activity.findMany({ where: { entityType: "TIME_ENTRY", OR: [{ companyId: { in: companyIds } }, { companyId: null }] }, orderBy: { createdAt: "desc" }, take: 4, include: { actor: { select: { name: true } } } }),
      db.project.findMany({ where: { companyId: { in: companyIds }, status: { not: "COMPLETED" }, ...(mine && { members: { some: { userId: user.id } } }) }, select: { id: true, name: true, client: { select: { name: true } }, tasks: { where: { status: { not: "COMPLETED" } }, select: { id: true, title: true } } }, orderBy: { name: "asc" } }),
      db.user.findMany({ where: { kind: "STAFF", isOwner: false, memberships: { some: { companyId: { in: companyIds } } } }, select: { id: true, name: true, image: true, weeklyCapacityHours: true }, orderBy: { createdAt: "asc" } }),
    ]);

    const buckets = unit === "month"
      ? Array.from({ length: Math.ceil((chartTo.getTime() - chartFrom.getTime()) / (7 * 86_400_000)) }, (_, i) => ({ from: addDays(chartFrom, i * 7), to: addDays(chartFrom, Math.min((i + 1) * 7, (chartTo.getTime() - chartFrom.getTime()) / 86_400_000)), label: `Week ${i + 1}` }))
      : unit === "day" ? [{ from: chartFrom, to: chartTo, label: "Today" }]
      : Array.from({ length: 7 }, (_, i) => ({ from: addDays(chartFrom, i), to: addDays(chartFrom, i + 1), label: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Asia/Kolkata" }).format(addDays(chartFrom, i)) }));
    const chart = buckets.map((b) => {
      const rows = chartRows.filter((r) => r.start >= b.from && r.start < b.to);
      const h = (co: string) => Math.round((rows.filter((r) => r.companyId === co).reduce((a, r) => a + (r.durationMin ?? 0), 0) / 60) * 10) / 10;
      return { day: b.label, VMH: h("vmh"), VTH: h("vth") };
    });
    const tickLines = Object.fromEntries(buckets.map((b) => [b.label, unit === "month" ? `${formatShortDate(b.from)} - ${formatShortDate(addDays(b.to, -1))}` : formatShortDate(b.from)]));
    const cats: Record<string, number> = {};
    for (const r of chartRows) { const x = r.category ?? r.project?.category ?? "OTHER"; cats[x] = (cats[x] ?? 0) + (r.durationMin ?? 0); }

    return c.json({
      allowed: true as const,
      scope: c.get("scope"),
      mine,
      unit,
      period: { preset: period.preset, from: period.from, to: period.to },
      agg: agg.map((r) => ({ companyId: r.companyId, billable: r.billable, minutes: Number(r._sum.durationMin ?? 0) })),
      prevAgg: prevAgg.map((r) => ({ billable: r.billable, minutes: Number(r._sum.durationMin ?? 0) })),
      members: members.map((r) => ({ companyId: r.companyId, userId: r.userId })),
      sheet, chart, tickLines, cats,
      chartMins: chartRows.reduce((a, r) => a + (r.durationMin ?? 0), 0),
      chartByCompany: { vmh: chartRows.filter((r) => r.companyId === "vmh").reduce((a, r) => a + (r.durationMin ?? 0), 0), vth: chartRows.filter((r) => r.companyId === "vth").reduce((a, r) => a + (r.durationMin ?? 0), 0) },
      team: team.map((r) => ({ userId: r.userId, minutes: Number(r._sum.durationMin ?? 0) })),
      recent, logs, projects, people,
      canApprove: companyIds.some((x) => can(user, "approve", "time", x)),
    });
  })
  /** CSV timesheet for the selected period and filters. */
  .get("/export", async (c) => {
    const user = c.get("user");
    const p = readParams(c.req.query());
    const rows = await db.timeEntry.findMany({
      where: {
        companyId: { in: subScope(c.get("companyIds"), p.str("co")) },
        start: { gte: p.period.from, lt: p.period.to },
        status: { not: "RUNNING" },
        ...(isMemberOnly(user) ? { userId: user.id } : p.str("member") ? { userId: p.str("member")! } : {}),
        ...(p.str("project") && { projectId: p.str("project")! }),
      },
      orderBy: { start: "asc" },
      include: { user: { select: { name: true } }, project: { select: { name: true, client: { select: { name: true } } } }, task: { select: { title: true } } },
    });
    const csv = toCsv(
      ["Date", "Team Member", "Client", "Project", "Task", "Company", "Start", "End", "Minutes", "Billable", "Status", "Note"],
      rows.map((e) => [dayKey(e.start), e.user.name, e.project?.client?.name ?? "Internal", e.project?.name, e.task?.title, e.companyId.toUpperCase(), e.start.toISOString(), e.end?.toISOString(), e.durationMin, e.billable ? "yes" : "no", e.status, e.note]),
    );
    return c.body(csv, 200, { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="timesheet.csv"' });
  })
  /** One running timer per user, stored on the server (survives reloads and devices). */
  .post("/start", async (c) => {
    const user = c.get("user");
    const d = z.object({ projectId: id, taskId: id.optional().or(z.literal("")), note: z.string().trim().max(500).optional() }).parse(await c.req.json());
    const project = await db.project.findUniqueOrThrow({ where: { id: d.projectId }, include: { client: { select: { name: true } } } });
    assertCan(user, "create", "time", project.companyId);
    await stopRunning(user.id);
    const task = d.taskId ? await db.task.findFirst({ where: { id: d.taskId, projectId: project.id } }) : null;
    await db.$transaction(async (tx) => {
      const e = await tx.timeEntry.create({ data: { userId: user.id, companyId: project.companyId, projectId: project.id, taskId: task?.id, start: new Date(), status: "RUNNING", note: d.note, billable: Boolean(project.clientId) } });
      await logActivity(tx, { companyId: project.companyId, actorId: user.id, verb: "timer_started", entityType: "TIME_ENTRY", entityId: e.id, summary: `${user.name} started tracking time`, meta: { detail: `${task?.title ?? project.name} — ${project.client?.name ?? "Internal"}` } });
    });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/stop", async (c) => {
    const user = c.get("user");
    const stopped = await stopRunning(user.id);
    if (stopped) await logActivity(db, { companyId: stopped.companyId, actorId: user.id, verb: "timer_stopped", entityType: "TIME_ENTRY", entityId: stopped.id, summary: `${user.name} stopped tracking time`, meta: { detail: stopped.task?.title ?? stopped.project?.name ?? "" } });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/entries", async (c) => {
    const user = c.get("user");
    const parsed = manualSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json<ActionResult>({ ok: false, error: parsed.error.issues[0]!.message });
    const d = parsed.data;
    const project = await db.project.findUniqueOrThrow({ where: { id: d.projectId } });
    assertCan(user, "create", "time", project.companyId);
    const start = new Date(`${d.date}T${d.start}:00+05:30`);
    const end = new Date(`${d.date}T${d.end}:00+05:30`);
    if (end <= start) return c.json<ActionResult>({ ok: false, error: "End must be after start." });
    const overlap = await db.timeEntry.count({ where: { userId: user.id, start: { lt: end }, end: { gt: start } } });
    if (overlap) return c.json<ActionResult>({ ok: false, error: "That overlaps another entry." });
    await db.$transaction(async (tx) => {
      const e = await tx.timeEntry.create({ data: { userId: user.id, companyId: project.companyId, projectId: project.id, taskId: d.taskId || null, start, end, durationMin: Math.round((end.getTime() - start.getTime()) / 60_000), note: d.note, billable: d.billable, manual: true, status: "PENDING" } });
      await logActivity(tx, { companyId: project.companyId, actorId: user.id, verb: "time_added", entityType: "TIME_ENTRY", entityId: e.id, summary: `${user.name} added a manual time entry`, meta: { detail: d.note } });
    });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/billable", async (c) => {
    const { entryId, billable } = await c.req.json<{ entryId: string; billable: boolean }>();
    const entry = await entryFor(c.get("user"), entryId, "update");
    await db.timeEntry.update({ where: { id: entry.id }, data: { billable: z.boolean().parse(billable) } });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/review", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ ids: string[]; decision: "APPROVED" | "REJECTED" }>();
    const d = z.enum(["APPROVED", "REJECTED"]).parse(body.decision);
    for (const entryId of z.array(id).max(500).parse(body.ids)) {
      const entry = await entryFor(user, entryId, "approve");
      if (entry.status === "RUNNING") continue;
      await db.timeEntry.update({ where: { id: entry.id }, data: { status: d, approvedById: user.id } });
    }
    return c.json<ActionResult>({ ok: true });
  })
  .post("/delete", async (c) => {
    const { entryId } = await c.req.json<{ entryId: string }>();
    const entry = await entryFor(c.get("user"), entryId, "update");
    if (entry.status === "APPROVED") throw new Error("Approved entries can't be deleted.");
    await db.timeEntry.delete({ where: { id: entry.id } });
    return c.json<ActionResult>({ ok: true });
  });
