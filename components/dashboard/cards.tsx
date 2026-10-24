// Dashboard cards shared by the owner (page 1) and company (page 2) layouts.
import Link from "next/link";
import {
  Activity, AlertCircle, Bug, CalendarDays, CircleCheck, Clock, Code2, Folder, Headphones, Lightbulb, Play, ReceiptIndianRupee, Send, Target, Users, UsersRound, Video,
} from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, IconTile, Inset, ProgressBar, SectionCard, SegmentedBar, ViewAll, type TileTone } from "@/components/shared/primitives";
import { Avatar } from "@/components/shared/primitives";
import { Chip, CompanyBadge, StatusPill, companyCode } from "@/components/shared/pills";
import { ActivityRow } from "@/components/shared/display";
import { DonutLegend } from "@/components/shared/charts";
import { formatINR, formatRelative, formatTimePadded } from "@/lib/format";
import { now } from "@/lib/clock";
import { waitingDays, workloadState } from "@/lib/metrics/workload";
import type { ScopeFilter } from "@/lib/db/scope";
import type { Period } from "@/lib/period";
import { parseCompanySettings } from "@/lib/settings";
import { db } from "@/lib/db";
import * as M from "@/lib/metrics/dashboard";
import { PRODUCTION_STAGE_COLORS, PROJECT_STATUS_COLORS, TASK_OVERVIEW_COLORS } from "@/lib/chart-colors";
import { CrossSellActions } from "./cross-sell-actions";

type Ctx = ScopeFilter & { scope: "ALL" | "VMH" | "VTH" };
const suffix = (s: Ctx) => (s.scope === "ALL" ? "" : ` (${s.scope})`);

// ── KPI row ─────────────────────────────────────────────────────────────
export async function RevenueKpi({ ctx, period, owner }: { ctx: Ctx; period: Period; owner?: boolean }) {
  const r = await M.revenueSummary(ctx, period);
  return (
    <KpiCard
      href="/invoices"
      icon={ReceiptIndianRupee}
      tone="green"
      label="Total Revenue"
      suffix={owner ? "(This Month)" : undefined}
      value={formatINR(r.total)}
      trend={r.trend}
      size={owner ? "lg" : "md"}
      split={owner ? [{ value: formatINR(r.collected), label: "Collected" }, { value: formatINR(r.outstanding), label: "Outstanding" }] : ctx.scope === "ALL" ? [{ value: formatINR(r.vmh), label: "VMH" }, { value: formatINR(r.vth), label: "VTH" }] : undefined}
    />
  );
}

