import "server-only";
import { db } from "@/lib/db";
import { scopedClientWhere, scopedSharedWhere, scopedWhere, type ScopeFilter } from "@/lib/db/scope";
import { addDays, addMonthsIST, now, startOfDayIST, startOfMonthIST, startOfWeekIST } from "@/lib/clock";
import { pctChange, type Period } from "@/lib/period";
import { avgTurnaroundHours, workloadPercent } from "./workload";
import { goalProgress } from "./goals";
import { parseCompanySettings } from "@/lib/settings";

const num = (v: unknown) => Number(v ?? 0);
const ACTIVE_PROJECT = { notIn: ["COMPLETED", "CANCELLED"] as ("COMPLETED" | "CANCELLED")[] };

export async function revenueSummary(s: ScopeFilter, p: Period) {
  const issued = (from: Date, to: Date) =>
    db.invoice.aggregate({ _sum: { total: true }, where: { ...scopedWhere(s), issueDate: { gte: from, lt: to }, status: { notIn: ["DRAFT", "CANCELLED"] } } });
  const [cur, prev, collected, open, byCompany] = await Promise.all([
    issued(p.from, p.to),
    issued(p.prevFrom, p.prevTo),
    db.payment.aggregate({ _sum: { amount: true }, where: { date: { gte: p.from, lt: p.to }, invoice: scopedWhere(s) } }),
    db.invoice.aggregate({ _sum: { total: true, paidAmount: true }, where: { ...scopedWhere(s), status: { in: ["PENDING", "OVERDUE"] } } }),
    db.invoice.groupBy({ by: ["companyId"], _sum: { total: true }, where: { ...scopedWhere(s), issueDate: { gte: p.from, lt: p.to }, status: { notIn: ["DRAFT", "CANCELLED"] } } }),
  ]);
  // Settings → "Revenue on dashboard": invoiced (default) or collected in the period.
  const companies = await db.company.findMany({ where: { id: { in: s.companyIds } }, select: { settings: true } });
  const collectedBasis = companies.length > 0 && companies.every((c) => parseCompanySettings(c.settings).revenueBasis === "COLLECTED");
  const paidIn = async (from: Date, to: Date, companyId?: string) =>
    companyId && !s.companyIds.includes(companyId)
      ? 0
      : num((await db.payment.aggregate({ _sum: { amount: true }, where: { date: { gte: from, lt: to }, invoice: companyId ? { companyId } : scopedWhere(s) } }))._sum.amount);
  // The VMH/VTH split has to use the same basis as the total, or they don't add up.
  const [prevCollected, collectedVmh, collectedVth] = collectedBasis
    ? await Promise.all([paidIn(p.prevFrom, p.prevTo), paidIn(p.from, p.to, "vmh"), paidIn(p.from, p.to, "vth")])
    : [0, 0, 0];
  const total = collectedBasis ? num(collected._sum.amount) : num(cur._sum.total);
  return {
    total,
    trend: pctChange(total, collectedBasis ? prevCollected : num(prev._sum.total)),
    collected: num(collected._sum.amount),
    outstanding: num(open._sum.total) - num(open._sum.paidAmount),
    vmh: collectedBasis ? collectedVmh : num(byCompany.find((r) => r.companyId === "vmh")?._sum.total),
    vth: collectedBasis ? collectedVth : num(byCompany.find((r) => r.companyId === "vth")?._sum.total),
  };
}

/** Monthly invoiced revenue Jan → current month, per company. */
export async function revenueTrend(s: ScopeFilter) {
  const end = addMonthsIST(startOfMonthIST(now()), 1);
  const start = addMonthsIST(end, -10);
  const rows = await db.invoice.findMany({ where: { ...scopedWhere(s), issueDate: { gte: start, lt: end }, status: { notIn: ["DRAFT", "CANCELLED"] } }, select: { issueDate: true, total: true, companyId: true } });
  return Array.from({ length: 10 }, (_, i) => {
    const from = addMonthsIST(start, i);
    const to = addMonthsIST(start, i + 1);
    const inMonth = rows.filter((r) => r.issueDate >= from && r.issueDate < to);
    const vmh = inMonth.filter((r) => r.companyId === "vmh").reduce((a, r) => a + num(r.total), 0);
    const vth = inMonth.filter((r) => r.companyId === "vth").reduce((a, r) => a + num(r.total), 0);
    return { month: new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "Asia/Kolkata" }).format(from), VMH: vmh, VTH: vth, total: vmh + vth };
  });
}

