import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { getRequestContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { now } from "@/lib/clock";
import { firstName, formatLongDate } from "@/lib/format";
import { dayKey, lastDay, resolvePeriod } from "@/lib/period";
import { COMPANY_COLORS } from "@/lib/chart-colors";
import { COMPANY_META } from "@/lib/scope";
import * as M from "@/lib/metrics/dashboard";
import { Card, SectionCard } from "@/components/shared/primitives";
import { CardSkeleton, KpiSkeleton, PageHeader } from "@/components/shared/layout";
import { DateRangePicker } from "@/components/shared/filters";
import { BarsChart, ChartLegend, DonutChart, DonutLegend } from "@/components/shared/charts";
import {
  ActivityCard, AgendaCard, ApprovalsCard, CampaignsCard, CrossSellCard, DeliveryCard, donutData, GoalsCard, LeadsKpi, LeadsPipelineCard,
  ProductionCard, ProjectsKpi, RevenueKpi, taskDonutData, TasksKpi, WorkloadCard,
} from "@/components/dashboard/cards";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const [ctx, sp] = await Promise.all([getRequestContext(), searchParams]);
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const period = resolvePeriod({ range: str("range"), from: str("from"), to: str("to") }, now());
  return ctx.scope === "ALL" ? <OwnerDashboard ctx={ctx} period={period} /> : <CompanyDashboard ctx={ctx} period={period} />;
}

type Ctx = Awaited<ReturnType<typeof getRequestContext>>;
type P = ReturnType<typeof resolvePeriod>;
const S = ({ children, h = "h-60" }: { children: React.ReactNode; h?: string }) => <Suspense fallback={<CardSkeleton className={h} />}>{children}</Suspense>;
const K = ({ children }: { children: React.ReactNode }) => <Suspense fallback={<KpiSkeleton />}>{children}</Suspense>;

/** PDF page 1: owner command center (All companies). */
function OwnerDashboard({ ctx, period }: { ctx: Ctx; period: P }) {
  return (
    <div className="space-y-3.5">
      <PageHeader
        className="mb-5"
        title={<span className="text-[28px]">Welcome back, {firstName(ctx.user.name)}! 👋</span>}
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
        {can(ctx.user, "view", "invoice") && <K><RevenueKpi ctx={ctx} period={period} owner /></K>}
        <K><ProjectsKpi ctx={ctx} period={period} owner /></K>
        <K><TasksKpi ctx={ctx} period={period} owner /></K>
        <K><LeadsKpi ctx={ctx} period={period} owner /></K>
      </div>
      <div className="grid gap-3.5 xl:grid-cols-[1.17fr_1.14fr_1fr]">
        <S><CampaignsCard ctx={ctx} /></S>
        <S><GoalsCard ctx={ctx} /></S>
        <S><WorkloadCard ctx={ctx} /></S>
      </div>
      <div className="grid gap-3.5 xl:grid-cols-[1.32fr_1.18fr_1fr]">
        <S h="h-48"><ApprovalsCard ctx={ctx} /></S>
        <S h="h-48"><ProductionCard period={period} /></S>
        <S h="h-48"><DeliveryCard /></S>
      </div>
      <div className="grid gap-3.5 xl:grid-cols-[1fr_0.97fr_1.08fr]">
        <S h="h-48"><AgendaCard ctx={ctx} /></S>
        <S h="h-48"><ActivityCard ctx={ctx} /></S>
        <S h="h-48"><CrossSellCard ctx={ctx} /></S>
      </div>
    </div>
  );
}

/** PDF page 2 (VMH / VTH views): analytics layout for one company. */
function CompanyDashboard({ ctx, period }: { ctx: Ctx; period: P }) {
  const code = ctx.scope as "VMH" | "VTH";
  return (
    <div className="space-y-3.5">
      <PageHeader
        className="mb-5"
        title="Dashboard"
        subtitle={`${COMPANY_META[code].name} (${COMPANY_META[code].tagline})`}
        actions={<DateRangePicker variant="card" preset={period.preset} from={dayKey(period.from)} to={dayKey(lastDay(period))} />}
      />
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        {can(ctx.user, "view", "invoice") && <K><RevenueKpi ctx={ctx} period={period} /></K>}
        <K><ProjectsKpi ctx={ctx} period={period} /></K>
        <K><TasksKpi ctx={ctx} period={period} /></K>
        <K><LeadsKpi ctx={ctx} period={period} /></K>
      </div>
      <div className="grid gap-3.5 xl:grid-cols-[1.3fr_1fr_1fr_1.1fr]">
        <S><RevenueTrend ctx={ctx} /></S>
        <S><ProjectStatus ctx={ctx} period={period} /></S>
        <S><TasksOverview ctx={ctx} period={period} /></S>
        <S><WorkloadCard ctx={ctx} compact /></S>
      </div>
      <div className="grid gap-3.5 xl:grid-cols-[1.2fr_1fr_1fr]">
        <S h="h-40"><LeadsPipelineCard ctx={ctx} /></S>
        <S h="h-40"><AgendaCard ctx={ctx} compact /></S>
        <S h="h-40"><ActivityCard ctx={ctx} compact /></S>
      </div>
    </div>
  );
}

async function RevenueTrend({ ctx }: { ctx: Ctx }) {
  const code = ctx.scope as "VMH" | "VTH";
  const data = await M.revenueTrend(ctx);
  return (
    <SectionCard title={`Revenue Trend (${code})`} href="/reports">
      <BarsChart data={data} xKey="month" series={[{ key: code, label: code, color: COMPANY_COLORS[code] }]} yFormat="inrCompact" tooltipFormat="inr" height={170} />
    </SectionCard>
  );
}

async function ProjectStatus({ ctx, period }: { ctx: Ctx; period: P }) {
  const p = await M.projectSummary(ctx, period);
  const data = donutData(p);
  return (
    <SectionCard title={`Project Status (${ctx.scope})`} href="/projects">
      <div className="flex items-center gap-4">
        <DonutChart data={data} center={p.active} centerLabel="Total" size={110} />
        <DonutLegend items={data.map((d) => ({ ...d, value: d.value }))} />
      </div>
    </SectionCard>
  );
}

async function TasksOverview({ ctx, period }: { ctx: Ctx; period: P }) {
  const t = await M.taskSummary(ctx, period);
  const data = taskDonutData(t);
  return (
    <SectionCard title={`Tasks (${ctx.scope})`} href="/tasks">
      <div className="flex items-center gap-4">
        <DonutChart data={data} center={t.total} centerLabel="Total" size={110} />
        <DonutLegend items={data} />
      </div>
    </SectionCard>
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
