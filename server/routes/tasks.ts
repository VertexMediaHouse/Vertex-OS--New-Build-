// Ported from app/(app)/tasks/{page.tsx,actions.ts}. Query and mutation bodies are
// unchanged; only the context and input plumbing differs. refresh() is gone — the
// frontend invalidates its query after a successful mutation.
import { Hono } from "hono";
import { z } from "zod";
import { staffContext, type Env } from "../context";
import { logActivity, notify } from "@/lib/activity";
import { assertCan, can, isMemberOnly, type CurrentUser } from "@/lib/auth/permissions";
import { addDays, now, startOfDayIST, startOfMonthIST, startOfWeekIST } from "@/lib/clock";
import { db, type Prisma } from "@/lib/db";
import { formatShortDate } from "@/lib/format";
import { mentionedUsers } from "@/lib/mentions";
import * as M from "@/lib/metrics/dashboard";
import { TASK_STATUS } from "@/lib/status";
import { companyCode } from "@/components/shared/pills";
import type { ActionResult } from "@/lib/validation/result";

const id = z.string().min(1).max(64);
const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "CLIENT_REVIEW", "COMPLETED"] as const;

/** Members may only change tasks assigned to them. */
async function taskFor(user: CurrentUser, taskId: string) {
  const task = await db.task.findUniqueOrThrow({ where: { id: id.parse(taskId) } });
  assertCan(user, "update", "task", task.companyId);
  if (isMemberOnly(user, task.companyId) && task.assigneeId !== user.id) throw new Error("You can only update your own tasks.");
  return task;
}

const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  companyId: z.enum(["vmh", "vth"]),
  projectId: z.string().max(64).optional().or(z.literal("")),
  assigneeId: z.string().max(64).optional().or(z.literal("")),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  status: z.enum(STATUSES).default("TODO"),
  dueDate: z.coerce.date().optional(),
  estimatedMinutes: z.coerce.number().int().min(0).max(100_000).optional(),
  description: z.string().trim().max(10_000).optional(),
});

/** Who reviews this task: whoever assigned it, as long as that is not the person finishing it. */
function reviewerOf(task: { createdById: string | null; assigneeId: string | null }, actorId: string) {
  const reviewer = task.createdById;
  return reviewer && reviewer !== actorId ? reviewer : null;
}

const reviewNote = z.string().trim().max(2000);

/**
 * Hand a finished task back to whoever assigned it, with a note on what they should look
 * at. Nobody to hand it to (you assigned it yourself) means it simply completes.
 */
async function submitForReview(user: CurrentUser, taskId: string, note: string): Promise<ActionResult> {
  const task = await taskFor(user, taskId);
  const body = reviewNote.parse(note);
  const reviewer = reviewerOf(task, user.id);
  if (!reviewer) {
    await db.$transaction(async (tx) => {
      await tx.task.update({ where: { id: task.id }, data: { status: "COMPLETED", completedAt: task.completedAt ?? new Date(), progress: 100 } });
      await logActivity(tx, { companyId: task.companyId, actorId: user.id, verb: "completed", entityType: "TASK", entityId: task.id, summary: `${user.name} completed ${task.title}` });
    });
    return { ok: true };
  }
  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: { status: "IN_REVIEW", assigneeId: reviewer, reviewFromId: task.assigneeId ?? user.id, progress: 100, completedAt: null },
    });
    if (body) await tx.comment.create({ data: { entityType: "TASK", entityId: task.id, authorId: user.id, body } });
    await notify(tx, {
      userIds: [reviewer],
      exceptUserId: user.id,
      type: "task_review",
      title: `${user.name} finished "${task.title}" — your review`,
      body: body || undefined,
      link: `/tasks?id=${task.id}`,
    });
    await logActivity(tx, { companyId: task.companyId, actorId: user.id, verb: "submitted", entityType: "TASK", entityId: task.id, summary: `${user.name} sent ${task.title} for review` });
  });
  return { ok: true };
}

