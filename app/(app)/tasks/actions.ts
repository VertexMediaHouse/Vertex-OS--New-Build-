"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestContext } from "@/lib/auth/context";
import { assertCan, isMemberOnly } from "@/lib/auth/permissions";
import { logActivity, notify } from "@/lib/activity";
import { mentionedUsers } from "@/lib/mentions";
import { TASK_STATUS } from "@/lib/status";
import type { ActionResult } from "@/lib/validation/result";

const id = z.string().min(1).max(64);
const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "CLIENT_REVIEW", "COMPLETED"] as const;

/** Members may only change tasks assigned to them. */
async function taskFor(taskId: string) {
  const { user } = await getRequestContext();
  const task = await db.task.findUniqueOrThrow({ where: { id: id.parse(taskId) } });
  assertCan(user, "update", "task", task.companyId);
  if (isMemberOnly(user, task.companyId) && task.assigneeId !== user.id) throw new Error("You can only update your own tasks.");
  return { user, task };
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

export async function createTask(input: z.input<typeof taskSchema>): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  assertCan(user, "create", "task", d.companyId);
  const assigneeId = d.assigneeId || (isMemberOnly(user, d.companyId) ? user.id : null);
  const task = await db.$transaction(async (tx) => {
    const t = await tx.task.create({ data: { ...d, projectId: d.projectId || null, assigneeId, createdById: user.id, startDate: new Date() } });
    await logActivity(tx, { companyId: d.companyId, actorId: user.id, verb: "created", entityType: "TASK", entityId: t.id, summary: `${user.name} created task ${t.title}` });
    if (assigneeId) await notify(tx, { userIds: [assigneeId], exceptUserId: user.id, type: "task_assigned", title: `New task: ${t.title}`, link: `/tasks?id=${t.id}` });
    return t;
  });
  refresh();
  return { ok: true, id: task.id };
}

/** Board drop (or the status dropdown, which passes no card): slot the task in above `beforeId`. */
/** Who reviews this task: whoever assigned it, as long as that is not the person finishing it. */
function reviewerOf(task: { createdById: string | null; assigneeId: string | null }, actorId: string) {
  const reviewer = task.createdById;
  return reviewer && reviewer !== actorId ? reviewer : null;
}

export async function moveTask(taskId: string, status: string, beforeId: string | null) {
  const { user, task } = await taskFor(taskId);
  const s = z.enum(STATUSES).parse(status);
  // Finishing someone else's task sends it up for review rather than closing it.
  const handUp = s === "COMPLETED" && task.status !== "COMPLETED" ? reviewerOf(task, user.id) : null;
  if (handUp) {
    await submitForReview(task.id, "");
    return;
  }
  const bId = z.string().max(64).nullable().parse(beforeId);
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
  refresh();
}

