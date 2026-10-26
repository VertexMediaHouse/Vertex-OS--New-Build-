// Ported from app/(app)/dashboard/page.tsx. One query feeds every card.
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { useSearchParams } from "@/lib/nav";
import { BarsChart, ChartLegend, DonutChart, DonutLegend } from "@/components/shared/charts";
import { DateRangePicker } from "@/components/shared/filters";
import { CardSkeleton, KpiSkeleton, PageHeader } from "@/components/shared/layout";
import { Card, SectionCard } from "@/components/shared/primitives";
import {
  AgendaCard, CampaignsCard, CrossSellCard, donutData, GoalsCard, LeadsKpi, LeadsPipelineCard, NotesCard, OpenTasksCard,
  ProjectsKpi, RevenueKpi, TasksKpi, TeamTasksCard, taskDonutData, WorkloadCard,
} from "@/components/dashboard/cards";
import { COMPANY_COLORS } from "@/lib/chart-colors";
import { firstName, formatLongDate } from "@/lib/format";
import { now } from "@/lib/clock";
import { dayKey, lastDay, resolvePeriod } from "@/lib/period";
import { COMPANY_META } from "@/lib/scope";
import { api, query } from "@/web/api";
import { useTitle } from "@/web/title";

export default function DashboardPage() {
  useTitle("Dashboard");
  const [params] = useSearchParams();
  const sp = Object.fromEntries(params);
  const { data } = useQuery({
    queryKey: ["dashboard", sp],
    queryFn: () => query(api.api.dashboard.$get({ query: { range: sp.range, from: sp.from, to: sp.to, tasks: sp.tasks } })),
  });

  if (!data) return <DashboardSkeleton />;

  const ctx = { scope: data.scope, companyIds: data.companyIds };
  const owner = data.scope === "ALL";
  // The period picker shows the same range the server resolved.
  const period = resolvePeriod({ range: sp.range ?? null, from: sp.from ?? null, to: sp.to ?? null }, now());

  const shared = (
    <>
      <div className="grid gap-3.5 xl:grid-cols-[1.25fr_1fr]">
        <OpenTasksCard tasks={data.openTasks} filter={data.taskFilter} sp={sp} />
        <TeamTasksCard ctx={ctx} people={data.tasksByPerson} />
      </div>
      <div className="grid gap-3.5 xl:grid-cols-[1.25fr_1fr]">
        <NotesCard ctx={ctx} rows={data.notes} />
        <GoalsCard goals={data.goals} />
      </div>
    </>
  );

  if (owner) {
    return (
      <div className="space-y-3.5">
        <PageHeader
          className="mb-5"
          title={<span className="text-[28px]">Welcome back, {firstName(data.name)}! 👋</span>}
          subtitle="Here's what's happening across Vertex Media House and Vertex Tech House."
          actions={
            <Card className="flex items-center gap-3 px-4 py-3">
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-review-soft text-review-text">
                <CalendarDays className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{formatLongDate(now())}</span>
                <span className="block text-2xs text-ink-muted">Let&apos;s make it count today!</span>
              </span>
            </Card>
          }
        />
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
          {/* Revenue is invoice data: hidden from roles without invoice access. */}
          {data.canViewInvoice && <RevenueKpi ctx={ctx} r={data.revenue} owner />}
          <ProjectsKpi ctx={ctx} p={data.projects} owner />
          <TasksKpi ctx={ctx} t={data.taskSummary} owner />
          <LeadsKpi ctx={ctx} l={data.leads} owner />
        </div>
        {shared}
        <div className="grid gap-3.5 xl:grid-cols-[1.17fr_1.14fr_1fr]">
          <CampaignsCard list={data.campaigns} />
          <WorkloadCard ctx={ctx} team={data.workload} />
          <AgendaCard ctx={ctx} events={data.agenda} />
        </div>
        <div className="grid gap-3.5 xl:grid-cols-2">
          <CrossSellCard alerts={data.crossSell} />
        </div>
      </div>
    );
  }

  const code = data.scope as "VMH" | "VTH";
  const projectDonut = donutData(data.projects);
  const taskDonut = taskDonutData(data.taskSummary);
  return (
    <div className="space-y-3.5">
      <PageHeader
        className="mb-5"
        title="Dashboard"
        subtitle={`${COMPANY_META[code].name} (${COMPANY_META[code].tagline})`}
        actions={<DateRangePicker variant="card" preset={period.preset} from={dayKey(period.from)} to={dayKey(lastDay(period))} />}
      />
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        {data.canViewInvoice && <RevenueKpi ctx={ctx} r={data.revenue} />}
        <ProjectsKpi ctx={ctx} p={data.projects} />
        <TasksKpi ctx={ctx} t={data.taskSummary} />
        <LeadsKpi ctx={ctx} l={data.leads} />
      </div>
      <div className="grid gap-3.5 xl:grid-cols-[1.3fr_1fr_1fr_1.1fr]">
        <SectionCard title={`Revenue Trend (${code})`} href="/reports">
          <BarsChart data={data.revenueTrend} xKey="month" series={[{ key: code, label: code, color: COMPANY_COLORS[code], href: `/invoices?co=${code.toLowerCase()}` }]} yFormat="inrCompact" tooltipFormat="inr" height={170} />
        </SectionCard>
        <SectionCard title={`Project Status (${data.scope})`} href="/projects">
          <div className="flex items-center gap-4">
            <DonutChart data={projectDonut} center={data.projects.active} centerLabel="Total" size={110} />
            <DonutLegend items={projectDonut.map((d) => ({ ...d, value: d.value }))} />
          </div>
        </SectionCard>
        <SectionCard title={`Tasks (${data.scope})`} href="/tasks">
          <div className="flex items-center gap-4">
            <DonutChart data={taskDonut} center={data.taskSummary.total} centerLabel="Total" size={110} />
            <DonutLegend items={taskDonut} />
          </div>
        </SectionCard>
        <WorkloadCard ctx={ctx} team={data.workload} compact />
      </div>
      {shared}
      <div className="grid gap-3.5 xl:grid-cols-2">
        <LeadsPipelineCard ctx={ctx} l={data.leadsPipeline} />
        <AgendaCard ctx={ctx} events={data.agenda} compact />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-3.5">
      <div className="h-16" />
      <div className="grid grid-cols-4 gap-3.5">{Array.from({ length: 4 }, (_, i) => <KpiSkeleton key={i} />)}</div>
      <div className="grid grid-cols-3 gap-3.5">{Array.from({ length: 3 }, (_, i) => <CardSkeleton key={i} className="h-60" />)}</div>
    </div>
  );
}

export { ChartLegend };