async function syncProgress(taskId: string) {
  const items = await db.checklistItem.findMany({ where: { taskId } });
  if (items.length) await db.task.update({ where: { id: taskId }, data: { progress: Math.round((items.filter((i) => i.done).length / items.length) * 100) } });
}

const routineSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  companyId: z.enum(["vmh", "vth"]),
  assigneeId: z.string().min(1, "Pick who does it").max(64),
  projectId: z.string().max(64).optional().or(z.literal("")),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  estimatedMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  /** ISO weekdays, 1 = Monday … 7 = Sunday. Empty = every day. */
  weekdays: z.array(z.coerce.number().int().min(1).max(7)).max(7).default([]),
});

/** Narrow a company sub-filter (?co=vmh) to the companies already in scope. */
const subScope = (companyIds: string[], co: string | undefined) => (co && companyIds.includes(co) ? [co] : companyIds);

export const tasks = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const user = c.get("user");
    const companyIds = c.get("companyIds");
    const scope = c.get("scope");
    if (!can(user, "view", "task")) return c.json({ denied: true as const });
    const q = c.req.query("q") || null;
    const t = now();
    const today = startOfDayIST(t);
    const weekStart = startOfWeekIST(t);
    const mine = isMemberOnly(user);
    const base: Prisma.TaskWhereInput = { companyId: { in: companyIds }, ...(mine && { assigneeId: user.id }) };
    const due = c.req.query("due");
    const where: Prisma.TaskWhereInput = {
      ...base,
      companyId: { in: subScope(companyIds, c.req.query("co")) },
      ...(c.req.query("project") && { projectId: c.req.query("project")! }),
      ...(c.req.query("assignee") && { assigneeId: c.req.query("assignee")! }),
      ...(c.req.query("priority") && { priority: c.req.query("priority") as "HIGH" }),
      ...(c.req.query("status") && { status: c.req.query("status") as "TODO" }),
      ...(q && { OR: [{ title: { contains: q, mode: "insensitive" } }, { project: { client: { name: { contains: q, mode: "insensitive" } } } }] }),
      // ?due= matches the dashboard's own buckets, which are all about open tasks.
      ...(due === "today" && { status: { not: "COMPLETED" as const }, dueDate: { gte: today, lt: addDays(today, 1) } }),
      ...(due === "overdue" && { status: { not: "COMPLETED" as const }, dueDate: { lt: today } }),
      ...(due === "week" && { status: { not: "COMPLETED" as const }, dueDate: { gte: addDays(today, 1), lt: addDays(today, 8) } }),
    };
    const open = { ...base, status: { not: "COMPLETED" as const } };
    const month = startOfMonthIST(t);
    const view = c.req.query("view") ?? "kanban";
    // The board hides tasks completed over 30 days ago, so it doesn't grow without end. Search,
    // the status filter and the other views must still find them. AND, because `where` uses OR.
    const recentOnly = view === "kanban" && !q && !c.req.query("status") && !due;
    const [rows, projects, people, kpis, myTasks, routineRows] = await Promise.all([
      db.task.findMany({
        where: recentOnly ? { ...where, AND: [{ OR: [{ status: { not: "COMPLETED" } }, { completedAt: { gte: addDays(t, -30) } }] }] } : where,
        orderBy: [{ position: "asc" }, { dueDate: "asc" }],
        include: { project: { select: { name: true, client: { select: { name: true } } } }, assignee: { select: { name: true } } },
      }),
      db.project.findMany({ where: { companyId: { in: companyIds }, status: { not: "COMPLETED" } }, select: { id: true, name: true, companyId: true, client: { select: { name: true } } }, orderBy: { name: "asc" } }),
      db.user.findMany({ where: { kind: "STAFF", memberships: { some: { companyId: { in: companyIds } } } }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
      Promise.all([
        db.task.groupBy({ by: ["companyId"], _count: true, where: base }),
        db.task.groupBy({ by: ["companyId"], _count: true, where: { ...base, status: "TODO" } }),
        db.task.groupBy({ by: ["companyId"], _count: true, where: { ...open, dueDate: { gte: today, lt: addDays(today, 1) } } }),
        db.task.groupBy({ by: ["companyId"], _count: true, where: { ...open, dueDate: { lt: today } } }),
        db.task.groupBy({ by: ["companyId"], _count: true, where: { ...base, status: "COMPLETED", completedAt: { gte: weekStart } } }),
        db.task.count({ where: { ...base, status: "COMPLETED", completedAt: { gte: addDays(weekStart, -7), lt: weekStart } } }),
        db.task.count({ where: { ...base, createdAt: { gte: month } } }),
        db.task.count({ where: { ...base, createdAt: { gte: new Date(month.getTime() - 30 * 86_400_000), lt: month } } }),
      ]),
      db.task.findMany({ where: { companyId: { in: companyIds }, status: { not: "COMPLETED" }, OR: [{ assigneeId: user.id }, { createdById: user.id }] }, orderBy: { dueDate: "asc" }, take: 5, include: { project: { select: { client: { select: { name: true } } } }, assignee: { select: { name: true } } } }),
      db.recurringTask.findMany({ where: { companyId: { in: companyIds } }, orderBy: [{ active: "desc" }, { title: "asc" }], include: { assignee: { select: { name: true } } } }),
    ]);
    const [total, pending, dueToday, overdue, doneWeek, donePrev, createdNow, createdPrev] = kpis;
    const routines = routineRows.map((r) => ({ id: r.id, title: r.title, companyId: r.companyId, assigneeId: r.assigneeId, assignee: r.assignee.name, projectId: r.projectId, priority: r.priority, estimatedMinutes: r.estimatedMinutes, weekdays: r.weekdays, active: r.active }));

    const board: Record<string, unknown[]> = { TODO: [], IN_PROGRESS: [], IN_REVIEW: [], CLIENT_REVIEW: [], COMPLETED: [] };
    for (const tk of rows) board[tk.status]!.push({ id: tk.id, title: tk.title, co: companyCode(tk.companyId), client: tk.project?.client?.name ?? tk.project?.name ?? null, priority: tk.priority, due: tk.dueDate ? formatShortDate(tk.dueDate) : null, progress: tk.progress, assignee: tk.assignee?.name ?? null });
    // Workload % comes from the shared helper, so this table, the dashboard and Team agree.
    const [allTasks, hours] = await Promise.all([
      db.task.findMany({ where: { ...base, assigneeId: { in: people.map((x) => x.id) } }, select: { assigneeId: true, status: true, dueDate: true, estimatedMinutes: true } }),
      M.teamWorkload({ companyIds }),
    ]);
    const workload = people.map((u) => {
      const own = allTasks.filter((x) => x.assigneeId === u.id);
      const openOwn = own.filter((x) => x.status !== "COMPLETED");
      return { ...u, assigned: own.length, completed: own.length - openOwn.length, inProgress: own.filter((x) => x.status === "IN_PROGRESS").length, overdue: openOwn.filter((x) => x.dueDate && x.dueDate < today).length, pct: hours.find((h) => h.id === u.id)?.pct ?? 0 };
    });
    const companies = companyIds.filter((x): x is "vmh" | "vth" => can(user, "create", "task", x));
    const sum = (r: { _count: number }[]) => r.reduce((a, x) => a + x._count, 0);
    const by = (r: { companyId: string; _count: number }[], x: string) => r.find((y) => y.companyId === x)?._count ?? 0;
    const split = (r: { companyId: string; _count: number }[]) => (scope === "ALL" ? [{ value: by(r, "vmh"), label: "VMH" }, { value: by(r, "vth"), label: "VTH" }] : undefined);

    return c.json({
      denied: false as const,
      tasks: rows,
      projects,
      people,
      routines,
      board,
      workload,
      companies,
      scope,
      mine,
      today: today.toISOString(),
      myTasks,
      kpis: {
        total: sum(total), pending: sum(pending), dueToday: sum(dueToday), overdue: sum(overdue), doneWeek: sum(doneWeek),
        donePrev, createdNow, createdPrev,
        splits: { total: split(total), pending: split(pending), dueToday: split(dueToday), overdue: split(overdue), doneWeek: split(doneWeek) },
      },
    });
  })
  /** The drawer: one task with everything hanging off it. */
  .get("/detail", async (c) => {
    const user = c.get("user");
    const companyIds = c.get("companyIds");
    const taskId = c.req.query("id") ?? "";
    const tk = await db.task.findFirst({
      where: { id: taskId, companyId: { in: companyIds } },
      include: { project: { include: { client: true } }, assignee: true, checklist: { orderBy: { order: "asc" }, include: { assignee: { select: { name: true } } } }, files: { where: { deletedAt: null } }, timeEntries: { select: { durationMin: true } } },
    });
    if (!tk) return c.json({ task: null });
    const [comments, activity] = await Promise.all([
      db.comment.findMany({ where: { entityType: "TASK", entityId: taskId }, orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, image: true } } } }),
      db.activity.findMany({ where: { entityType: "TASK", entityId: taskId }, orderBy: { createdAt: "desc" }, take: 10 }),
    ]);
    return c.json({
      task: tk,
      comments,
      activity,
      minutes: tk.timeEntries.reduce((a: any, e: any) => a + (e.durationMin ?? 0), 0),
      canDelete: can(user, "delete", "task", tk.companyId),
      viewerId: user.id,
      now: now().toISOString(),
    });
  })
  .post("/", async (c) => {
    const user = c.get("user");
    const parsed = taskSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json<ActionResult>({ ok: false, error: parsed.error.issues[0]!.message });
    const d = parsed.data;
    assertCan(user, "create", "task", d.companyId);
    const assigneeId = d.assigneeId || (isMemberOnly(user, d.companyId) ? user.id : null);
    const task = await db.$transaction(async (tx) => {
      const t = await tx.task.create({ data: { ...d, projectId: d.projectId || null, assigneeId, createdById: user.id, startDate: new Date() } });
      await logActivity(tx, { companyId: d.companyId, actorId: user.id, verb: "created", entityType: "TASK", entityId: t.id, summary: `${user.name} created task ${t.title}` });
      if (assigneeId) await notify(tx, { userIds: [assigneeId], exceptUserId: user.id, type: "task_assigned", title: `New task: ${t.title}`, link: `/tasks?id=${t.id}` });
      return t;
    });
    return c.json<ActionResult>({ ok: true, id: task.id });
  })
  /** Board drop (or the status dropdown, which passes no card): slot the task in above `beforeId`. */
  .post("/move", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ taskId: string; status: string; beforeId: string | null }>();
    const task = await taskFor(user, body.taskId);
    const s = z.enum(STATUSES).parse(body.status);
    // Finishing someone else's task sends it up for review rather than closing it.
    const handUp = s === "COMPLETED" && task.status !== "COMPLETED" ? reviewerOf(task, user.id) : null;
    if (handUp) {
      await submitForReview(user, task.id, "");
      return c.json<ActionResult>({ ok: true });
    }
    const bId = z.string().max(64).nullable().parse(body.beforeId);
    await db.$transaction(async (tx) => {
      // Make room with one update instead of renumbering the whole column; the board may be
      // filtered, so only the dropped-on card's own position can be trusted.
      // Order within the column only, like leads: the board mixes both companies at All scope.
      const col = { status: s };
      const before = bId ? await tx.task.findUnique({ where: { id: bId }, select: { position: true } }) : null;
      let position: number;
      if (before) {
        await tx.task.updateMany({ where: { ...col, position: { gte: before.position } }, data: { position: { increment: 1 } } });
        position = before.position;
      } else {
        position = Number((await tx.task.aggregate({ _max: { position: true }, where: col }))._max.position ?? -1) + 1;
      }
      await tx.task.update({ where: { id: task.id }, data: { status: s, position, completedAt: s === "COMPLETED" ? (task.completedAt ?? new Date()) : null, ...(s === "COMPLETED" && { progress: 100 }) } });
      if (task.status !== s) {
        await logActivity(tx, { companyId: task.companyId, actorId: user.id, verb: s === "COMPLETED" ? "completed" : "moved", entityType: "TASK", entityId: task.id, summary: s === "COMPLETED" ? `${user.name} marked task as completed` : `${user.name} moved ${task.title} to ${TASK_STATUS[s]!.label}` });
        if (task.assigneeId) await notify(tx, { userIds: [task.assigneeId], exceptUserId: user.id, type: "task_status", title: `${task.title} → ${TASK_STATUS[s]!.label}`, link: `/tasks?id=${task.id}` });
      }
    });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/update", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ taskId: string; patch: Record<string, unknown> }>();
    const task = await taskFor(user, body.taskId);
    const d = z.object({
      priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
      assigneeId: z.string().max(64).nullable().optional(),
      dueDate: z.coerce.date().nullable().optional(),
      description: z.string().trim().max(10_000).optional(),
      tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    }).parse(body.patch);
    await db.$transaction(async (tx) => {
      await tx.task.update({ where: { id: task.id }, data: d });
      if (d.assigneeId && d.assigneeId !== task.assigneeId) await notify(tx, { userIds: [d.assigneeId], exceptUserId: user.id, type: "task_assigned", title: `You were assigned ${task.title}`, link: `/tasks?id=${task.id}` });
      await logActivity(tx, { companyId: task.companyId, actorId: user.id, verb: "updated", entityType: "TASK", entityId: task.id, summary: `${user.name} updated ${task.title}` });
    });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/checklist/toggle", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ itemId: string; done: boolean }>();
    const item = await db.checklistItem.findUniqueOrThrow({ where: { id: id.parse(body.itemId) } });
    await taskFor(user, item.taskId);
    await db.checklistItem.update({ where: { id: item.id }, data: { done: z.boolean().parse(body.done) } });
    await syncProgress(item.taskId);
    return c.json<ActionResult>({ ok: true });
  })
  .post("/checklist/add", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ taskId: string; text: string }>();
    const task = await taskFor(user, body.taskId);
    const count = await db.checklistItem.count({ where: { taskId: task.id } });
    await db.checklistItem.create({ data: { taskId: task.id, text: z.string().trim().min(1).max(300).parse(body.text), order: count } });
    await syncProgress(task.id);
    return c.json<ActionResult>({ ok: true });
  })
  .post("/comment", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ taskId: string; body: string }>();
    const task = await db.task.findUniqueOrThrow({ where: { id: id.parse(body.taskId) } });
    assertCan(user, "view", "task", task.companyId);
    const text = z.string().trim().min(1).max(5000).parse(body.body);
    const mentions = await mentionedUsers(text);
    await db.$transaction(async (tx) => {
      await tx.comment.create({ data: { entityType: "TASK", entityId: task.id, authorId: user.id, body: text, mentions } });
      await notify(tx, { userIds: [...mentions, ...(task.assigneeId ? [task.assigneeId] : [])], exceptUserId: user.id, type: "mention", title: `${user.name} commented on ${task.title}`, link: `/tasks?id=${task.id}` });
    });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/submit-review", async (c) => {
    const body = await c.req.json<{ taskId: string; note: string }>();
    return c.json<ActionResult>(await submitForReview(c.get("user"), body.taskId, body.note));
  })
  /**
   * The reviewer's half of the cycle: approve it, which closes it and credits whoever did
   * the work, or send it back to them with what still needs doing.
   */
  .post("/review", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ taskId: string; decision: "approve" | "rework"; note: string }>();
    const task = await taskFor(user, body.taskId);
    const note = reviewNote.parse(body.note);
    const d = z.enum(["approve", "rework"]).parse(body.decision);
    if (task.status !== "IN_REVIEW") return c.json<ActionResult>({ ok: false, error: "That task is not waiting for review." });
    const doer = task.reviewFromId;
    if (d === "rework" && !note) return c.json<ActionResult>({ ok: false, error: "Say what still needs doing." });
    await db.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: task.id },
        data:
          d === "approve"
            ? { status: "COMPLETED", completedAt: new Date(), progress: 100, assigneeId: doer ?? task.assigneeId, reviewFromId: null }
            : { status: "IN_PROGRESS", completedAt: null, progress: 50, assigneeId: doer ?? task.assigneeId, reviewFromId: null },
      });
      if (note) await tx.comment.create({ data: { entityType: "TASK", entityId: task.id, authorId: user.id, body: note } });
      if (doer) {
        await notify(tx, {
          userIds: [doer],
          exceptUserId: user.id,
          type: d === "approve" ? "task_approved" : "task_rework",
          title: d === "approve" ? `${user.name} approved "${task.title}"` : `${user.name} sent "${task.title}" back`,
          body: note || undefined,
          link: `/tasks?id=${task.id}`,
        });
      }
      await logActivity(tx, {
        companyId: task.companyId,
        actorId: user.id,
        verb: d === "approve" ? "approved" : "returned",
        entityType: "TASK",
        entityId: task.id,
        summary: d === "approve" ? `${user.name} approved ${task.title}` : `${user.name} sent ${task.title} back for changes`,
      });
    });
    return c.json<ActionResult>({ ok: true });
  })
  /** Hard delete, for a task added by mistake. Refused once time has been logged on it. */
  .post("/delete", async (c) => {
    const user = c.get("user");
    const { taskId } = await c.req.json<{ taskId: string }>();
    const task = await taskFor(user, taskId);
    assertCan(user, "delete", "task", task.companyId);
    const time = await db.timeEntry.count({ where: { taskId: task.id } });
    if (time) return c.json<ActionResult>({ ok: false, error: `${time} time entr${time > 1 ? "ies are" : "y is"} logged against this task. Complete or cancel it instead.` });
    await db.$transaction([
      db.comment.deleteMany({ where: { entityType: "TASK", entityId: task.id } }),
      db.task.delete({ where: { id: task.id } }),
      db.activity.create({ data: { companyId: task.companyId, actorId: user.id, verb: "deleted", entityType: "TASK", entityId: task.id, summary: `${user.name} deleted task ${task.title}` } }),
    ]);
    return c.json<ActionResult>({ ok: true });
  })
  // ── Routines: the fixed tasks that come back every day ──────────────────
  .post("/routines/save", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ routineId: string | null; input: unknown }>();
    const parsed = routineSchema.safeParse(body.input);
    if (!parsed.success) return c.json<ActionResult>({ ok: false, error: parsed.error.issues[0]!.message });
    const d = parsed.data;
    assertCan(user, "create", "task", d.companyId);
    const data = { ...d, projectId: d.projectId || null, estimatedMinutes: d.estimatedMinutes || null };
    if (body.routineId) {
      const existing = await db.recurringTask.findUniqueOrThrow({ where: { id: id.parse(body.routineId) } });
      assertCan(user, "update", "task", existing.companyId);
      await db.recurringTask.update({ where: { id: existing.id }, data });
    } else {
      await db.recurringTask.create({ data: { ...data, createdById: user.id } });
    }
    return c.json<ActionResult>({ ok: true });
  })
  /** Pause a routine instead of deleting it: tomorrow it simply makes nothing. */
  .post("/routines/toggle", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ routineId: string; active: boolean }>();
    const routine = await db.recurringTask.findUniqueOrThrow({ where: { id: id.parse(body.routineId) } });
    assertCan(user, "update", "task", routine.companyId);
    await db.recurringTask.update({ where: { id: routine.id }, data: { active: z.boolean().parse(body.active) } });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/routines/delete", async (c) => {
    const user = c.get("user");
    const { routineId } = await c.req.json<{ routineId: string }>();
    const routine = await db.recurringTask.findUniqueOrThrow({ where: { id: id.parse(routineId) } });
    assertCan(user, "delete", "task", routine.companyId);
    // Tasks it already made stay; only the routine stops.
    await db.recurringTask.delete({ where: { id: routine.id } });
    return c.json<ActionResult>({ ok: true });
  });