export async function ProjectsKpi({ ctx, period, owner }: { ctx: Ctx; period: Period; owner?: boolean }) {
  const p = await M.projectSummary(ctx, period);
  const legend = [
    { label: "Not started", value: p.notStarted, color: "#9CBCD4" },
    { label: "In progress", value: p.inProgress, color: "#3888FC" },
    { label: "In review", value: p.inReview, color: "#ECBC30" },
    { label: "On hold", value: p.onHold, color: "#F06464" },
    { label: "Delivered", value: p.delivered, color: "#0E7C66" },
  ];
  return (
    <KpiCard href="/projects" icon={Folder} tone="blue" label="Active Projects" value={p.active} trend={p.delta} trendUnit="" split={owner || ctx.scope !== "ALL" ? undefined : [{ value: p.vmh, label: "VMH" }, { value: p.vth, label: "VTH" }]}>
      {owner && (
        <div className="mt-5 space-y-3">
          <SegmentedBar segments={[legend[1]!, legend[0]!, legend[2]!, legend[3]!, legend[4]!]} />
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-2xs text-ink-2">
            {legend.map((l) => (
              <li key={l.label} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: l.color }} aria-hidden />
                <span className="font-semibold text-ink">{l.value}</span> {l.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </KpiCard>
  );
}

export async function TasksKpi({ ctx, period, owner }: { ctx: Ctx; period: Period; owner?: boolean }) {
  const t = await M.taskSummary(ctx, period);
  const rows = [
    { label: "Pending", value: t.pending, color: "#3888FC" },
    { label: "Due today", value: t.dueToday, color: "#ECBC30" },
    { label: "Overdue", value: t.overdue, color: "#F06464" },
    { label: "Completed this week", value: t.completedWeek, color: "#334155" },
    { label: "Upcoming", value: t.upcoming, color: "#60A5FA" },
  ];
  return (
    <KpiCard href="/tasks" icon={CircleCheck} tone="purple" label="Open Tasks" value={t.total} trend={owner ? undefined : t.delta} trendUnit="" split={owner || ctx.scope !== "ALL" ? undefined : [{ value: t.vmh, label: "VMH" }, { value: t.vth, label: "VTH" }]}>
      {owner && (
        <ul className="mt-4 space-y-1 text-xs text-ink-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2.5">
              <span className="size-2 rounded-full" style={{ background: r.color }} aria-hidden />
              <span className="w-5 font-semibold text-ink tabular">{r.value}</span>
              {r.label}
            </li>
          ))}
        </ul>
      )}
    </KpiCard>
  );
}

const STAGE_DOT: Record<string, string> = { NEW: "#3888FC", CONTACTED: "#3888FC", PROPOSAL: "#8B5CF6", NEGOTIATION: "#C026D3", WON: "#10B981" };
const STAGE_LABEL: Record<string, string> = { NEW: "New", CONTACTED: "Contacted", PROPOSAL: "Proposal", NEGOTIATION: "Negotiation", WON: "Won" };

export async function LeadsKpi({ ctx, period, owner }: { ctx: Ctx; period: Period; owner?: boolean }) {
  const l = await M.leadSummary(ctx, period);
  return (
    <KpiCard href="/leads" icon={Users} tone="pink" label="Ongoing Leads" value={l.total} trend={l.delta} trendUnit="" split={owner || ctx.scope !== "ALL" ? undefined : [{ value: l.vmh, label: "VMH" }, { value: l.vth, label: "VTH" }]}>
      {owner && (
        <div className="mt-3 flex gap-4">
          <ul className="flex-1 space-y-1 text-xs text-ink-2">
            {l.stages.map((s) => (
              <li key={s.stage} className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: STAGE_DOT[s.stage] }} aria-hidden />
                <span className="flex-1">{STAGE_LABEL[s.stage]}</span>
                <span className="font-semibold text-ink tabular">{s.count}</span>
              </li>
            ))}
          </ul>
          <Inset className="flex w-[124px] flex-col justify-center px-3 py-4">
            <span className="text-xs text-ink-muted">Pipeline Value</span>
            <span className="mt-1 text-lg font-bold text-ink tabular">{formatINR(l.pipeline)}</span>
          </Inset>
        </div>
      )}
    </KpiCard>
  );
}

// ── Owner rows ──────────────────────────────────────────────────────────
export async function CampaignsCard({ ctx }: { ctx: Ctx }) {
  const list = await M.activeCampaigns(ctx);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  return (
    <SectionCard title="Email Campaigns" icon={Send} tone="blue" subtitle={`${list.length} Active Campaigns`} href="/campaigns">
      <div className="space-y-1.5">
        {list.map((c) => (
          <Link key={c.id} href={`/campaigns?id=${c.id}`} className="grid grid-cols-[minmax(0,1fr)_48px_48px_60px_auto] items-center gap-2 rounded-lg border px-3 py-1.5 hover:bg-[#F8FAFC]">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-ink">{c.name}</p>
              <p className="text-2xs text-ink-muted">{c.sentCount.toLocaleString("en-IN")} sent</p>
            </div>
            <Metric value={`${pct(c.openCount, c.sentCount)}%`} label="open" className="text-success-text" />
            <Metric value={`${pct(c.replyCount, c.sentCount)}%`} label="reply" className="text-danger-text" />
            <Metric value={String(c.meetingsCount)} label="meetings" className="text-ink" />
            <CompanyBadge code={companyCode(c.companyId)} />
          </Link>
        ))}
      </div>
    </SectionCard>
  );
}

function Metric({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <div className="text-center">
      <p className={`text-sm font-semibold ${className}`}>{value}</p>
      <p className="text-2xs text-ink-muted">{label}</p>
    </div>
  );
}

