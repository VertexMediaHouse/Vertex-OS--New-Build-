import { Suspense } from "react";
import type { Metadata } from "next";
import { ArrowUp, Clock, Download, FileText, Folder, IndianRupee, Lightbulb, Trophy, Users } from "lucide-react";
import { getRequestContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { formatDate, formatDuration, formatINR, formatShortDate } from "@/lib/format";
import { dayKey, lastDay } from "@/lib/period";
import { readParams, type SP } from "@/lib/search-params";
import { COMPANY_COLORS, REPORT_STATUS_COLORS, WORK_CATEGORY_COLORS, WORK_CATEGORY_LABELS } from "@/lib/chart-colors";
import { PROJECT_STATUS } from "@/lib/status";
import { arAgeing, insightSentences, reportData } from "@/lib/metrics/reports";
import { logoColor } from "@/lib/clients";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, SectionCard, Avatar } from "@/components/shared/primitives";
import { CardSkeleton, PageHeader } from "@/components/shared/layout";
import { UnderlineTabs } from "@/components/shared/nav";
import { DateRangePicker } from "@/components/shared/filters";
import { BarList, BarsChart, ChartLegend, DonutChart, DonutLegend, PieChart } from "@/components/shared/charts";
import { CompanyBadge, EnumPill, companyCode } from "@/components/shared/pills";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return <Suspense fallback={<CardSkeleton className="h-96" />}><Reports searchParams={searchParams} /></Suspense>;
}

