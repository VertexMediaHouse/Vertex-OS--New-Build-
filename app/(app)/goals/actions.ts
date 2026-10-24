"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity";
import { recomputeGoals } from "@/lib/jobs/goals";
import { now } from "@/lib/clock";
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

export async function createGoal(input: z.input<typeof goalSchema>): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const { memberIds, companyId, ...d } = parsed.data;
  if (d.endDate <= d.startDate) return { ok: false, error: "End date must be after the start date." };
  assertCan(user, "update", "goal", companyId || undefined);
  if (companyId === "" || d.scope === "COMPANY") assertCan(user, "create", "goal", companyId || undefined);
  // A self-tracking goal reads revenue, clients, leads or hours, so it needs more than the
  // "update goal" right a member has: otherwise it's a side door into the money figures.
  if (d.metricType !== "MANUAL") assertCan(user, "create", "goal", companyId || undefined);
  const goal = await db.goal.create({ data: { ...d, companyId: companyId || null, ownerId: user.id, members: { create: memberIds.map((userId) => ({ userId })) } } });
  await logActivity(db, { companyId: goal.companyId, actorId: user.id, verb: "created", entityType: "GOAL", entityId: goal.id, summary: `${user.name} created goal ${goal.title}` });
  await recomputeGoals(db, now(), { id: goal.id });
  refresh();
  return { ok: true, id: goal.id };
}

async function goalFor(goalId: string) {
  const { user } = await getRequestContext();
  const goal = await db.goal.findUniqueOrThrow({ where: { id: id.parse(goalId) }, include: { members: true } });
  const mine = goal.ownerId === user.id || goal.members.some((m) => m.userId === user.id);
  if (!mine) assertCan(user, "update", "goal", goal.companyId ?? undefined);
  return { user, goal };
}

export async function updateGoalProgress(goalId: string, value: number): Promise<ActionResult> {
  const { user, goal } = await goalFor(goalId);
  if (goal.metricType !== "MANUAL") return { ok: false, error: "This goal tracks itself from live data." };
  const v = z.number().min(0).max(1e12).parse(value);
  await db.goal.update({ where: { id: goal.id }, data: { currentValue: v } });
  await recomputeGoals(db, now(), { id: goal.id });
  const pct = Math.round((v / Number(goal.targetValue)) * 100);
  await logActivity(db, { companyId: goal.companyId, actorId: user.id, verb: "updated", entityType: "GOAL", entityId: goal.id, summary: `${user.name} updated progress to ${pct}%` });
  refresh();
  return { ok: true };
}

export async function addGoalMilestone(goalId: string, title: string, date: string) {
  const { goal } = await goalFor(goalId);
  const count = await db.goalMilestone.count({ where: { goalId: goal.id } });
  await db.goalMilestone.create({ data: { goalId: goal.id, title: z.string().trim().min(1).max(160).parse(title), date: z.coerce.date().parse(date), order: count } });
  refresh();
}

export async function toggleGoalMilestone(milestoneId: string, done: boolean) {
  const m = await db.goalMilestone.findUniqueOrThrow({ where: { id: id.parse(milestoneId) } });
  const { user, goal } = await goalFor(m.goalId);
  await db.goalMilestone.update({ where: { id: m.id }, data: { done: z.boolean().parse(done) } });
  if (done) await logActivity(db, { companyId: goal.companyId, actorId: user.id, verb: "milestone", entityType: "GOAL", entityId: goal.id, summary: `${user.name} marked milestone as completed` });
  refresh();
}
