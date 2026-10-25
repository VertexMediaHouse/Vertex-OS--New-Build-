import "server-only";
import { db } from "@/lib/db";
import { addDays, now, startOfDayIST } from "@/lib/clock";
import { pctChange, type Period } from "@/lib/period";
import type { ScopeFilter } from "@/lib/db/scope";

const n = (v: unknown) => Number(v ?? 0);

/** Week buckets inside the period: 1–7, 8–14, 15–21, 22–end (like the PDF). */
export function weekBuckets(p: Period) {
  const out: { from: Date; to: Date; label: string }[] = [];
  for (let i = 0, from = p.from; from < p.to; i++) {
    const to = i === 3 ? p.to : new Date(Math.min(addDays(from, 7).getTime(), p.to.getTime()));
    out.push({ from, to, label: `Week ${i + 1}` });
    from = to;
    if (i === 3) break;
  }
  return out;
}

export async function reportData(s: ScopeFilter, p: Period) {
  const co = { companyId: { in: s.companyIds } };
  const inP = { gte: p.from, lt: p.to };
  const prevP = { gte: p.prevFrom, lt: p.prevTo };
  const [projects, projectsPrev, time, timePrev, payments, paymentsPrev, invoicesSent, invoicesPrev, statusRows, recentProjects] = await Promise.all([
    db.project.groupBy({ by: ["companyId"], _count: true, where: { ...co, clientId: { not: null }, startDate: { lt: p.to }, OR: [{ completedAt: null }, { completedAt: { gte: p.from } }] } }),
    db.project.count({ where: { ...co, clientId: { not: null }, startDate: { lt: p.prevTo }, OR: [{ completedAt: null }, { completedAt: { gte: p.prevFrom } }] } }),
    db.timeEntry.findMany({ where: { ...co, start: inP, status: { not: "RUNNING" } }, select: { companyId: true, userId: true, durationMin: true, billable: true, start: true, projectId: true, category: true, project: { select: { category: true } }, user: { select: { name: true, image: true, isOwner: true, weeklyCapacityHours: true } } } }),
    db.timeEntry.aggregate({ _sum: { durationMin: true }, where: { ...co, start: prevP, status: { not: "RUNNING" } } }),
    db.payment.findMany({ where: { date: inP, invoice: co }, select: { amount: true, date: true, invoice: { select: { companyId: true, clientId: true, client: { select: { name: true } } } } } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { date: prevP, invoice: co } }),
    db.invoice.groupBy({ by: ["companyId"], _count: true, where: { ...co, issueDate: inP, status: { notIn: ["DRAFT", "CANCELLED"] } } }),
    db.invoice.count({ where: { ...co, issueDate: prevP, status: { notIn: ["DRAFT", "CANCELLED"] } } }),
    db.project.groupBy({ by: ["status"], _count: true, where: { ...co, clientId: { not: null }, startDate: { lt: p.to }, OR: [{ completedAt: null }, { completedAt: { gte: p.from } }] } }),
    db.project.findMany({ where: { ...co, clientId: { not: null } }, orderBy: [{ startDate: "desc" }], take: 5, include: { client: { select: { name: true } }, invoices: { select: { total: true } } } }),
  ]);
  const activeClients = new Set(time.filter((t) => t.projectId).map((t) => t.projectId));
  const clientIdsWithWork = await db.project.findMany({ where: { id: { in: [...activeClients] as string[] } }, select: { clientId: true, companyId: true } });
  const minutes = (f: (t: (typeof time)[number]) => boolean = () => true) => time.filter(f).reduce((a, t) => a + (t.durationMin ?? 0), 0);
  const revenue = (c?: string) => payments.filter((x) => !c || x.invoice.companyId === c).reduce((a, x) => a + n(x.amount), 0);
  const weeks = weekBuckets(p);

  const byMember = new Map<string, { id: string; name: string; image: string | null; minutes: number; billable: number; capacity: number }>();
  for (const t of time) {
    if (t.user.isOwner) continue;
    const m = byMember.get(t.userId) ?? { id: t.userId, name: t.user.name, image: t.user.image, minutes: 0, billable: 0, capacity: t.user.weeklyCapacityHours };
    m.minutes += t.durationMin ?? 0;
    if (t.billable) m.billable += t.durationMin ?? 0;
    byMember.set(t.userId, m);
  }
  const byClient = new Map<string, { id: string; name: string; amount: number }>();
  for (const x of payments) {
    const c = byClient.get(x.invoice.clientId) ?? { id: x.invoice.clientId, name: x.invoice.client.name, amount: 0 };
    c.amount += n(x.amount);
    byClient.set(x.invoice.clientId, c);
  }
  const cats: Record<string, number> = {};
  for (const t of time) { const c = t.category ?? t.project?.category ?? "OTHER"; cats[c] = (cats[c] ?? 0) + (t.durationMin ?? 0); }
  const recentHours = await db.timeEntry.groupBy({ by: ["projectId"], _sum: { durationMin: true }, where: { projectId: { in: recentProjects.map((x) => x.id) } } });
  const completedInP = await db.project.count({ where: { ...co, status: "COMPLETED", completedAt: inP } });
  const newClients = await db.client.count({ where: { createdAt: inP, companies: { some: { companyId: { in: s.companyIds } } } } });
  const prevMinutes = n(timePrev._sum.durationMin);

  return {
    kpis: {
      projects: { total: projects.reduce((a, r) => a + r._count, 0), vmh: projects.find((r) => r.companyId === "vmh")?._count ?? 0, vth: projects.find((r) => r.companyId === "vth")?._count ?? 0, trend: pctChange(projects.reduce((a, r) => a + r._count, 0), projectsPrev) },
      hours: { total: minutes(), vmh: minutes((t) => t.companyId === "vmh"), vth: minutes((t) => t.companyId === "vth"), trend: pctChange(minutes(), prevMinutes) },
      revenue: { total: revenue(), vmh: revenue("vmh"), vth: revenue("vth"), trend: pctChange(revenue(), n(paymentsPrev._sum.amount)) },
      invoices: { total: invoicesSent.reduce((a, r) => a + r._count, 0), vmh: invoicesSent.find((r) => r.companyId === "vmh")?._count ?? 0, vth: invoicesSent.find((r) => r.companyId === "vth")?._count ?? 0, trend: pctChange(invoicesSent.reduce((a, r) => a + r._count, 0), invoicesPrev) },
      clients: { total: new Set(clientIdsWithWork.map((c) => c.clientId)).size, vmh: new Set(clientIdsWithWork.filter((c) => c.companyId === "vmh").map((c) => c.clientId)).size, vth: new Set(clientIdsWithWork.filter((c) => c.companyId === "vth").map((c) => c.clientId)).size },
    },
    revenueWeeks: weeks.map((w) => ({ week: w.label, range: w, VMH: payments.filter((x) => x.invoice.companyId === "vmh" && x.date >= w.from && x.date < w.to).reduce((a, x) => a + n(x.amount), 0), VTH: payments.filter((x) => x.invoice.companyId === "vth" && x.date >= w.from && x.date < w.to).reduce((a, x) => a + n(x.amount), 0) })),
    hoursWeeks: weeks.map((w) => ({ week: w.label, range: w, VMH: Math.round(minutes((t) => t.companyId === "vmh" && t.start >= w.from && t.start < w.to) / 6) / 10, VTH: Math.round(minutes((t) => t.companyId === "vth" && t.start >= w.from && t.start < w.to) / 6) / 10 })),
    status: { COMPLETED: statusRows.filter((r) => r.status === "COMPLETED").reduce((a, r) => a + r._count, 0), ON_HOLD: statusRows.filter((r) => r.status === "ON_HOLD").reduce((a, r) => a + r._count, 0), NOT_STARTED: statusRows.filter((r) => r.status === "NOT_STARTED" || r.status === "PLANNING").reduce((a, r) => a + r._count, 0), IN_PROGRESS: statusRows.filter((r) => !["COMPLETED", "ON_HOLD", "NOT_STARTED", "PLANNING", "CANCELLED"].includes(r.status)).reduce((a, r) => a + r._count, 0) },
    members: [...byMember.values()].sort((a, b) => b.minutes - a.minutes),
    topClients: [...byClient.values()].sort((a, b) => b.amount - a.amount).slice(0, 5),
    categories: cats,
    recentProjects: recentProjects.map((x) => ({ ...x, revenue: x.invoices.reduce((a, i) => a + n(i.total), 0), minutes: n(recentHours.find((h) => h.projectId === x.id)?._sum.durationMin) })),
    insights: { revenueChange: pctChange(revenue(), n(paymentsPrev._sum.amount)), newClients, hoursChange: pctChange(minutes(), prevMinutes), hours: minutes(), completed: completedInP },
  };
}