export async function projectSummary(s: ScopeFilter, p: Period) {
  const where = { ...scopedWhere(s), clientId: { not: null } };
  const [groups, delivered, started, startedPrev, byCompany] = await Promise.all([
    db.project.groupBy({ by: ["status"], _count: true, where: { ...where, status: ACTIVE_PROJECT } }),
    db.project.count({ where: { ...where, status: "COMPLETED", completedAt: { gte: p.from, lt: p.to } } }),
    db.project.count({ where: { ...where, startDate: { gte: p.from, lt: p.to } } }),
    db.project.count({ where: { ...where, startDate: { gte: p.prevFrom, lt: p.prevTo } } }),
    db.project.groupBy({ by: ["companyId"], _count: true, where: { ...where, status: ACTIVE_PROJECT } }),
  ]);
  const c = (...st: string[]) => groups.filter((g) => st.includes(g.status)).reduce((a, g) => a + g._count, 0);
  return {
    active: c(...groups.map((g) => g.status)),
    delta: started - startedPrev,
    notStarted: c("NOT_STARTED", "PLANNING"),
    inProgress: c("IN_PROGRESS", "EDITING", "DEVELOPMENT", "REVISION"),
    inReview: c("IN_REVIEW", "CLIENT_REVIEW"),
    onHold: c("ON_HOLD"),
    delivered,
    vmh: byCompany.find((r) => r.companyId === "vmh")?._count ?? 0,
    vth: byCompany.find((r) => r.companyId === "vth")?._count ?? 0,
  };
}

export async function taskSummary(s: ScopeFilter, p: Period) {
  const t = now();
  const today = startOfDayIST(t);
  const tomorrow = addDays(today, 1);
  const weekStart = startOfWeekIST(t);
  const open = { ...scopedWhere(s), status: { not: "COMPLETED" as const } };
  const [total, pending, dueToday, overdue, completedWeek, upcoming, createdCur, createdPrev, byCompany] = await Promise.all([
    db.task.count({ where: open }),
    db.task.count({ where: { ...scopedWhere(s), status: "TODO" } }),
    db.task.count({ where: { ...open, dueDate: { gte: today, lt: tomorrow } } }),
    db.task.count({ where: { ...open, dueDate: { lt: today } } }),
    db.task.count({ where: { ...scopedWhere(s), status: "COMPLETED", completedAt: { gte: weekStart } } }),
    db.task.count({ where: { ...open, dueDate: { gte: tomorrow, lt: addDays(today, 8) } } }),
    db.task.count({ where: { ...scopedWhere(s), createdAt: { gte: p.from, lt: p.to } } }),
    db.task.count({ where: { ...scopedWhere(s), createdAt: { gte: p.prevFrom, lt: p.prevTo } } }),
    db.task.groupBy({ by: ["companyId"], _count: true, where: open }),
  ]);
  return {
    total, pending, dueToday, overdue, completedWeek, upcoming, delta: createdCur - createdPrev,
    vmh: byCompany.find((r) => r.companyId === "vmh")?._count ?? 0,
    vth: byCompany.find((r) => r.companyId === "vth")?._count ?? 0,
  };
}

export async function leadSummary(s: ScopeFilter, p: Period) {
  const where = { ...scopedWhere(s), stage: { not: "LOST" as const } };
  const [stages, cur, prev, byCompany] = await Promise.all([
    db.lead.groupBy({ by: ["stage"], _count: true, _sum: { value: true }, where }),
    db.lead.count({ where: { ...where, createdAt: { gte: p.from, lt: p.to } } }),
    db.lead.count({ where: { ...where, createdAt: { gte: p.prevFrom, lt: p.prevTo } } }),
    db.lead.groupBy({ by: ["companyId"], _count: true, where }),
  ]);
  const st = (k: string) => stages.find((g) => g.stage === k);
  const order = ["NEW", "CONTACTED", "PROPOSAL", "NEGOTIATION", "WON"] as const;
  return {
    total: stages.reduce((a, g) => a + g._count, 0),
    delta: cur - prev,
    stages: order.map((k) => ({ stage: k, count: st(k)?._count ?? 0 })),
    pipeline: order.slice(0, 4).reduce((a, k) => a + num(st(k)?._sum.value), 0),
    vmh: byCompany.find((r) => r.companyId === "vmh")?._count ?? 0,
    vth: byCompany.find((r) => r.companyId === "vth")?._count ?? 0,
  };
}

