"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity";
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

/** One running timer per user, stored on the server (survives reloads and devices). */
export async function startTimer(input: { projectId: string; taskId?: string; note?: string }): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const d = z.object({ projectId: id, taskId: id.optional().or(z.literal("")), note: z.string().trim().max(500).optional() }).parse(input);
  const project = await db.project.findUniqueOrThrow({ where: { id: d.projectId }, include: { client: { select: { name: true } } } });
  assertCan(user, "create", "time", project.companyId);
  await stopRunning(user.id);
  const task = d.taskId ? await db.task.findFirst({ where: { id: d.taskId, projectId: project.id } }) : null;
  await db.$transaction(async (tx) => {
    const e = await tx.timeEntry.create({ data: { userId: user.id, companyId: project.companyId, projectId: project.id, taskId: task?.id, start: new Date(), status: "RUNNING", note: d.note, billable: Boolean(project.clientId) } });
    await logActivity(tx, { companyId: project.companyId, actorId: user.id, verb: "timer_started", entityType: "TIME_ENTRY", entityId: e.id, summary: `${user.name} started tracking time`, meta: { detail: `${task?.title ?? project.name} — ${project.client?.name ?? "Internal"}` } });
  });
  refresh();
  return { ok: true };
}

export async function stopTimer(): Promise<void> {
  const { user } = await getRequestContext();
  const stopped = await stopRunning(user.id);
  if (stopped) await logActivity(db, { companyId: stopped.companyId, actorId: user.id, verb: "timer_stopped", entityType: "TIME_ENTRY", entityId: stopped.id, summary: `${user.name} stopped tracking time`, meta: { detail: stopped.task?.title ?? stopped.project?.name ?? "" } });
  refresh();
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

export async function addManualEntry(input: z.input<typeof manualSchema>): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const project = await db.project.findUniqueOrThrow({ where: { id: d.projectId } });
  assertCan(user, "create", "time", project.companyId);
  const start = new Date(`${d.date}T${d.start}:00+05:30`);
  const end = new Date(`${d.date}T${d.end}:00+05:30`);
  if (end <= start) return { ok: false, error: "End must be after start." };
  const overlap = await db.timeEntry.count({ where: { userId: user.id, start: { lt: end }, end: { gt: start } } });
  if (overlap) return { ok: false, error: "That overlaps another entry." };
  await db.$transaction(async (tx) => {
    const e = await tx.timeEntry.create({ data: { userId: user.id, companyId: project.companyId, projectId: project.id, taskId: d.taskId || null, start, end, durationMin: Math.round((end.getTime() - start.getTime()) / 60_000), note: d.note, billable: d.billable, manual: true, status: "PENDING" } });
    await logActivity(tx, { companyId: project.companyId, actorId: user.id, verb: "time_added", entityType: "TIME_ENTRY", entityId: e.id, summary: `${user.name} added a manual time entry`, meta: { detail: d.note } });
  });
  refresh();
  return { ok: true };
}

async function entryFor(entryId: string, action: "update" | "approve") {
  const { user } = await getRequestContext();
  const entry = await db.timeEntry.findUniqueOrThrow({ where: { id: id.parse(entryId) } });
  assertCan(user, action, "time", entry.companyId);
  if (action === "update" && entry.userId !== user.id) assertCan(user, "approve", "time", entry.companyId);
  if (entry.invoiceId) throw new Error("This entry is already on an invoice.");
  return { user, entry };
}

export async function setBillable(entryId: string, billable: boolean) {
  const { entry } = await entryFor(entryId, "update");
  await db.timeEntry.update({ where: { id: entry.id }, data: { billable: z.boolean().parse(billable) } });
  refresh();
}

export async function reviewEntries(ids: string[], decision: "APPROVED" | "REJECTED") {
  const d = z.enum(["APPROVED", "REJECTED"]).parse(decision);
  for (const entryId of z.array(id).max(500).parse(ids)) {
    const { user, entry } = await entryFor(entryId, "approve");
    if (entry.status === "RUNNING") continue;
    await db.timeEntry.update({ where: { id: entry.id }, data: { status: d, approvedById: user.id } });
  }
  refresh();
}

export async function deleteEntry(entryId: string) {
  const { entry } = await entryFor(entryId, "update");
  if (entry.status === "APPROVED") throw new Error("Approved entries can't be deleted.");
  await db.timeEntry.delete({ where: { id: entry.id } });
  refresh();
}