/** Rule-based sentences from the metric deltas (unit-tested). */
export function insightSentences(i: { revenueChange: number | null; newClients: number; hoursChange: number | null; hours: number; completed: number }): { tone: "up" | "clients" | "time" | "trophy"; text: string }[] {
  const out: { tone: "up" | "clients" | "time" | "trophy"; text: string }[] = [];
  if (i.revenueChange !== null) out.push({ tone: "up", text: `Revenue ${i.revenueChange >= 0 ? "increased" : "decreased"} by ${Math.abs(Math.round(i.revenueChange))}% compared to last period.` });
  out.push({ tone: "clients", text: `${i.newClients} new client${i.newClients === 1 ? "" : "s"} added this period.` });
  if (i.hoursChange !== null) out.push({ tone: "time", text: `Team productivity ${i.hoursChange >= 0 ? "up" : "down"} by ${Math.abs(Math.round(i.hoursChange))}% (${Math.round(i.hours / 60)}h this period).` });
  out.push({ tone: "trophy", text: `${i.completed} project${i.completed === 1 ? "" : "s"} completed this period.` });
  return out;
}

/** Financial tab: receivables by age of the due date. */
export async function arAgeing(s: ScopeFilter) {
  const today = startOfDayIST(now());
  const open = await db.invoice.findMany({ where: { companyId: { in: s.companyIds }, status: { in: ["PENDING", "OVERDUE"] } }, select: { total: true, paidAmount: true, dueDate: true } });
  const buckets = { current: 0, d0_30: 0, d31_60: 0, d60plus: 0 };
  for (const i of open) {
    const bal = n(i.total) - n(i.paidAmount);
    const days = Math.floor((today.getTime() - i.dueDate.getTime()) / 86_400_000);
    if (days <= 0) buckets.current += bal;
    else if (days <= 30) buckets.d0_30 += bal;
    else if (days <= 60) buckets.d31_60 += bal;
    else buckets.d60plus += bal;
  }
  return buckets;
}
