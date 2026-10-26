// Ported from app/(app)/reports/page.tsx: the per-tab Prisma queries moved to the
// server route, the render is unchanged.
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Clock, Download, FileText, Folder, IndianRupee, Lightbulb, Trophy, Users } from "lucide-react";
import { useSearchParams } from "@/lib/nav";
import Link from "@/components/ui/link";
import { formatDate, formatDuration, formatINR, formatShortDate } from "@/lib/format";
import { dayKey, lastDay } from "@/lib/period";
import { readParams } from "@/lib/search-params";
import { COMPANY_COLORS, OTHER_GREY, REPORT_STATUS_COLORS, WORK_CATEGORY_COLORS, WORK_CATEGORY_LABELS, logoColor } from "@/lib/chart-colors";
import { PROJECT_STATUS, insightSentences } from "@/lib/status";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, SectionCard, Avatar } from "@/components/shared/primitives";
import { CardSkeleton, PageHeader } from "@/components/shared/layout";
import { UnderlineTabs } from "@/components/shared/nav";
import { DateRangePicker } from "@/components/shared/filters";
import { BarList, BarsChart, ChartLegend, DonutChart, DonutLegend, PieChart } from "@/components/shared/charts";
import { CompanyBadge, EnumPill, companyCode } from "@/components/shared/pills";
import { API_URL, api, query } from "@/web/api";
import { useTitle } from "@/web/title";
import { PrintButton } from "./print-button";

// The same status groups the projects list can filter by, so a slice opens its own rows.
const STATUS_LIST = { COMPLETED: "completed", IN_PROGRESS: "inProgress", ON_HOLD: "onHold", NOT_STARTED: "notStarted" } as const;