async function Reports({ searchParams }: { searchParams: Promise<SP> }) {
  const [ctx, sp] = await Promise.all([getRequestContext(), searchParams]);
  if (!can(ctx.user, "view", "report")) return <p className="p-6 text-sm">You don&apos;t have access to reports.</p>;
  const p = readParams(sp);
  const tab = p.str("tab") ?? "overview";
  const d = await reportData(ctx, p.period);
  const split = <T,>(o: { vmh: T; vth: T }, f: (v: T) => React.ReactNode = (v) => String(v)) => (ctx.scope === "ALL" ? [{ value: f(o.vmh), label: "VMH" }, { value: f(o.vth), label: "VTH" }] : undefined);
  const statusData = (Object.keys(REPORT_STATUS_COLORS) as (keyof typeof REPORT_STATUS_COLORS)[]).map((k) => ({ label: PROJECT_STATUS[k]!.label, value: d.status[k], color: REPORT_STATUS_COLORS[k] }));
  const statusTotal = statusData.reduce((a, s) => a + s.value, 0) || 1;
  const catTotal = Object.values(d.categories).reduce((a, b) => a + b, 0) || 1;
  const catData = Object.entries(d.categories).map(([k, v]) => ({ label: WORK_CATEGORY_LABELS[k] ?? k, value: v, color: WORK_CATEGORY_COLORS[k] ?? "#B8C0CC" })).sort((a, b) => b.value - a.value);
  const ticks = Object.fromEntries(d.revenueWeeks.map((w) => [w.week, `${formatShortDate(w.range.from)} - ${formatShortDate(lastDay({ ...p.period, to: w.range.to }))}`]));
  const exportHref = `/reports/export?${new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"))}`;
  const companyLegend = <ChartLegend items={[{ label: "VMH", color: COMPANY_COLORS.VMH }, { label: "VTH", color: COMPANY_COLORS.VTH }]} />;

  return (
    <div className="space-y-3.5">
      <PageHeader title="Reports" subtitle="Get a clear overview of your business performance across all projects and clients." actions={<><DateRangePicker {...p.range} /><a href={exportHref} className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-xs font-medium"><Download className="size-4" /> Export CSV</a><PrintButton /></>} />
      <UnderlineTabs active={tab} tabs={[{ value: "overview", label: "Overview" }, { value: "projects", label: "Projects" }, { value: "team", label: "Team" }, { value: "financial", label: "Financial" }, { value: "clients", label: "Clients" }]} />
      {tab === "overview" && (
        <>
          <div className="grid gap-3.5 md:grid-cols-3 xl:grid-cols-5">
            <KpiCard icon={Folder} tone="blue" label="Total Projects" value={d.kpis.projects.total} trend={d.kpis.projects.trend} split={split(d.kpis.projects)} />
            <KpiCard icon={Clock} tone="purple" label="Total Hours" value={formatDuration(d.kpis.hours.total)} trend={d.kpis.hours.trend} split={split(d.kpis.hours, formatDuration)} />
            <KpiCard icon={IndianRupee} tone="green" label="Total Revenue" value={formatINR(d.kpis.revenue.total)} trend={d.kpis.revenue.trend} split={split(d.kpis.revenue, formatINR)} />
            <KpiCard icon={FileText} tone="orange" label="Invoices Sent" value={d.kpis.invoices.total} trend={d.kpis.invoices.trend} split={split(d.kpis.invoices)} />
            <KpiCard icon={Users} tone="pink" label="Active Clients" value={d.kpis.clients.total} split={split(d.kpis.clients)} />
          </div>
          <div className="grid gap-3.5 xl:grid-cols-[1.15fr_1fr_1.05fr]">
            <SectionCard title="Revenue Overview" action={companyLegend}><BarsChart data={d.revenueWeeks} xKey="week" series={[{ key: "VMH", label: "VMH", color: COMPANY_COLORS.VMH }, { key: "VTH", label: "VTH", color: COMPANY_COLORS.VTH }]} yFormat="inrCompact" tooltipFormat="inr" xTickLines={ticks} height={180} /></SectionCard>
            <SectionCard title="Project Status"><div className="flex items-center gap-5"><DonutChart data={statusData} center={statusTotal} centerLabel="Projects" size={140} thickness={22} /><DonutLegend items={statusData.map((s) => ({ ...s, value: `${s.value} (${Math.round((s.value / statusTotal) * 100)}%)` }))} /></div></SectionCard>
            <SectionCard title="Hours by Team Member"><BarList rows={d.members.slice(0, 5).map((m) => ({ key: m.name, label: <span className="flex items-center gap-2"><Avatar person={m} size={22} />{m.name}</span>, value: m.minutes, display: formatDuration(m.minutes) }))} /></SectionCard>
          </div>
          <div className="grid gap-3.5 xl:grid-cols-3">
            <SectionCard title="Top Clients by Revenue"><BarList rows={d.topClients.map((c) => ({ key: c.name, label: <span className="flex items-center gap-2"><span className="inline-flex size-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: `${logoColor(c.name)}1F`, color: logoColor(c.name) }}>{c.name[0]}</span>{c.name}</span>, value: c.amount, display: formatINR(c.amount) }))} /></SectionCard>
            <SectionCard title="Project Type"><div className="flex items-center gap-5"><PieChart data={catData} size={130} /><DonutLegend items={catData.map((c) => ({ ...c, value: `${Math.round((c.value / catTotal) * 100)}%` }))} /></div></SectionCard>
            <SectionCard title="Monthly Hours" action={companyLegend}><BarsChart data={d.hoursWeeks} xKey="week" series={[{ key: "VMH", label: "VMH", color: COMPANY_COLORS.VMH }, { key: "VTH", label: "VTH", color: COMPANY_COLORS.VTH }]} yFormat="hours" xTickLines={ticks} height={170} /></SectionCard>
          </div>
          <div className="grid gap-3.5 xl:grid-cols-[1fr_250px]">
            <SectionCard title="Recent Projects Report" href="/reports?tab=projects">
              <table className="w-full text-2xs"><thead><tr className="text-left text-ink-2">{["Project Name", "Client", "Company", "Start Date", "End Date", "Revenue", "Hours", "Status"].map((h) => <th key={h} className="bg-surface-muted px-2 py-1.5 font-medium first:rounded-l-md last:rounded-r-md">{h}</th>)}</tr></thead>
                <tbody>{d.recentProjects.map((x) => <tr key={x.id} className="border-b last:border-0"><td className="px-2 py-2 font-medium text-ink">{x.name}</td><td className="px-2 py-2">{x.client?.name}</td><td className="px-2 py-2"><CompanyBadge code={companyCode(x.companyId)} /></td><td className="px-2 py-2">{formatDate(x.startDate)}</td><td className="px-2 py-2">{x.dueDate && formatDate(x.dueDate)}</td><td className="px-2 py-2 tabular">{formatINR(x.revenue)}</td><td className="px-2 py-2">{formatDuration(x.minutes)}</td><td className="px-2 py-2"><EnumPill map={PROJECT_STATUS} value={x.status} size="xs" /></td></tr>)}</tbody>
              </table>
            </SectionCard>
            <SectionCard title="Quick Insights" icon={Lightbulb} tone="amber">
              <ul className="space-y-2">{insightSentences(d.insights).map((s) => { const [Icon, cls] = ({ up: [ArrowUp, "bg-success text-white"], clients: [Users, "bg-blue-soft text-blue"], time: [Clock, "bg-review-soft text-review-text"], trophy: [Trophy, "bg-warning-soft text-warning-text"] } as const)[s.tone]; return <li key={s.text} className="flex items-start gap-2.5 rounded-lg border p-2.5 text-xs text-ink"><span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full ${cls}`}><Icon className="size-3.5" /></span>{s.text}</li>; })}</ul>
            </SectionCard>
          </div>
        </>
      )}
      {tab === "projects" && <ProjectsTab ctx={ctx} />}
      {tab === "team" && (
        <Card className="p-4">
          <h2 className="mb-3 text-lg font-bold text-ink">Team utilisation</h2>
          <table className="w-full text-xs"><thead><tr className="text-left text-ink-2">{["Member", "Hours", "Billable", "Utilisation (billable ÷ available)"].map((h) => <th key={h} className="bg-surface-muted px-2 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>{d.members.map((m) => { const weeks = Math.max(1, (p.period.to.getTime() - p.period.from.getTime()) / (7 * 86_400_000)); const util = (m.billable / (m.capacity * 60 * weeks)) * 100; return <tr key={m.name} className="border-b"><td className="px-2 py-2">{m.name}</td><td className="px-2 py-2">{formatDuration(m.minutes)}</td><td className="px-2 py-2">{formatDuration(m.billable)}</td><td className="px-2 py-2">{Math.round(util)}%</td></tr>; })}</tbody>
          </table>
        </Card>
      )}
      {tab === "financial" && <FinancialTab ctx={ctx} />}
      {tab === "clients" && <ClientsTab ctx={ctx} />}
      <p className="text-2xs text-ink-muted print:block">Period: {formatDate(p.period.from)} – {formatDate(lastDay(p.period))} · {dayKey(p.period.from)}</p>
    </div>
  );
}

async function ProjectsTab({ ctx }: { ctx: Awaited<ReturnType<typeof getRequestContext>> }) {
  const projects = await db.project.findMany({ where: { companyId: { in: ctx.companyIds }, clientId: { not: null } }, include: { client: { select: { name: true } }, invoices: { select: { paidAmount: true } } } });
  const hours = await db.timeEntry.groupBy({ by: ["projectId"], _sum: { durationMin: true }, where: { companyId: { in: ctx.companyIds } } });
  const rows = projects.map((x) => { const collected = x.invoices.reduce((a, i) => a + Number(i.paidAmount), 0); const mins = Number(hours.find((h) => h.projectId === x.id)?._sum.durationMin ?? 0); return { ...x, collected, mins, perHour: mins ? collected / (mins / 60) : null }; }).sort((a, b) => (b.perHour ?? 0) - (a.perHour ?? 0));
  return (
    <Card className="p-4">
      <h2 className="mb-1 text-lg font-bold text-ink">Project profitability</h2>
      <p className="mb-3 text-xs text-ink-muted">Revenue collected ÷ hours logged.</p>
      <table className="w-full text-xs"><thead><tr className="text-left text-ink-2">{["Project", "Client", "Company", "Collected", "Hours", "₹ / hour"].map((h) => <th key={h} className="bg-surface-muted px-2 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((x) => <tr key={x.id} className="border-b"><td className="px-2 py-2">{x.name}</td><td className="px-2 py-2">{x.client?.name}</td><td className="px-2 py-2"><CompanyBadge code={companyCode(x.companyId)} /></td><td className="px-2 py-2">{formatINR(x.collected)}</td><td className="px-2 py-2">{formatDuration(x.mins)}</td><td className="px-2 py-2 font-semibold">{x.perHour === null ? "–" : formatINR(x.perHour)}</td></tr>)}</tbody>
      </table>
    </Card>
  );
}

async function FinancialTab({ ctx }: { ctx: Awaited<ReturnType<typeof getRequestContext>> }) {
  const a = await arAgeing(ctx);
  const rows: [string, number][] = [["Not yet due", a.current], ["0–30 days overdue", a.d0_30], ["31–60 days overdue", a.d31_60], ["60+ days overdue", a.d60plus]];
  return (
    <SectionCard title="Accounts receivable ageing">
      <BarList rows={rows.map(([k, v]) => ({ key: k, label: k, value: v, display: formatINR(v) }))} color="var(--danger)" />
    </SectionCard>
  );
}

async function ClientsTab({ ctx }: { ctx: Awaited<ReturnType<typeof getRequestContext>> }) {
  const [paid, leads] = await Promise.all([
    db.invoice.groupBy({ by: ["clientId"], _sum: { paidAmount: true }, where: { companyId: { in: ctx.companyIds } }, orderBy: { _sum: { paidAmount: "desc" } }, take: 10 }),
    db.lead.groupBy({ by: ["source", "stage"], _count: true, _sum: { value: true }, where: { companyId: { in: ctx.companyIds } } }),
  ]);
  const names = await db.client.findMany({ where: { id: { in: paid.map((x) => x.clientId) } }, select: { id: true, name: true } });
  const sources = [...new Set(leads.map((l) => l.source))].map((s) => { const all = leads.filter((l) => l.source === s); const won = all.filter((l) => l.stage === "WON"); return { s, leads: all.reduce((a, l) => a + l._count, 0), won: won.reduce((a, l) => a + l._count, 0), wonValue: won.reduce((a, l) => a + Number(l._sum.value ?? 0), 0) }; });
  return (
    <div className="grid gap-3.5 xl:grid-cols-2">
      <SectionCard title="Client lifetime value (collected)"><BarList rows={paid.map((x) => ({ key: x.clientId, label: names.find((c) => c.id === x.clientId)?.name ?? "", value: Number(x._sum.paidAmount ?? 0), display: formatINR(x._sum.paidAmount ?? 0) }))} /></SectionCard>
      <SectionCard title="Lead source performance">
        <table className="w-full text-xs"><thead><tr className="text-left text-ink-2">{["Source", "Leads", "Won", "Win rate", "Won value"].map((h) => <th key={h} className="bg-surface-muted px-2 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>{sources.map((x) => <tr key={x.s} className="border-b"><td className="px-2 py-2">{x.s[0] + x.s.slice(1).toLowerCase()}</td><td className="px-2 py-2">{x.leads}</td><td className="px-2 py-2">{x.won}</td><td className="px-2 py-2">{x.leads ? Math.round((x.won / x.leads) * 100) : 0}%</td><td className="px-2 py-2">{formatINR(x.wonValue)}</td></tr>)}</tbody>
        </table>
      </SectionCard>
    </div>
  );
}

