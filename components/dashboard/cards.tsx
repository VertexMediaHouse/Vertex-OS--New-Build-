// Dashboard cards shared by the owner (page 1) and company (page 2) layouts.
// These used to be async server components that each awaited one metric; the metrics
// now arrive together from GET /api/dashboard and come in as props.
import Link from "@/components/ui/link";
import { CalendarDays, CircleCheck, Folder, Lightbulb, ReceiptIndianRupee, Send, StickyNote, Target, Users, UsersRound, Video } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, IconTile, Inset, ProgressBar, SectionCard, SegmentedBar, ViewAll, type TileTone } from "@/components/shared/primitives";
import { Avatar } from "@/components/shared/primitives";
import { Chip, CompanyBadge, EnumPill, companyCode } from "@/components/shared/pills";
import { NewNoteButton, NoteBoard } from "./notes-client";
import { DonutLegend } from "@/components/shared/charts";
import { formatINR, formatShortDate, formatTimePadded } from "@/lib/format";
import { now, startOfDayIST } from "@/lib/clock";
import { workloadState } from "@/lib/metrics/workload";
import { PRIORITY } from "@/lib/status";
import type { ScopeFilter } from "@/lib/db/scope";
import * as M from "@/lib/metrics/dashboard";
import { LEAD_STAGE_COLORS, PROJECT_STATUS_COLORS, TASK_OVERVIEW_COLORS } from "@/lib/chart-colors";
import { CrossSellActions } from "./cross-sell-actions";

type Ctx = ScopeFilter & { scope: "ALL" | "VMH" | "VTH" };
const suffix = (s: Ctx) => (s.scope === "ALL" ? "" : ` (${s.scope})`);

// JSON serialisation turns Dates into ISO strings and Prisma Decimals into numeric
// strings (via their toJSON()). Catch both before the generic object branch.
type DecimalLike = { d: number[]; e: number; s: number };
type Json<T> = T extends Date ? string : T extends DecimalLike ? string : T extends (infer U)[] ? Json<U>[] : T extends object ? { [K in keyof T]: Json<T[K]> } : T;
export type Revenue = Json<Awaited<ReturnType<typeof M.revenueSummary>>>;
export type Projects = Json<Awaited<ReturnType<typeof M.projectSummary>>>;
export type Tasks = Json<Awaited<ReturnType<typeof M.taskSummary>>>;
export type Leads = Json<Awaited<ReturnType<typeof M.leadSummary>>>;

