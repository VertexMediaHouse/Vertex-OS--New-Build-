// Ported from app/(app)/reports/{page.tsx,export/route.ts}. The page's per-tab async
// components each ran their own queries; the GET resolves the active tab's data.
import { Hono } from "hono";
import { staffContext, type Env } from "../context";
import { assertCan, can } from "@/lib/auth/permissions";
import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { arAgeing, reportData } from "@/lib/metrics/reports";
import { readParams } from "@/lib/search-params";

async function projectsTab(companyIds: string[]) {
  const projects = await db.project.findMany({ where: { companyId: { in: companyIds }, clientId: { not: null } }, include: { client: { select: { name: true } }, invoices: { select: { paidAmount: true } } } });
  const hours = await db.timeEntry.groupBy({ by: ["projectId"], _sum: { durationMin: true }, where: { companyId: { in: companyIds } } });
  return projects.map((x) => { const collected = x.invoices.reduce((a: any, i: any) => a + Number(i.paidAmount), 0); const mins = Number(hours.find((h) => h.projectId === x.id)?._sum.durationMin ?? 0); return { ...x, client: x.client as { name: string } | null, collected, mins, perHour: mins ? collected / (mins / 60) : null }; }).sort((a, b) => (b.perHour ?? 0) - (a.perHour ?? 0));
}

async function clientsTab(companyIds: string[]) {
  const [paid, leads] = await Promise.all([
    db.invoice.groupBy({ by: ["clientId"], _sum: { paidAmount: true }, where: { companyId: { in: companyIds } }, orderBy: { _sum: { paidAmount: "desc" } }, take: 10 }),
    db.lead.groupBy({ by: ["source", "stage"], _count: true, _sum: { value: true }, where: { companyId: { in: companyIds } } }),
  ]);
  const names = await db.client.findMany({ where: { id: { in: paid.map((x) => x.clientId) } }, select: { id: true, name: true } });
  const sources = [...new Set(leads.map((l) => l.source))].map((s) => { const all = leads.filter((l) => l.source === s); const won = all.filter((l) => l.stage === "WON"); return { s, leads: all.reduce((a, l) => a + l._count, 0), won: won.reduce((a, l) => a + l._count, 0), wonValue: won.reduce((a, l) => a + Number(l._sum.value ?? 0), 0) }; });
  return { paid: paid.map((x) => ({ clientId: x.clientId, amount: Number(x._sum.paidAmount ?? 0) })), names, sources };
}

export const reports = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const user = c.get("user");
    const companyIds = c.get("companyIds");
    if (!can(user, "view", "report")) return c.json({ allowed: false as const });
    const p = readParams(c.req.query());
    const tab = c.req.query("tab") ?? "overview";
    const d = await reportData({ companyIds }, p.period);
    return c.json({
      allowed: true as const,
      scope: c.get("scope"),
      tab,
      period: { preset: p.period.preset, from: p.period.from, to: p.period.to },
      d,
      projects: tab === "projects" ? await projectsTab(companyIds) : null,
      ageing: tab === "financial" ? await arAgeing({ companyIds }) : null,
      clients: tab === "clients" ? await clientsTab(companyIds) : null,
    });
  })
  /**
   * Report as CSV (opens in Excel).
   * shortcut: CSV instead of native .xlsx; add exceljs if formatted multi-sheet workbooks are needed.
   */
  .get("/export", async (c) => {
    assertCan(c.get("user"), "view", "report");
    const p = readParams(c.req.query());
    const d = await reportData({ companyIds: c.get("companyIds") }, p.period);
    const k = d.kpis;
    const rows: unknown[][] = [
      ["KPI", "Total", "VMH", "VTH"],
      ["Projects", k.projects.total, k.projects.vmh, k.projects.vth],
      ["Hours", (k.hours.total / 60).toFixed(2), (k.hours.vmh / 60).toFixed(2), (k.hours.vth / 60).toFixed(2)],
      ["Revenue collected (INR)", k.revenue.total, k.revenue.vmh, k.revenue.vth],
      ["Invoices sent", k.invoices.total, k.invoices.vmh, k.invoices.vth],
      ["Active clients", k.clients.total, k.clients.vmh, k.clients.vth],
      [],
      ["Week", "Revenue VMH", "Revenue VTH", "Hours VMH", "Hours VTH"],
      ...d.revenueWeeks.map((w, i) => [w.week, w.VMH, w.VTH, d.hoursWeeks[i]?.VMH, d.hoursWeeks[i]?.VTH]),
      [],
      ["Team member", "Hours", "Billable hours"],
      ...d.members.map((m) => [m.name, (m.minutes / 60).toFixed(2), (m.billable / 60).toFixed(2)]),
      [],
      ["Top client", "Collected (INR)"],
      ...d.topClients.map((x) => [x.name, x.amount]),
    ];
    return c.body(toCsv(rows[0] as string[], rows.slice(1)), 200, { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="report.csv"' });
  });
