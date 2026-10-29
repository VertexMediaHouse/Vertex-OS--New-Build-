// Ported from app/(app)/dashboard/page.tsx. One query feeds every card.
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock, FolderKanban, SquareCheckBig } from "lucide-react";
import Link from "@/components/ui/link";
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
    placeholderData: (previousData) => previousData,
    staleTime: 60_000,
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

  if (data.isMember) {
    const code = (data.scope === "ALL" ? "VMH" : data.scope) as "VMH" | "VTH";
    const meta = COMPANY_META[code] ?? COMPANY_META.VMH;
    const projectDonut = donutData(data.projects);

    return (
      <div className="space-y-4">
        <PageHeader
          className="mb-5"
          title={
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[28px] font-bold text-ink">Welcome, {firstName(data.name)}! 👋</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-text">
                <span className="size-2 rounded-full bg-brand-strong animate-pulse" />
                {code} Employee Workspace
              </span>
            </div>
          }
          subtitle={`${data.role ?? data.title ?? "Team Member"} · ${meta.name} (${meta.tagline})`}
          actions={
            <div className="flex items-center gap-3">
              <Card className="flex items-center gap-3 px-4 py-2.5">
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-info-soft text-brand-text">
                  <Clock className="size-5" aria-hidden />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink">{data.myHours?.hours ?? 0}h Logged</span>
                    <span className="text-2xs text-ink-muted">/ {data.myHours?.capacityHours ?? 40}h capacity</span>
                  </div>
                  <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full bg-brand-strong transition-all"
                      style={{ width: `${data.myHours?.pct ?? 0}%` }}
                    />
                  </div>
                </div>
              </Card>
              <Card className="hidden items-center gap-3 px-4 py-2.5 sm:flex">
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-review-soft text-review-text">
                  <CalendarDays className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-xs font-semibold text-ink">{formatLongDate(now())}</span>
                  <span className="block text-2xs text-ink-muted">Ready to create!</span>
                </span>
              </Card>
            </div>
          }
        />

        {/* 4 Employee KPI Cards */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <Link href="/tasks" className="block transition-transform hover:-translate-y-0.5">
            <Card className="p-4 hover:border-brand/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">My Open Tasks</span>
                <span className="rounded-md bg-info-soft p-1.5 text-brand-text">
                  <SquareCheckBig className="size-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-ink">{data.taskSummary.total}</span>
                {data.taskSummary.dueToday > 0 && (
                  <span className="text-xs font-medium text-warning-text">({data.taskSummary.dueToday} due today)</span>
                )}
                {data.taskSummary.overdue > 0 && (
                  <span className="text-xs font-medium text-danger-text">({data.taskSummary.overdue} overdue)</span>
                )}
              </div>
              <p className="mt-1 text-2xs text-ink-muted">{data.taskSummary.completedWeek} completed this week</p>
            </Card>
          </Link>

          <Link href="/projects" className="block transition-transform hover:-translate-y-0.5">
            <Card className="p-4 hover:border-brand/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Active Projects</span>
                <span className="rounded-md bg-success-soft p-1.5 text-success-text">
                  <FolderKanban className="size-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-ink">{data.projects.active}</span>
                <span className="text-xs text-ink-muted">assigned to me</span>
              </div>
              <p className="mt-1 text-2xs text-ink-muted">{data.projects.inProgress} in progress · {data.projects.delivered} delivered</p>
            </Card>
          </Link>

          <Link href="/time" className="block transition-transform hover:-translate-y-0.5">
            <Card className="p-4 hover:border-brand/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Weekly Logged Time</span>
                <span className="rounded-md bg-warning-soft p-1.5 text-warning-text">
                  <Clock className="size-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-ink">{data.myHours?.hours ?? 0}h</span>
                <span className="text-xs font-semibold text-brand-text">{data.myHours?.pct ?? 0}% capacity</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-brand-strong" style={{ width: `${data.myHours?.pct ?? 0}%` }} />
              </div>
            </Card>
          </Link>

          <Link href="/goals" className="block transition-transform hover:-translate-y-0.5">
            <Card className="p-4 hover:border-brand/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Company Deliverables</span>
                <span className="rounded-md bg-review-soft p-1.5 text-review-text">
                  <CheckCircle2 className="size-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-ink">{data.goals.length}</span>
                <span className="text-xs text-ink-muted">active targets</span>
              </div>
              <p className="mt-1 text-2xs text-ink-muted">{data.goals.filter((g: any) => g.progress >= 100).length} goals achieved</p>
            </Card>
          </Link>
        </div>

        {/* Tasks & Project Status Visuals */}
        <div className="grid gap-3.5 xl:grid-cols-[1.25fr_1fr]">
          <OpenTasksCard tasks={data.openTasks} filter={data.taskFilter} sp={sp} />
          <SectionCard title={`Project Status (${code})`} href="/projects">
            <div className="flex items-center justify-around py-3">
              <DonutChart data={projectDonut} center={data.projects.active} centerLabel="Active" size={130} />
              <DonutLegend items={projectDonut} />
            </div>
          </SectionCard>
        </div>

        {/* Notes, Goals & Agenda */}
        <div className="grid gap-3.5 xl:grid-cols-[1.1fr_1fr_1fr]">
          <NotesCard ctx={ctx} rows={data.notes} />
          <GoalsCard goals={data.goals} />
          <AgendaCard ctx={ctx} events={data.agenda} compact />
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
