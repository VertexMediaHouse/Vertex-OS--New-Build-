import type { PrismaClient, Prisma } from "@/lib/db/generated/client";
import { goalProgress, goalStatus } from "@/lib/metrics/goals";
import { parseCompanySettings } from "@/lib/settings";

type GoalRow = Awaited<ReturnType<PrismaClient["goal"]["findMany"]>>[number];

/** Live value for an auto-tracked goal, over the goal's own dates and company. */
export async function metricValue(db: PrismaClient, g: GoalRow): Promise<number | null> {
  const range = { gte: g.startDate, lte: g.endDate };
  const co = g.companyId ? { companyId: g.companyId } : {};
  switch (g.metricType) {
    case "REVENUE":
      return Number((await db.payment.aggregate({ _sum: { amount: true }, where: { date: range, invoice: co } }))._sum.amount ?? 0);
    case "NEW_CLIENTS":
      return db.client.count({ where: { createdAt: range, ...(g.companyId && { companies: { some: { companyId: g.companyId } } }) } });
    case "PROJECTS_COMPLETED":
      return db.project.count({ where: { ...co, status: "COMPLETED", completedAt: range } });
    case "VIDEOS_DELIVERED":
      return db.task.count({ where: { companyId: "vmh", productionStage: "DELIVERED", deliveredAt: range } });
    case "LEADS_WON":
      return db.lead.count({ where: { ...co, stage: "WON", wonAt: range } });
    case "BILLABLE_HOURS":
      return Number((await db.timeEntry.aggregate({ _sum: { durationMin: true }, where: { ...co, billable: true, status: "APPROVED", start: range } }))._sum.durationMin ?? 0) / 60;
    default:
      return null;
  }
}

/** Hourly (and after relevant changes): refresh auto values and every running goal's status. */
export async function recomputeGoals(db: PrismaClient, now: Date, where: Prisma.GoalWhereInput = {}): Promise<number> {
  const companies = await db.company.findMany({ select: { id: true, settings: true } });
  const thresholds = Object.fromEntries(companies.map((c) => [c.id, parseCompanySettings(c.settings).goalThresholds]));
  const goals = await db.goal.findMany({ where: { ...where, endDate: { gte: new Date(now.getTime() - 7 * 86_400_000) } } });
  let changed = 0;
  for (const g of goals) {
    const auto = await metricValue(db, g);
    const current = auto ?? Number(g.currentValue);
    const status = goalStatus({ progress: goalProgress({ ...g, currentValue: current }), startDate: g.startDate, endDate: g.endDate, now, thresholds: thresholds[g.companyId ?? "vmh"] });
    if (status !== g.status || current !== Number(g.currentValue)) {
      await db.goal.update({ where: { id: g.id }, data: { status, currentValue: current } });
      changed++;
    }
  }
  return changed;
}