export async function GoalsCard({ ctx }: { ctx: Ctx }) {
  const goals = await M.goalsProgress(ctx);
  const fmt = (g: (typeof goals)[number], v: unknown) => (g.unit === "CURRENCY" ? formatINR(Number(v)) : String(Number(v)));
  return (
    <SectionCard title="Goals Progress" icon={Target} tone="green" href="/goals">
      <div className="space-y-2">
        {goals.map((g) => (
          <Link key={g.id} href={`/goals?view=detailed&id=${g.id}`} className="grid grid-cols-[minmax(0,1fr)_110px_36px_auto] items-center gap-3 rounded-lg hover:bg-[#F8FAFC]">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-ink">{g.title}</p>
              <p className="text-2xs text-ink-muted">{g.subtitle}</p>
            </div>
            <div>
              <ProgressBar value={g.progress} tone={g.progress >= 100 || g.status === "COMPLETED" ? "success" : g.progress >= 80 ? "success" : "primary"} />
              <p className="mt-1 text-[10.5px] text-ink-muted tabular">
                {fmt(g, g.currentValue)} / {fmt(g, g.targetValue)}
              </p>
            </div>
            <span className="text-xs font-semibold text-ink tabular">{Math.round(g.progress)}%</span>
            <CompanyBadge code={companyCode(g.companyId)} />
          </Link>
        ))}
      </div>
    </SectionCard>
  );
}