const patchSchema = z.object({
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assigneeId: z.string().max(64).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  description: z.string().trim().max(10_000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export async function updateTask(taskId: string, patch: z.input<typeof patchSchema>) {
  const { user, task } = await taskFor(taskId);
  const d = patchSchema.parse(patch);
  await db.$transaction(async (tx) => {
    await tx.task.update({ where: { id: task.id }, data: d });
    if (d.assigneeId && d.assigneeId !== task.assigneeId) await notify(tx, { userIds: [d.assigneeId], exceptUserId: user.id, type: "task_assigned", title: `You were assigned ${task.title}`, link: `/tasks?id=${task.id}` });
    await logActivity(tx, { companyId: task.companyId, actorId: user.id, verb: "updated", entityType: "TASK", entityId: task.id, summary: `${user.name} updated ${task.title}` });
  });
  refresh();
}

async function syncProgress(taskId: string) {
  const items = await db.checklistItem.findMany({ where: { taskId } });
  if (items.length) await db.task.update({ where: { id: taskId }, data: { progress: Math.round((items.filter((i) => i.done).length / items.length) * 100) } });
}

export async function toggleChecklist(itemId: string, done: boolean) {
  const item = await db.checklistItem.findUniqueOrThrow({ where: { id: id.parse(itemId) } });
  await taskFor(item.taskId);
  await db.checklistItem.update({ where: { id: item.id }, data: { done: z.boolean().parse(done) } });
  await syncProgress(item.taskId);
  refresh();
}

export async function addChecklistItem(taskId: string, text: string) {
  const { task } = await taskFor(taskId);
  const count = await db.checklistItem.count({ where: { taskId: task.id } });
  await db.checklistItem.create({ data: { taskId: task.id, text: z.string().trim().min(1).max(300).parse(text), order: count } });
  await syncProgress(task.id);
  refresh();
}

export async function addTaskComment(taskId: string, body: string) {
  const { user } = await getRequestContext();
  const task = await db.task.findUniqueOrThrow({ where: { id: id.parse(taskId) } });
  assertCan(user, "view", "task", task.companyId);
  const text = z.string().trim().min(1).max(5000).parse(body);
  const mentions = await mentionedUsers(text);
  await db.$transaction(async (tx) => {
    await tx.comment.create({ data: { entityType: "TASK", entityId: task.id, authorId: user.id, body: text, mentions } });
    await notify(tx, { userIds: [...mentions, ...(task.assigneeId ? [task.assigneeId] : [])], exceptUserId: user.id, type: "mention", title: `${user.name} commented on ${task.title}`, link: `/tasks?id=${task.id}` });
  });
  refresh();
}

// ── Review cycle ────────────────────────────────────────────────────────

const reviewNote = z.string().trim().max(2000);

/**
 * Hand a finished task back to whoever assigned it, with a note on what they should look
 * at. Nobody to hand it to (you assigned it yourself) means it simply completes.
 */
export async function submitForReview(taskId: string, note: string): Promise<ActionResult> {
  const { user, task } = await taskFor(taskId);
  const body = reviewNote.parse(note);
  const reviewer = reviewerOf(task, user.id);
  if (!reviewer) {
    await db.$transaction(async (tx) => {
      await tx.task.update({ where: { id: task.id }, data: { status: "COMPLETED", completedAt: task.completedAt ?? new Date(), progress: 100 } });
      await logActivity(tx, { companyId: task.companyId, actorId: user.id, verb: "completed", entityType: "TASK", entityId: task.id, summary: `${user.name} completed ${task.title}` });
    });
    refresh();
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
  refresh();
  return { ok: true };
}

/**
 * The reviewer's half of the cycle: approve it, which closes it and credits whoever did
 * the work, or send it back to them with what still needs doing.
 */
export async function reviewTask(taskId: string, decision: "approve" | "rework", note: string): Promise<ActionResult> {
  const { user, task } = await taskFor(taskId);
  const body = reviewNote.parse(note);
  const d = z.enum(["approve", "rework"]).parse(decision);
  if (task.status !== "IN_REVIEW") return { ok: false, error: "That task is not waiting for review." };
  const doer = task.reviewFromId;
  if (d === "rework" && !body) return { ok: false, error: "Say what still needs doing." };
  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data:
        d === "approve"
          ? { status: "COMPLETED", completedAt: new Date(), progress: 100, assigneeId: doer ?? task.assigneeId, reviewFromId: null }
          : { status: "IN_PROGRESS", completedAt: null, progress: 50, assigneeId: doer ?? task.assigneeId, reviewFromId: null },
    });
    if (body) await tx.comment.create({ data: { entityType: "TASK", entityId: task.id, authorId: user.id, body } });
    if (doer) {
      await notify(tx, {
        userIds: [doer],
        exceptUserId: user.id,
        type: d === "approve" ? "task_approved" : "task_rework",
        title: d === "approve" ? `${user.name} approved "${task.title}"` : `${user.name} sent "${task.title}" back`,
        body: body || undefined,
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
  refresh();
  return { ok: true };
}

/** Hard delete, for a task added by mistake. Refused once time has been logged on it. */
export async function deleteTask(taskId: string): Promise<ActionResult> {
  const { user, task } = await taskFor(taskId);
  assertCan(user, "delete", "task", task.companyId);
  const time = await db.timeEntry.count({ where: { taskId: task.id } });
  if (time) return { ok: false, error: `${time} time entr${time > 1 ? "ies are" : "y is"} logged against this task. Complete or cancel it instead.` };
  await db.$transaction([
    db.comment.deleteMany({ where: { entityType: "TASK", entityId: task.id } }),
    db.task.delete({ where: { id: task.id } }),
    db.activity.create({ data: { companyId: task.companyId, actorId: user.id, verb: "deleted", entityType: "TASK", entityId: task.id, summary: `${user.name} deleted task ${task.title}` } }),
  ]);
  refresh();
  return { ok: true };
}

// ── Routines: the fixed tasks that come back every day ──────────────────

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

export async function saveRoutine(routineId: string | null, input: z.input<typeof routineSchema>): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const parsed = routineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  assertCan(user, "create", "task", d.companyId);
  const data = { ...d, projectId: d.projectId || null, estimatedMinutes: d.estimatedMinutes || null };
  if (routineId) {
    const existing = await db.recurringTask.findUniqueOrThrow({ where: { id: id.parse(routineId) } });
    assertCan(user, "update", "task", existing.companyId);
    await db.recurringTask.update({ where: { id: existing.id }, data });
  } else {
    await db.recurringTask.create({ data: { ...data, createdById: user.id } });
  }
  refresh();
  return { ok: true };
}

/** Pause a routine instead of deleting it: tomorrow it simply makes nothing. */
export async function toggleRoutine(routineId: string, active: boolean): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const routine = await db.recurringTask.findUniqueOrThrow({ where: { id: id.parse(routineId) } });
  assertCan(user, "update", "task", routine.companyId);
  await db.recurringTask.update({ where: { id: routine.id }, data: { active: z.boolean().parse(active) } });
  refresh();
  return { ok: true };
}

export async function deleteRoutine(routineId: string): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const routine = await db.recurringTask.findUniqueOrThrow({ where: { id: id.parse(routineId) } });
  assertCan(user, "delete", "task", routine.companyId);
  // Tasks it already made stay; only the routine stops.
  await db.recurringTask.delete({ where: { id: routine.id } });
  refresh();
  return { ok: true };
}