// ── KPI row ─────────────────────────────────────────────────────────────
export function RevenueKpi({ ctx, r, owner }: { ctx: Ctx; r: Revenue; owner?: boolean }) {
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

export function ProjectsKpi({ ctx, p, owner }: { ctx: Ctx; p: Projects; owner?: boolean }) {
  const legend = donutData(p);
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

export function TasksKpi({ ctx, t, owner }: { ctx: Ctx; t: Tasks; owner?: boolean }) {
  const rows = [
    { label: "Pending", value: t.pending, color: TASK_OVERVIEW_COLORS.pending },
    { label: "Due today", value: t.dueToday, color: TASK_OVERVIEW_COLORS.dueToday },
    { label: "Overdue", value: t.overdue, color: TASK_OVERVIEW_COLORS.overdue },
    { label: "Completed this week", value: t.completedWeek, color: TASK_OVERVIEW_COLORS.completed },
    { label: "Upcoming", value: t.upcoming, color: TASK_OVERVIEW_COLORS.upcoming },
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

const STAGE_LABEL: Record<string, string> = { NEW: "New", CONTACTED: "Contacted", PROPOSAL: "Proposal", NEGOTIATION: "Negotiation", WON: "Won" };

export function LeadsKpi({ ctx, l, owner }: { ctx: Ctx; l: Leads; owner?: boolean }) {
  return (
    <KpiCard href="/leads" icon={Users} tone="pink" label="Ongoing Leads" value={l.total} trend={l.delta} trendUnit="" split={owner || ctx.scope !== "ALL" ? undefined : [{ value: l.vmh, label: "VMH" }, { value: l.vth, label: "VTH" }]}>
      {owner && (
        <div className="mt-3 flex gap-4">
          <ul className="flex-1 space-y-1 text-xs text-ink-2">
            {l.stages.map((s) => (
              <li key={s.stage} className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: LEAD_STAGE_COLORS[s.stage] }} aria-hidden />
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

// ── Open tasks, by date and by person ───────────────────────────────────
const TASK_FILTERS: [M.TaskFilter, string, string][] = [
  ["today", "Today", "/tasks?due=today"],
  ["overdue", "Overdue", "/tasks?due=overdue"],
  ["week", "Next 7 days", "/tasks?due=week"],
  ["all", "All open", "/tasks"],
];

type OpenTask = Json<Awaited<ReturnType<typeof M.openTasks>>>[number];

export function OpenTasksCard({ tasks, filter, sp }: { tasks: OpenTask[]; filter: M.TaskFilter; sp: Record<string, string> }) {
  const t = now();
  const today = startOfDayIST(t);
  // Keep the rest of the query string (date range, company) when switching filter.
  const keep = Object.entries(sp).filter(([k]) => k !== "tasks");
  const tabHref = (f: M.TaskFilter) => `/dashboard?${new URLSearchParams([...keep, ["tasks", f]])}`;
  const current = TASK_FILTERS.find(([f]) => f === filter)!;
  return (
    <SectionCard
      title="Open Tasks"
      icon={CircleCheck}
      tone="blue"
      subtitle={`${tasks.length === 8 ? "First 8" : tasks.length} ${current[1].toLowerCase()}`}
      action={<ViewAll href={current[2]} />}
    >
      <div className="-mt-1 mb-2 flex flex-wrap gap-1">
        {TASK_FILTERS.map(([f, label]) => (
          <Link
            key={f}
            href={tabHref(f)}
            scroll={false}
            aria-current={f === filter ? "page" : undefined}
            className={`rounded-lg px-2.5 py-1 text-2xs font-medium ${f === filter ? "bg-brand-strong text-white" : "bg-surface-muted text-ink-2 hover:bg-accent"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <ul className="divide-y">
        {tasks.length === 0 && <li className="py-6 text-center text-xs text-ink-muted">Nothing {current[1].toLowerCase()}.</li>}
        {tasks.map((tk) => {
          const due = tk.dueDate ? new Date(tk.dueDate) : null;
          const overdue = due !== null && due < today && tk.status !== "COMPLETED";
          return (
            <li key={tk.id} className="py-1.5">
              <Link href={`/tasks?id=${tk.id}`} className="flex items-center gap-2.5 rounded-md text-xs hover:bg-accent">
                <EnumPill map={PRIORITY} value={tk.priority} size="xs" />
                <span className="min-w-0 flex-1 truncate text-ink">
                  {tk.title}
                  {tk.project && <span className="text-ink-muted"> · {tk.project.client?.name ?? tk.project.name}</span>}
                </span>
                {tk.assignee && <Avatar person={tk.assignee} size={20} />}
                <span className={`w-16 text-right ${overdue ? "font-semibold text-danger-text" : "text-ink-muted"}`}>
                  {due ? formatShortDate(due) : "—"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

export function TeamTasksCard({ ctx, people }: { ctx: Ctx; people: Json<Awaited<ReturnType<typeof M.tasksByPerson>>> }) {
  return (
    <SectionCard title={`Tasks by Person${suffix(ctx)}`} icon={UsersRound} tone="purple" href="/tasks">
      <table className="w-full text-2xs">
        <thead>
          <tr className="text-left text-ink-2">
            {["Person", "Open", "Today", "Overdue", "In review", "Done this week"].map((h, i) => (
              <th key={h} className={`bg-surface-muted px-2 py-1.5 font-medium ${i === 0 ? "rounded-l-md" : ""} ${i === 5 ? "rounded-r-md text-right" : ""} ${i > 0 && i < 5 ? "text-center" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-ink-muted">No one on the team yet.</td></tr>}
          {people.map((p) => (
            <tr key={p.id} className="border-b last:border-0">
              <td className="px-2 py-1.5">
                <Link href={`/tasks?assignee=${p.id}`} className="flex items-center gap-2 font-medium text-ink hover:underline">
                  <Avatar person={p} size={22} />
                  {p.name}
                </Link>
              </td>
              <td className="px-2 text-center font-semibold text-ink tabular">{p.open}</td>
              <td className="px-2 text-center tabular">
                {p.today > 0 ? <Link href={`/tasks?assignee=${p.id}&due=today`} className="font-semibold text-warning-text hover:underline">{p.today}</Link> : <span className="text-ink-muted">–</span>}
              </td>
              <td className="px-2 text-center tabular">
                {p.overdue > 0 ? <Link href={`/tasks?assignee=${p.id}&due=overdue`} className="font-semibold text-danger-text hover:underline">{p.overdue}</Link> : <span className="text-ink-muted">–</span>}
              </td>
              <td className="px-2 text-center tabular">
                {p.inReview > 0 ? <Link href={`/tasks?assignee=${p.id}&status=IN_REVIEW`} className="font-semibold text-review-text hover:underline">{p.inReview}</Link> : <span className="text-ink-muted">–</span>}
              </td>
              <td className="px-2 text-right font-semibold text-success-text tabular">{p.doneWeek}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}

export function NotesCard({ ctx, rows }: { ctx: Ctx; rows: { id: string; title: string | null; body: string; pinned: boolean; companyId: string | null }[] }) {
  const companies = ctx.companyIds.filter((c): c is "vmh" | "vth" => c === "vmh" || c === "vth");
  return (
    <SectionCard title="Notebook" icon={StickyNote} tone="amber" action={<NewNoteButton companies={companies} />}>
      <NoteBoard notes={rows.map(({ id, title, body, pinned, companyId }) => ({ id, title, body, pinned, companyId }))} companies={companies} />
    </SectionCard>
  );
}

// ── Owner rows ──────────────────────────────────────────────────────────
export function CampaignsCard({ list }: { list: Json<Awaited<ReturnType<typeof M.activeCampaigns>>> }) {
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  return (
    <SectionCard title="Email Campaigns" icon={Send} tone="blue" subtitle={`${list.length} Active Campaigns`} href="/campaigns">
      <div className="space-y-1.5">
        {list.map((c) => (
          <Link key={c.id} href={`/campaigns?id=${c.id}`} className="grid grid-cols-[minmax(0,1fr)_48px_48px_60px_auto] items-center gap-2 rounded-lg border px-3 py-1.5 hover:bg-accent">
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

export function GoalsCard({ goals }: { goals: Json<Awaited<ReturnType<typeof M.goalsProgress>>> }) {
  const fmt = (g: (typeof goals)[number], v: unknown) => (g.unit === "CURRENCY" ? formatINR(Number(v)) : String(Number(v)));
  return (
    <SectionCard title="Goals Progress" icon={Target} tone="green" href="/goals">
      <div className="space-y-2">
        {goals.map((g) => (
          <Link key={g.id} href={`/goals?view=detailed&id=${g.id}`} className="grid grid-cols-[minmax(0,1fr)_110px_36px_auto] items-center gap-3 rounded-lg hover:bg-accent">
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

export function WorkloadCard({ ctx, team, compact }: { ctx: Ctx; team: Json<Awaited<ReturnType<typeof M.teamWorkload>>>; compact?: boolean }) {
  const tone = { over: "danger", idle: "warning", ok: "success" } as const;
  return (
    <SectionCard title={`Team Workload${suffix(ctx)}`} icon={compact ? undefined : UsersRound} tone="orange" href="/team">
      <div className="space-y-2.5">
        {team.slice(0, 4).map((u) => {
          const st = workloadState(u.pct);
          return (
            <Link key={u.id} href={`/team/${u.id}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_40px_36px] items-center gap-3 rounded-lg hover:bg-accent">
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

export function AgendaCard({ ctx, events, compact }: { ctx: Ctx; events: Json<Awaited<ReturnType<typeof M.todaysAgenda>>>; compact?: boolean }) {
  return (
    <SectionCard title={`Today's Agenda${suffix(ctx)}`} icon={compact ? undefined : CalendarDays} tone="blue" href="/calendar">
      <ul className="space-y-1">
        {events.length === 0 && <li className="py-4 text-center text-xs text-ink-muted">Nothing scheduled today.</li>}
        {events.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-1 text-xs">
            <span className="w-16 text-ink-muted tabular">{formatTimePadded(new Date(e.start))}</span>
            <span className={`inline-flex size-5 items-center justify-center rounded-full ${e.type === "MEETING" ? "bg-review-soft text-review-text" : "bg-info-soft text-info-text"}`}>
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

export function CrossSellCard({ alerts }: { alerts: Json<Awaited<ReturnType<typeof M.crossSellAlerts>>> }) {
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
export function LeadsPipelineCard({ ctx, l }: { ctx: Ctx; l: Leads }) {
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

// Each slice links to the same statuses it counted (lib/projects/templates.ts LIST_TABS).
export function donutData(p: Projects) {
  return [
    { label: "Not started", value: p.notStarted, color: PROJECT_STATUS_COLORS.notStarted, href: "/projects?list=notStarted" },
    { label: "In progress", value: p.inProgress, color: PROJECT_STATUS_COLORS.inProgress, href: "/projects?list=inProgress" },
    { label: "In review", value: p.inReview, color: PROJECT_STATUS_COLORS.inReview, href: "/projects?list=review" },
    { label: "On hold", value: p.onHold, color: PROJECT_STATUS_COLORS.onHold, href: "/projects?list=onHold" },
    { label: "Delivered", value: p.delivered, color: PROJECT_STATUS_COLORS.delivered, href: "/projects?list=completed" },
  ];
}

export function taskDonutData(t: Tasks) {
  return [
    { label: "Pending", value: t.pending, color: TASK_OVERVIEW_COLORS.pending, href: "/tasks?status=TODO" },
    { label: "Due today", value: t.dueToday, color: TASK_OVERVIEW_COLORS.dueToday, href: "/tasks?due=today" },
    { label: "Overdue", value: t.overdue, color: TASK_OVERVIEW_COLORS.overdue, href: "/tasks?due=overdue" },
    { label: "Completed", value: t.completedWeek, color: TASK_OVERVIEW_COLORS.completed, href: "/tasks?status=COMPLETED" },
    { label: "Upcoming", value: t.upcoming, color: TASK_OVERVIEW_COLORS.upcoming, href: "/tasks?due=week" },
  ];
}

export { DonutLegend, Card, IconTile };
export type { TileTone };