export default function ReportsPage() {
  useTitle("Reports");
  const [params] = useSearchParams();
  const sp = Object.fromEntries(params);
  const { data } = useQuery({ queryKey: ["reports", params.toString()], queryFn: () => query(api.api.reports.$get({ query: sp })) });

  if (!data) return <CardSkeleton className="h-96" />;
  if (!data.allowed) return <p className="p-6 text-sm">You don&apos;t have access to reports.</p>;

  // The same period the server resolved, from the same params.
  const p = readParams(sp);
  const tab = p.str("tab") ?? "overview";
  const d = data.d;
  const split = <T,>(o: { vmh: T; vth: T }, f: (v: T) => React.ReactNode = (v) => String(v)) => (data.scope === "ALL" ? [{ value: f(o.vmh), label: "VMH" }, { value: f(o.vth), label: "VTH" }] : undefined);
  const statusData = (Object.keys(REPORT_STATUS_COLORS) as (keyof typeof REPORT_STATUS_COLORS)[]).map((k) => ({ label: PROJECT_STATUS[k]!.label, value: d.status[k], color: REPORT_STATUS_COLORS[k], href: `/projects?list=${STATUS_LIST[k]}` }));
  const statusTotal = statusData.reduce((a, s) => a + s.value, 0) || 1;
  const catTotal = Object.values(d.categories).reduce((a, b) => a + b, 0) || 1;
  const catData = Object.entries(d.categories).map(([k, v]) => ({ label: WORK_CATEGORY_LABELS[k] ?? k, value: v, color: WORK_CATEGORY_COLORS[k] ?? OTHER_GREY, href: `/time?cat=${k}` })).sort((a, b) => b.value - a.value);
  const ticks = Object.fromEntries(d.revenueWeeks.map((w) => [w.week, `${formatShortDate(new Date(w.range.from))} - ${formatShortDate(lastDay({ ...p.period, to: new Date(w.range.to) }))}`]));
  const exportHref = `${API_URL}/api/reports/export?${new URLSearchParams(sp)}`;
  const legendTo = (base: string) => <ChartLegend items={[{ label: "VMH", color: COMPANY_COLORS.VMH, href: `${base}?co=vmh` }, { label: "VTH", color: COMPANY_COLORS.VTH, href: `${base}?co=vth` }]} />;

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
            <SectionCard title="Revenue Overview" action={legendTo("/invoices")}><BarsChart data={d.revenueWeeks} xKey="week" series={[{ key: "VMH", label: "VMH", color: COMPANY_COLORS.VMH, href: "/invoices?co=vmh" }, { key: "VTH", label: "VTH", color: COMPANY_COLORS.VTH, href: "/invoices?co=vth" }]} yFormat="inrCompact" tooltipFormat="inr" xTickLines={ticks} height={180} /></SectionCard>
            <SectionCard title="Project Status"><div className="flex items-center gap-5"><DonutChart data={statusData} center={statusTotal} centerLabel="Projects" size={140} thickness={22} /><DonutLegend items={statusData.map((s) => ({ ...s, value: `${s.value} (${Math.round((s.value / statusTotal) * 100)}%)` }))} /></div></SectionCard>
            <SectionCard title="Hours by Team Member"><BarList rows={d.members.slice(0, 5).map((m) => ({ key: m.name, label: <span className="flex items-center gap-2"><Avatar person={m} size={22} />{m.name}</span>, value: m.minutes, display: formatDuration(m.minutes), href: `/team/${m.id}` }))} /></SectionCard>
          </div>
          <div className="grid gap-3.5 xl:grid-cols-3">
            <SectionCard title="Top Clients by Revenue"><BarList rows={d.topClients.map((c) => ({ key: c.name, label: <span className="flex items-center gap-2"><span className="inline-flex size-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: `${logoColor(c.name)}1F`, color: logoColor(c.name) }}>{c.name[0]}</span>{c.name}</span>, value: c.amount, display: formatINR(c.amount), href: `/clients/${c.id}` }))} /></SectionCard>
            <SectionCard title="Project Type"><div className="flex items-center gap-5"><PieChart data={catData} size={130} /><DonutLegend items={catData.map((c) => ({ ...c, value: `${Math.round((c.value / catTotal) * 100)}%` }))} /></div></SectionCard>
            <SectionCard title="Monthly Hours" action={legendTo("/time")}><BarsChart data={d.hoursWeeks} xKey="week" series={[{ key: "VMH", label: "VMH", color: COMPANY_COLORS.VMH, href: "/time?co=vmh" }, { key: "VTH", label: "VTH", color: COMPANY_COLORS.VTH, href: "/time?co=vth" }]} yFormat="hours" xTickLines={ticks} height={170} /></SectionCard>
          </div>
          <div className="grid gap-3.5 xl:grid-cols-[1fr_250px]">
            <SectionCard title="Recent Projects Report" href="/reports?tab=projects">
              <table className="w-full text-2xs"><thead><tr className="text-left text-ink-2">{["Project Name", "Client", "Company", "Start Date", "End Date", "Revenue", "Hours", "Status"].map((h) => <th key={h} className="bg-surface-muted px-2 py-1.5 font-medium first:rounded-l-md last:rounded-r-md">{h}</th>)}</tr></thead>
                <tbody>{d.recentProjects.map((x) => <tr key={x.id} className="border-b last:border-0"><td className="px-2 py-2 font-medium text-ink">{x.name}</td><td className="px-2 py-2">{x.client?.name}</td><td className="px-2 py-2"><CompanyBadge code={companyCode(x.companyId)} /></td><td className="px-2 py-2">{formatDate(new Date(x.startDate))}</td><td className="px-2 py-2">{x.dueDate && formatDate(new Date(x.dueDate))}</td><td className="px-2 py-2 tabular">{formatINR(x.revenue)}</td><td className="px-2 py-2">{formatDuration(x.minutes)}</td><td className="px-2 py-2"><EnumPill map={PROJECT_STATUS} value={x.status} size="xs" /></td></tr>)}</tbody>
              </table>
            </SectionCard>
            <SectionCard title="Quick Insights" icon={Lightbulb} tone="amber">
              <ul className="space-y-2">{insightSentences(d.insights).map((s) => { const [Icon, cls] = ({ up: [ArrowUp, "bg-success text-white"], clients: [Users, "bg-brand-soft text-brand-text"], time: [Clock, "bg-review-soft text-review-text"], trophy: [Trophy, "bg-warning-soft text-warning-text"] } as const)[s.tone]; return <li key={s.text} className="flex items-start gap-2.5 rounded-lg border p-2.5 text-xs text-ink"><span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full ${cls}`}><Icon className="size-3.5" /></span>{s.text}</li>; })}</ul>
            </SectionCard>
          </div>
        </>
      )}
      {tab === "projects" && data.projects && (
        <Card className="p-4">
          <h2 className="mb-1 text-lg font-bold text-ink">Project profitability</h2>
          <p className="mb-3 text-xs text-ink-muted">Revenue collected ÷ hours logged.</p>
          <table className="w-full text-xs"><thead><tr className="text-left text-ink-2">{["Project", "Client", "Company", "Collected", "Hours", "₹ / hour"].map((h) => <th key={h} className="bg-surface-muted px-2 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>{data.projects.map((x) => <tr key={x.id} className="border-b"><td className="px-2 py-2">{x.name}</td><td className="px-2 py-2">{x.client?.name}</td><td className="px-2 py-2"><CompanyBadge code={companyCode(x.companyId)} /></td><td className="px-2 py-2">{formatINR(x.collected)}</td><td className="px-2 py-2">{formatDuration(x.mins)}</td><td className="px-2 py-2 font-semibold">{x.perHour === null ? "–" : formatINR(x.perHour)}</td></tr>)}</tbody>
          </table>
        </Card>
      )}
      {tab === "team" && (
        <Card className="p-4">
          <h2 className="mb-3 text-lg font-bold text-ink">Team utilisation</h2>
          <table className="w-full text-xs"><thead><tr className="text-left text-ink-2">{["Member", "Hours", "Billable", "Utilisation (billable ÷ available)"].map((h) => <th key={h} className="bg-surface-muted px-2 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>{d.members.map((m) => { const weeks = Math.max(1, (p.period.to.getTime() - p.period.from.getTime()) / (7 * 86_400_000)); const util = (m.billable / (m.capacity * 60 * weeks)) * 100; return <tr key={m.name} className="border-b"><td className="px-2 py-2">{m.name}</td><td className="px-2 py-2">{formatDuration(m.minutes)}</td><td className="px-2 py-2">{formatDuration(m.billable)}</td><td className="px-2 py-2">{Math.round(util)}%</td></tr>; })}</tbody>
          </table>
        </Card>
      )}
      {tab === "financial" && data.ageing && (
        <SectionCard title="Accounts receivable ageing">
          <BarList rows={([["Not yet due", data.ageing.current, "/invoices?status=PENDING"], ["0–30 days overdue", data.ageing.d0_30, "/invoices?status=OVERDUE"], ["31–60 days overdue", data.ageing.d31_60, "/invoices?status=OVERDUE"], ["60+ days overdue", data.ageing.d60plus, "/invoices?status=OVERDUE"]] as [string, number, string][]).map(([k, v, href]) => ({ key: k, label: k, value: v, display: formatINR(v), href }))} color="var(--danger)" />
        </SectionCard>
      )}
      {tab === "clients" && data.clients && (
        <div className="grid gap-3.5 xl:grid-cols-2">
          <SectionCard title="Client lifetime value (collected)"><BarList rows={data.clients.paid.map((x) => ({ key: x.clientId, label: data.clients!.names.find((c) => c.id === x.clientId)?.name ?? "", value: x.amount, display: formatINR(x.amount), href: `/clients/${x.clientId}` }))} /></SectionCard>
          <SectionCard title="Lead source performance">
            <table className="w-full text-xs"><thead><tr className="text-left text-ink-2">{["Source", "Leads", "Won", "Win rate", "Won value"].map((h) => <th key={h} className="bg-surface-muted px-2 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>{data.clients.sources.map((x) => <tr key={x.s} className="border-b"><td className="px-2 py-2"><Link href={`/leads?source=${x.s}`} className="font-medium text-brand-text hover:underline">{x.s[0] + x.s.slice(1).toLowerCase()}</Link></td><td className="px-2 py-2">{x.leads}</td><td className="px-2 py-2">{x.won}</td><td className="px-2 py-2">{x.leads ? Math.round((x.won / x.leads) * 100) : 0}%</td><td className="px-2 py-2">{formatINR(x.wonValue)}</td></tr>)}</tbody>
            </table>
          </SectionCard>
        </div>
      )}
      <p className="text-2xs text-ink-muted print:block">Period: {formatDate(p.period.from)} – {formatDate(lastDay(p.period))} · {dayKey(p.period.from)}</p>
    </div>
  );
}