export async function WorkloadCard({ ctx, compact }: { ctx: Ctx; compact?: boolean }) {
  const team = (await M.teamWorkload(ctx)).slice(0, 4);
  const tone = { over: "danger", idle: "warning", ok: "success" } as const;
  return (
    <SectionCard title={`Team Workload${suffix(ctx)}`} icon={compact ? undefined : UsersRound} tone="orange" href="/team">
      <div className="space-y-2.5">
        {team.map((u) => {
          const st = workloadState(u.pct);
          return (
            <Link key={u.id} href={`/team/${u.id}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_40px_36px] items-center gap-3 rounded-lg hover:bg-[#F8FAFC]">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar person={u} size={compact ? 28 : 32} />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink">{u.name}</p>
                  {!compact && <p className="text-2xs text-ink-muted">{Math.round(u.loggedMin / 60)}h this week</p>}
                </div>
              </div>
              <ProgressBar value={u.pct} tone={tone[st]} />
              <span className={`text-right text-xs font-semibold tabular ${st === "over" ? "text-danger-text" : "text-ink"}`}>{Math.round(u.pct)}%</span>
              <span>{st === "over" ? <Chip tone="danger">Over</Chip> : st === "idle" ? <Chip tone="warning">Idle</Chip> : null}</span>
            </Link>
          );
        })}
      </div>
    </SectionCard>
  );
}

export async function ApprovalsCard({ ctx }: { ctx: Ctx }) {
  const list = await M.approvalsWaiting(ctx);
  const t = now();
  return (
    <SectionCard title="Client Approvals Waiting" icon={Clock} tone="orange" href="/projects?list=review">
      <table className="w-full text-2xs">
        <thead>
          <tr className="text-left text-ink-2">
            {["Client", "Project", "Deliverable", "Waiting Since"].map((h, i) => (
              <th key={h} className={`bg-surface-muted px-2 py-1.5 font-medium ${i === 0 ? "rounded-l-md" : ""} ${i === 3 ? "rounded-r-md" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((a) => {
            const d = waitingDays(a.requestedAt, t);
            return (
              <tr key={a.id} className="border-b last:border-0">
                <td className="px-2 py-1 text-ink">{a.project.client?.name}</td>
                <td className="px-2 py-1 text-ink-2">{a.project.name}</td>
                <td className="px-2 py-1">
                  <Link href={`/projects?id=${a.projectId}`} className="text-ink-2 underline underline-offset-2 hover:text-blue">{a.title}</Link>
                </td>
                <td className="px-2 py-1">
                  <StatusPill dot={false} size="xs" tone={d >= 2 ? "danger" : "warning"} label={`${d} day${d === 1 ? "" : "s"}`} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </SectionCard>
  );
}

const STAGES: ["EDITING" | "INTERNAL_QC" | "CLIENT_REVIEW" | "REVISION" | "DELIVERED", string][] = [["EDITING", "Editing"], ["INTERNAL_QC", "Internal QC"], ["CLIENT_REVIEW", "Client Review"], ["REVISION", "Revision"], ["DELIVERED", "Delivered"]];

export async function ProductionCard({ period }: { period: Period }) {
  const [b, company] = await Promise.all([M.productionBoard(period), db.company.findUnique({ where: { id: "vmh" }, select: { settings: true } })]);
  const target = parseCompanySettings(company?.settings).turnaroundTargetHours;
  const onTrack = b.avgTurnaround === null || b.avgTurnaround <= target.max;
  return (
    <SectionCard
      title="VMH Production Board"
      icon={Play}
      tone="red"
      subtitle={<>Avg. Turnaround: <span className="font-semibold text-ink">{b.avgTurnaround === null ? "–" : `${Math.round(b.avgTurnaround)} hours`}</span></>}
      action={<span className="flex items-center gap-2"><StatusPill dot={false} tone={onTrack ? "success" : "danger"} label={onTrack ? "On Track" : "Delayed"} /><ViewAll href="/projects?list=active" /></span>}
    >
      <div className="grid grid-cols-5 divide-x">
        {STAGES.map(([k, label]) => (
          <div key={k} className="px-2 first:pl-0">
            <p className="text-[10.5px] whitespace-nowrap text-ink-2">{label}</p>
            <p className="mt-1 text-sm font-bold text-ink tabular">{b[k]}</p>
            <div className="mt-1.5 h-1.5 rounded-full" style={{ background: PRODUCTION_STAGE_COLORS[k] }} />
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-2xs text-ink-muted">
        <AlertCircle className="size-3.5 text-blue" aria-hidden /> Target: {target.min}–{target.max} hours for Shorts
      </p>
    </SectionCard>
  );
}

export async function DeliveryCard() {
  const d = await M.deliveryBoard();
  const pct = d.retainerTotal ? (d.retainerUsed / d.retainerTotal) * 100 : 0;
  const row = (Icon: typeof Bug, cls: string, label: string, value: React.ReactNode) => (
    <div className="flex items-center gap-2.5 py-1 text-xs">
      <span className={`inline-flex size-6 items-center justify-center rounded-md ${cls}`}><Icon className="size-3.5" aria-hidden /></span>
      <span className="flex-1 text-ink">{label}</span>
      <span className="font-semibold text-ink tabular">{value}</span>
    </div>
  );
  return (
    <SectionCard title="VTH Delivery Board" icon={Code2} tone="blue" href="/projects?list=active">
      {row(CalendarDays, "bg-info-soft text-info-text", "Milestones Due This Week", d.milestones)}
      {row(Bug, "bg-danger-soft text-danger-text", "Open Bugs", d.bugs)}
      {row(Headphones, "bg-success-soft text-success-text", "Support Tickets", d.tickets)}
      <div className="flex items-center gap-2.5 py-1.5 text-xs">
        <span className="inline-flex size-6 items-center justify-center rounded-md bg-review-soft text-review-text"><Clock className="size-3.5" aria-hidden /></span>
        <span className="flex-1 text-ink">Retainer Hours Used</span>
        <div className="w-[96px]">
          <p className="text-xs font-semibold text-ink tabular">{Math.round(d.retainerUsed)}h / {d.retainerTotal}h</p>
          <ProgressBar value={pct} tone="success" className="mt-1" />
        </div>
        <span className="w-9 text-right font-semibold text-ink tabular">{Math.round(pct)}%</span>
      </div>
    </SectionCard>
  );
}

export async function AgendaCard({ ctx, compact }: { ctx: Ctx; compact?: boolean }) {
  const events = await M.todaysAgenda(ctx);
  return (
    <SectionCard title={`Today's Agenda${suffix(ctx)}`} icon={compact ? undefined : CalendarDays} tone="blue" href="/calendar">
      <ul className="space-y-1">
        {events.length === 0 && <li className="py-4 text-center text-xs text-ink-muted">Nothing scheduled today.</li>}
        {events.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-1 text-xs">
            <span className="w-16 text-ink-muted tabular">{formatTimePadded(e.start)}</span>
            <span className={`inline-flex size-5 items-center justify-center rounded-full ${e.type === "MEETING" ? "bg-[#FCE7F3] text-[#DB2777]" : "bg-info-soft text-info-text"}`}>
              <Video className="size-3" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate text-ink">{e.title}</span>
            <CompanyBadge code={companyCode(e.companyId)} />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

const ACTIVITY_ICON: Record<string, { icon: typeof Bug; cls: string }> = {
  PAYMENT: { icon: ReceiptIndianRupee, cls: "bg-success-soft text-success-text" },
  LEAD: { icon: Users, cls: "bg-surface-muted text-ink-2" },
};

export async function ActivityCard({ ctx, compact }: { ctx: Ctx; compact?: boolean }) {
  const items = await M.recentActivity(ctx);
  const t = now();
  return (
    <SectionCard title="Recent Activity" icon={compact ? undefined : Activity} tone="purple" href="/activity">
      {items.map((a) => {
        const icon = !a.actor || a.entityType === "LEAD" ? ACTIVITY_ICON[a.entityType] : undefined;
        return (
          <ActivityRow
            key={a.id}
            person={icon ? undefined : (a.actor ?? undefined)}
            icon={icon?.icon ?? (a.actor ? undefined : Activity)}
            iconClass={icon?.cls}
            text={a.summary}
            time={formatRelative(a.createdAt, t)}
            right={<CompanyBadge code={companyCode(a.companyId)} />}
          />
        );
      })}
    </SectionCard>
  );
}

export async function CrossSellCard({ ctx }: { ctx: Ctx }) {
  const alerts = await M.crossSellAlerts(ctx);
  return (
    <SectionCard title="Cross-Sell Alerts" icon={Lightbulb} tone="amber" href="/clients">
      <div className="space-y-4">
        {alerts.length === 0 && <p className="py-4 text-center text-xs text-ink-muted">No cross-sell ideas right now.</p>}
        {alerts.map((a) => (
          <div key={a.id} className="flex items-center gap-3">
            <CompanyBadge code={a.fromCompany.code} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink">
                {a.client.name} ({a.fromCompany.code} Client)
              </p>
              <p className="text-2xs text-ink-muted">{a.reason}</p>
            </div>
            <CrossSellActions alertId={a.id} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Company layout (page 2) ────────────────────────────────────────────
export async function LeadsPipelineCard({ ctx }: { ctx: Ctx }) {
  const l = await M.leadSummary(ctx, { from: new Date(0), to: new Date(0), prevFrom: new Date(0), prevTo: new Date(0), preset: "month" });
  return (
    <SectionCard title={`Leads Pipeline${suffix(ctx)}`} href="/leads">
      <div className="flex items-stretch gap-3">
        <div className="grid flex-1 grid-cols-5 divide-x">
          {l.stages.map((s) => (
            <div key={s.stage} className="px-3 py-1">
              <p className="text-2xs text-ink-2">{STAGE_LABEL[s.stage]}</p>
              <p className="mt-2 text-lg font-bold text-ink tabular">{s.count}</p>
            </div>
          ))}
        </div>
        <Inset className="flex min-w-[130px] flex-col justify-center px-3 py-2">
          <span className="text-2xs text-ink-muted">Pipeline Value</span>
          <span className="text-lg font-bold text-ink tabular">{formatINR(l.pipeline)}</span>
        </Inset>
      </div>
    </SectionCard>
  );
}

export function donutData(p: Awaited<ReturnType<typeof M.projectSummary>>) {
  return [
    { label: "Not started", value: p.notStarted, color: PROJECT_STATUS_COLORS.notStarted },
    { label: "In progress", value: p.inProgress, color: PROJECT_STATUS_COLORS.inProgress },
    { label: "In review", value: p.inReview, color: PROJECT_STATUS_COLORS.inReview },
    { label: "On hold", value: p.onHold, color: PROJECT_STATUS_COLORS.onHold },
    { label: "Delivered", value: p.delivered, color: PROJECT_STATUS_COLORS.delivered },
  ];
}

export function taskDonutData(t: Awaited<ReturnType<typeof M.taskSummary>>) {
  return [
    { label: "Pending", value: t.pending, color: TASK_OVERVIEW_COLORS.pending },
    { label: "Due today", value: t.dueToday, color: TASK_OVERVIEW_COLORS.dueToday },
    { label: "Overdue", value: t.overdue, color: TASK_OVERVIEW_COLORS.overdue },
    { label: "Completed", value: t.completedWeek, color: TASK_OVERVIEW_COLORS.completed },
    { label: "Upcoming", value: t.upcoming, color: TASK_OVERVIEW_COLORS.upcoming },
  ];
}

export { DonutLegend, Card, IconTile };
export type { TileTone };