export function activeCampaigns(s: ScopeFilter) {
  return db.emailCampaign.findMany({ where: { ...scopedSharedWhere(s), status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: 3 });
}

/** Most recently set goals still running. */
export async function goalsProgress(s: ScopeFilter) {
  const goals = await db.goal.findMany({ where: { ...scopedSharedWhere(s), scope: { in: ["COMPANY", "TEAM"] }, endDate: { gte: startOfDayIST(now()) } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 4 });
  return goals.reverse().map((g) => ({ ...g, progress: goalProgress(g) }));
}

export async function teamWorkload(s: ScopeFilter) {
  const weekStart = startOfWeekIST(now());
  const weekEnd = addDays(weekStart, 7);
  const users = await db.user.findMany({ where: { isOwner: false, kind: "STAFF", active: true, memberships: { some: { companyId: { in: s.companyIds } } } }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, image: true, weeklyCapacityHours: true } });
  const [logged, planned] = await Promise.all([
    db.timeEntry.groupBy({ by: ["userId"], _sum: { durationMin: true }, where: { ...scopedWhere(s), start: { gte: weekStart, lt: weekEnd } } }),
    db.task.groupBy({ by: ["assigneeId"], _sum: { estimatedMinutes: true }, where: { ...scopedWhere(s), status: { not: "COMPLETED" }, dueDate: { gte: weekStart, lt: weekEnd } } }),
  ]);
  return users.map((u) => {
    const l = num(logged.find((r) => r.userId === u.id)?._sum.durationMin);
    const pl = num(planned.find((r) => r.assigneeId === u.id)?._sum.estimatedMinutes);
    return { ...u, loggedMin: l, pct: workloadPercent(l, pl, u.weeklyCapacityHours) };
  });
}

export function approvalsWaiting(s: ScopeFilter) {
  return db.approval.findMany({ where: { status: "PENDING", project: scopedWhere(s) }, orderBy: { requestedAt: "asc" }, take: 4, include: { project: { select: { name: true, client: { select: { name: true } } } } } });
}

export async function productionBoard(p: Period) {
  const vmh = { companyId: "vmh" };
  const [stages, delivered] = await Promise.all([
    db.task.groupBy({ by: ["productionStage"], _count: true, where: { ...vmh, status: { not: "COMPLETED" }, productionStage: { not: null } } }),
    db.task.findMany({ where: { ...vmh, productionStage: "DELIVERED", deliveredAt: { gte: p.from, lt: p.to } }, select: { editingStartedAt: true, deliveredAt: true } }),
  ]);
  const c = (k: string) => stages.find((g) => g.productionStage === k)?._count ?? 0;
  return {
    EDITING: c("EDITING"), INTERNAL_QC: c("INTERNAL_QC"), CLIENT_REVIEW: c("CLIENT_REVIEW"), REVISION: c("REVISION"), DELIVERED: delivered.length,
    avgTurnaround: avgTurnaroundHours(delivered.map((d) => ({ start: d.editingStartedAt, end: d.deliveredAt }))),
  };
}

export async function deliveryBoard() {
  const weekStart = startOfWeekIST(now());
  const vth = { companyId: "vth" };
  const monthStart = startOfMonthIST(now());
  const [milestones, bugs, tickets, retainers] = await Promise.all([
    db.milestone.count({ where: { project: vth, status: { not: "COMPLETED" }, dueDate: { gte: weekStart, lt: addDays(weekStart, 7) } } }),
    db.bug.count({ where: { project: vth, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, client: { companies: { some: { companyId: "vth" } } } } }),
    db.project.findMany({ where: { ...vth, billingType: "RETAINER_HOURS", status: ACTIVE_PROJECT }, select: { id: true, retainerHours: true } }),
  ]);
  const used = retainers.length
    ? await db.timeEntry.aggregate({ _sum: { durationMin: true }, where: { projectId: { in: retainers.map((r) => r.id) }, status: "APPROVED", start: { gte: monthStart } } })
    : { _sum: { durationMin: 0 } };
  return { milestones, bugs, tickets, retainerUsed: num(used._sum.durationMin) / 60, retainerTotal: retainers.reduce((a, r) => a + (r.retainerHours ?? 0), 0) };
}

export function todaysAgenda(s: ScopeFilter) {
  const today = startOfDayIST(now());
  return db.calendarEvent.findMany({ where: { ...scopedSharedWhere(s), start: { gte: today, lt: addDays(today, 1) } }, orderBy: { start: "asc" }, take: 4 });
}

export function recentActivity(s: ScopeFilter, take = 4) {
  return db.activity.findMany({ where: { ...scopedSharedWhere(s), entityType: { notIn: ["GOAL", "TIME_ENTRY"] } }, orderBy: { createdAt: "desc" }, take, include: { actor: { select: { name: true, image: true } } } });
}

export function crossSellAlerts(s: ScopeFilter) {
  return db.crossSellAlert.findMany({ where: { status: "OPEN", OR: [{ fromCompanyId: { in: s.companyIds } }, { toCompanyId: { in: s.companyIds } }] }, orderBy: { createdAt: "desc" }, take: 2, include: { client: { select: { name: true } }, fromCompany: { select: { code: true } } } });
}

export function clientCount(s: ScopeFilter) {
  return db.client.count({ where: scopedClientWhere(s) });
}
