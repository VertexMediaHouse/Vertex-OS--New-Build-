import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, AlertTriangle, BarChart3, Clock, FileText, FolderCheck, GraduationCap, LineChart, Rocket, Smile, Target, UserPlus, Users, Video, Workflow, MonitorPlay, MoreVertical, type LucideIcon } from "lucide-react";
import { getRequestContext } from "@/lib/auth/context";
import { can, isMemberOnly } from "@/lib/auth/permissions";
import { db, type Prisma } from "@/lib/db";
import { addMonthsIST, now, startOfMonthIST } from "@/lib/clock";
import { formatDate, formatINR, formatMonthYear, formatRelative, formatShortDate } from "@/lib/format";
import { dayKey, lastDay, parseDay, type Period } from "@/lib/period";
import { readParams, type SP } from "@/lib/search-params";
import { GOAL_STATUS } from "@/lib/status";
import { GOAL_CATEGORY_COLORS, GOAL_CATEGORY_LABELS, GOAL_LINE_COLORS, OTHER_GREY } from "@/lib/chart-colors";
import { goalProgress, goalStatus } from "@/lib/metrics/goals";
import { KpiCard, KpiTile } from "@/components/shared/kpi-card";
import { Card, ProgressBar, SectionCard, Avatar, AvatarStack, IconTile, type TileTone } from "@/components/shared/primitives";
import { CardSkeleton, EmptyState, KeyValue, PageHeader } from "@/components/shared/layout";
import { FilterTabs, SegmentedControl, UnderlineTabs } from "@/components/shared/nav";
import { DateRangePicker, FilterSelect, SearchInput } from "@/components/shared/filters";
import { DonutChart, DonutLegend, LinesChart, ChartLegend } from "@/components/shared/charts";
import { CompanyBadge, EnumPill, companyCode } from "@/components/shared/pills";
import { ActivityRow } from "@/components/shared/display";
import { AddMilestone, GoalDialog, MilestoneCheck, ProgressEditor } from "@/components/goals/goal-client";

export const metadata: Metadata = { title: "Goals" };
const ICONS: Record<string, [LucideIcon, TileTone]> = {
  target: [Target, "red"], users: [Users, "purple"], "folder-check": [FolderCheck, "purple"], rocket: [Rocket, "blue"], "user-plus": [UserPlus, "pink"], workflow: [Workflow, "red"],
  youtube: [MonitorPlay, "red"], smile: [Smile, "blue"], "graduation-cap": [GraduationCap, "blue"], "bar-chart": [BarChart3, "green"], "file-text": [FileText, "orange"], video: [Video, "purple"],
};

export default function GoalsPage({ searchParams }: PageProps<"/goals">) {
  return <Suspense fallback={<CardSkeleton className="h-96" />}><Goals searchParams={searchParams} /></Suspense>;
}

async function Goals({ searchParams }: { searchParams: Promise<SP> }) {
  const [ctx, sp] = await Promise.all([getRequestContext(), searchParams]);
  if (!can(ctx.user, "view", "goal")) return <p className="p-6 text-sm text-ink-2">You don&apos;t have access to goals.</p>;
  const p = readParams(sp);
  const t = now();
  // Default period: this quarter-ish window (this month + 2), like "Oct 2026 - Dec 2026".
  const from = parseDay(p.str("from")) ?? startOfMonthIST(t);
  const to = parseDay(p.str("to")) ? new Date(parseDay(p.str("to"))!.getTime() + 86_400_000) : addMonthsIST(startOfMonthIST(t), 3);
  const period: Period = { preset: "custom", from, to, prevFrom: from, prevTo: from };
  const simple = (p.str("view") ?? (isMemberOnly(ctx.user) ? "simple" : "detailed")) === "simple";
  const base: Prisma.GoalWhereInput = { OR: [{ companyId: { in: ctx.companyIds } }, { companyId: null }], startDate: { lt: to }, endDate: { gte: from } };
  const goals = await db.goal.findMany({ where: base, orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { owner: { select: { name: true, image: true } }, members: { include: { user: { select: { id: true, name: true, image: true } } } } } });
  const rows = goals.map((g) => ({ ...g, progress: goalProgress(g) }));
  const people = await db.user.findMany({ where: { kind: "STAFF", memberships: { some: { companyId: { in: ctx.companyIds } } } }, select: { id: true, name: true } });
  const companies = ctx.companyIds.filter((c): c is "vmh" | "vth" => c === "vmh" || c === "vth");
  const viewToggle = <SegmentedControl param="view" active={simple ? "simple" : "detailed"} options={[{ value: "detailed", label: "Detailed" }, { value: "simple", label: "Simple" }]} />;
  const range = { preset: "custom", from: dayKey(from), to: dayKey(lastDay(period)) };
  return simple ? <Simple ctx={ctx} rows={rows} sp={sp} range={range} people={people} companies={companies} toggle={viewToggle} /> : <Detailed ctx={ctx} rows={rows} sp={sp} range={range} people={people} companies={companies} toggle={viewToggle} t={t} />;
}

type Row = Awaited<ReturnType<typeof db.goal.findMany<{ include: { owner: { select: { name: true; image: true } }; members: { include: { user: { select: { id: true; name: true; image: true } } } } } }>>>[number] & { progress: number };
type Props = { ctx: Awaited<ReturnType<typeof getRequestContext>>; rows: Row[]; sp: SP; range: { preset: string; from: string; to: string }; people: { id: string; name: string }[]; companies: ("vmh" | "vth")[]; toggle: React.ReactNode };

const valueText = (g: Row, v: unknown) => (g.unit === "CURRENCY" ? formatINR(Number(v)) : g.unit === "PERCENT" ? `${Number(v)}%` : g.unit === "HOURS" ? `${Number(v)}h` : String(Number(v)));
const barTone = (g: Row) => (g.status === "COMPLETED" || g.progress >= 100 ? "success" : g.status === "OVERDUE" || g.status === "OFF_TRACK" ? "danger" : "primary") as "success";

function Detailed({ ctx, rows, sp, range, people, companies, toggle, t }: Props & { t: Date }) {
  const p = readParams(sp);
  const tab = p.str("tab") ?? "overview";
  const scopeTab = { company: "COMPANY", team: "TEAM", personal: "PERSONAL" }[tab];
  const co = p.str("co");
  const q = p.str("q")?.toLowerCase();
  const filtered = rows.filter((g) => (!scopeTab || g.scope === scopeTab) && (!co || g.companyId === co || g.companyId === null) && (!p.str("category") || g.category === p.str("category")) && (!p.str("status") || g.status === p.str("status")) && (!p.str("owner") || g.ownerId === p.str("owner")) && (!q || g.title.toLowerCase().includes(q)));
  const count = (st: string, c?: string) => rows.filter((g) => g.status === st && (!c || g.companyId === c)).length;
  const total = (c?: string) => rows.filter((g) => !c || g.companyId === c).length;
  const split = (f: (c: string) => number) => (ctx.scope === "ALL" ? [{ value: f("vmh"), label: "VMH" }, { value: f("vth"), label: "VTH" }] : undefined);
  const pct = (n: number) => (rows.length ? Math.round((n / rows.length) * 100) : 0);
  // Progress over the period: expected progress of each goal at each month end, averaged.
  const months = [0, 1, 2].map((i) => addMonthsIST(parseDay(range.from)!, i + 1));
  const avgAt = (date: Date, c?: string) => {
    const gs = rows.filter((g) => !c || g.companyId === c || g.companyId === null);
    if (!gs.length) return 0;
    const v = gs.map((g) => { const span = g.endDate.getTime() - g.startDate.getTime(); const el = Math.max(0, Math.min(1, (Math.min(date.getTime(), t.getTime()) - g.startDate.getTime()) / span)); const elNow = Math.max(0.01, Math.min(1, (t.getTime() - g.startDate.getTime()) / span)); return Math.min(100, (g.progress * el) / elNow); });
    return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
  };
  const line = months.map((m) => ({ m: formatMonthYear(addMonthsIST(m, -1)), ALL: avgAt(m), VMH: avgAt(m, "vmh"), VTH: avgAt(m, "vth") }));
  const cats = Object.keys(GOAL_CATEGORY_COLORS);
  const catData = [...cats.map((c) => ({ label: GOAL_CATEGORY_LABELS[c]!, value: rows.filter((g) => g.category === c).length, color: GOAL_CATEGORY_COLORS[c]!, href: `/goals?category=${c}` })), { label: "Other", value: rows.filter((g) => !cats.includes(g.category)).length, color: OTHER_GREY, href: "/goals" }].filter((c) => c.value);
  const selected = rows.find((g) => g.id === p.str("id")) ?? filtered[0];
  return (
    <div className="space-y-3.5">
      <PageHeader title="Goals" subtitle="Set, track, and achieve goals across Vertex Media House and Vertex Tech House." actions={<>{toggle}<DateRangePicker {...range} />{can(ctx.user, "create", "goal") && <GoalDialog label="Create Goal" companies={companies} people={people} />}</>} />
      <UnderlineTabs active={tab} tabs={[{ value: "overview", label: "Overview" }, { value: "company", label: "Company Goals" }, { value: "team", label: "Team Goals" }, { value: "personal", label: "Personal Goals" }]} />
      <div className="grid gap-3.5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-3.5">
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={Target} tone="green" label="Total Goals" value={rows.length} split={split((c) => total(c))} />
            <KpiCard icon={LineChart} tone="blue" label="On Track" value={count("ON_TRACK")} trend={pct(count("ON_TRACK"))} split={split((c) => count("ON_TRACK", c))} />
            <KpiCard icon={Clock} tone="orange" label="At Risk" value={count("AT_RISK")} trend={pct(count("AT_RISK"))} inverse split={split((c) => count("AT_RISK", c))} />
            <KpiCard icon={AlertCircle} tone="red" label="Off Track" value={count("OFF_TRACK") + count("OVERDUE")} trend={pct(count("OFF_TRACK") + count("OVERDUE"))} inverse split={split((c) => count("OFF_TRACK", c) + count("OVERDUE", c))} />
          </div>
          <div className="grid gap-3.5 xl:grid-cols-[1.7fr_1fr]">
            <SectionCard title="Goal Progress Overview">
              <ChartLegend className="mb-2 justify-center" items={[{ label: "All Goals", color: GOAL_LINE_COLORS.ALL, line: true, href: "/goals" }, { label: "VMH Goals", color: GOAL_LINE_COLORS.VMH, line: true, href: "/goals?co=vmh" }, { label: "VTH Goals", color: GOAL_LINE_COLORS.VTH, line: true, href: "/goals?co=vth" }]} />
              <LinesChart data={line} xKey="m" yFormat="percent" height={180} series={[{ key: "ALL", label: "All Goals", color: GOAL_LINE_COLORS.ALL, href: "/goals" }, { key: "VMH", label: "VMH Goals", color: GOAL_LINE_COLORS.VMH, href: "/goals?co=vmh" }, { key: "VTH", label: "VTH Goals", color: GOAL_LINE_COLORS.VTH, href: "/goals?co=vth" }]} />
            </SectionCard>
            <SectionCard title="Goals by Category">
              <div className="flex items-center gap-4"><DonutChart data={catData} center={rows.length} centerLabel="Goals" size={130} thickness={20} /><DonutLegend items={catData.map((c) => ({ ...c, value: `${pct(c.value)}%` }))} /></div>
            </SectionCard>
          </div>
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              {ctx.scope === "ALL" && <FilterTabs param="co" active={co ?? "all"} className="mr-auto" tabs={[{ value: "all", label: "All Goals", count: rows.length, tone: "blue" }, { value: "vmh", label: "VMH Goals", count: total("vmh"), tone: "vmh" }, { value: "vth", label: "VTH Goals", count: total("vth"), tone: "vth" }]} />}
              <FilterSelect param="category" placeholder="All Categories" options={Object.entries(GOAL_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} />
              <FilterSelect param="status" placeholder="All Status" options={Object.entries(GOAL_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
              <FilterSelect param="owner" placeholder="All Owners" options={people.map((x) => ({ value: x.id, label: x.name }))} />
              <SearchInput placeholder="Search goals..." className="w-48" />
            </div>
            <table className="w-full text-2xs">
              <thead><tr className="text-left text-ink-2">{["Goal Title", "Company", "Category", "Start Date", "End Date", "Progress", "Status", "Owner"].map((h) => <th key={h} className="bg-surface-muted px-2 py-2 font-medium first:rounded-l-md last:rounded-r-md">{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((g) => { const [Icon] = ICONS[g.icon ?? "target"] ?? [Target]; return (
                  <tr key={g.id} className={`border-b ${selected?.id === g.id ? "bg-brand-soft" : "hover:bg-accent"}`}>
                    <td className="px-2 py-2"><Link href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")), id: g.id })}`} scroll={false} className="flex items-center gap-2 font-semibold text-ink hover:underline"><Icon className="size-4 text-danger-text" />{g.title}</Link></td>
                    <td className="px-2 py-2"><CompanyBadge code={companyCode(g.companyId)} /></td>
                    <td className="px-2 py-2 text-ink-2">{GOAL_CATEGORY_LABELS[g.category]}</td>
                    <td className="px-2 py-2">{formatDate(g.startDate)}</td>
                    <td className="px-2 py-2">{formatDate(g.endDate)}</td>
                    <td className="px-2 py-2"><span className="flex items-center gap-2"><ProgressBar value={g.progress} tone={barTone(g)} className="w-20" />{Math.round(g.progress)}%</span></td>
                    <td className="px-2 py-2"><EnumPill map={GOAL_STATUS} value={g.status} size="xs" /></td>
                    <td className="px-2 py-2"><Avatar person={g.owner} size={24} /></td>
                  </tr>
                ); })}
              </tbody>
            </table>
            {filtered.length === 0 && <EmptyState title="No goals here yet" />}
          </Card>
        </div>
        {selected && <Suspense fallback={<CardSkeleton className="h-96" />}><GoalPanel goal={selected} t={t} canEdit={can(ctx.user, "update", "goal", selected.companyId ?? undefined) || selected.ownerId === ctx.user.id} /></Suspense>}
      </div>
    </div>
  );
}

async function GoalPanel({ goal, t, canEdit }: { goal: Row; t: Date; canEdit: boolean }) {
  const [milestones, activity] = await Promise.all([
    db.goalMilestone.findMany({ where: { goalId: goal.id }, orderBy: [{ order: "asc" }, { date: "asc" }] }),
    db.activity.findMany({ where: { entityType: "GOAL", entityId: goal.id }, orderBy: { createdAt: "desc" }, take: 6, include: { actor: { select: { name: true, image: true } } } }),
  ]);
  return (
    <div className="space-y-3.5">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-2"><h2 className="text-base font-bold text-ink">{goal.title}{goal.companyId && ` - ${companyCode(goal.companyId)}`}</h2><EnumPill map={GOAL_STATUS} value={goal.status} /></div>
        {goal.subtitle && <p className="mt-1 text-xs text-ink-muted">{goal.subtitle}</p>}
        <div className="mt-3 flex items-center gap-3"><ProgressBar value={goal.progress} tone={barTone(goal)} height={8} /><span className="text-sm font-semibold">{Math.round(goal.progress)}%</span></div>
        <div className="mt-3 grid grid-cols-2 text-xs"><div><p className="text-ink-muted">Current</p><p className="text-lg font-bold text-ink">{valueText(goal, goal.currentValue)}</p></div><div><p className="text-ink-muted">Target</p><p className="text-lg font-bold text-ink">{valueText(goal, goal.targetValue)}</p></div></div>
        {canEdit && goal.metricType === "MANUAL" && <div className="mt-3"><ProgressEditor goalId={goal.id} value={Number(goal.currentValue)} /></div>}
        {goal.metricType !== "MANUAL" && <p className="mt-2 text-2xs text-ink-muted">Tracked automatically from live data.</p>}
        <KeyValue className="mt-4" labelWidth={100} rows={[["Company", <span key="c" className="flex items-center gap-1.5"><CompanyBadge code={companyCode(goal.companyId)} />{goal.companyId === "vth" ? "Vertex Tech House" : goal.companyId === "vmh" ? "Vertex Media House" : "Both companies"}</span>], ["Category", GOAL_CATEGORY_LABELS[goal.category]], ["Start Date", formatDate(goal.startDate)], ["End Date", formatDate(goal.endDate)], ["Owner", <span key="o" className="flex items-center gap-2"><Avatar person={goal.owner} size={22} />{goal.owner.name}</span>], ["Team Members", <AvatarStack key="m" people={goal.members.map((m) => m.user)} />]]} />
        {goal.description && <><h3 className="mt-4 text-sm font-bold text-ink">Description</h3><p className="mt-1 text-xs leading-5 text-ink-2">{goal.description}</p></>}
      </Card>
      <SectionCard title={`Milestones (${milestones.filter((m) => m.done).length}/${milestones.length} completed)`} action={canEdit ? <AddMilestone goalId={goal.id} /> : undefined}>
        {milestones.map((m) => <label key={m.id} className="flex items-center gap-2.5 py-1.5 text-xs">{canEdit ? <MilestoneCheck id={m.id} done={m.done} label={m.title} /> : <input type="checkbox" checked={m.done} readOnly className="size-4" />}<span className="flex-1 text-ink">{m.title}</span><span className="text-ink-muted">{formatShortDate(m.date)}</span></label>)}
        {milestones.length === 0 && <EmptyState title="No milestones" className="py-4" />}
      </SectionCard>
      <SectionCard title="Recent Activity">
        {activity.map((a) => <ActivityRow key={a.id} person={a.actor ?? undefined} text={a.summary} time={formatRelative(a.createdAt, t)} />)}
        {activity.length === 0 && <EmptyState title="No activity yet" className="py-4" />}
      </SectionCard>
    </div>
  );
}

function Simple({ ctx, rows, sp, range, people, companies, toggle }: Props) {
  const p = readParams(sp);
  const tab = p.str("tab") ?? "my";
  const q = p.str("q")?.toLowerCase();
  const co = p.str("company");
  const mine = (g: Row) => g.ownerId === ctx.user.id || g.members.some((m) => m.userId === ctx.user.id);
  const filtered = rows.filter((g) => (tab === "my" ? mine(g) : tab === "team" ? g.scope === "TEAM" : g.scope === "COMPANY") && (!q || g.title.toLowerCase().includes(q)) && (!p.str("status") || g.status === p.str("status")) && (!co || g.companyId === co || g.companyId === null));
  const n = (s: string) => filtered.filter((g) => g.status === s).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Goals" subtitle="Set, track and achieve your important goals." actions={<>{toggle}<GoalDialog label="Add Goal" companies={companies} people={people} /></>} />
      <UnderlineTabs size="lg" active={tab} tabs={[{ value: "my", label: "My Goals" }, { value: "team", label: "Team Goals" }, { value: "company", label: "Company Goals" }]} />
      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile icon={Target} tone="green" value={filtered.length} label="Total Goals" />
        <KpiTile icon={LineChart} tone="blue" value={n("ON_TRACK") + n("COMPLETED")} label="On Track" />
        <KpiTile icon={Clock} tone="orange" value={n("AT_RISK") + n("OFF_TRACK")} label="At Risk" />
        <KpiTile icon={AlertTriangle} tone="red" value={n("OVERDUE")} label="Overdue" />
      </div>
      <Card className="flex flex-wrap gap-3 p-3">
        <SearchInput placeholder="Search goals..." className="min-w-64 flex-1" />
        <FilterSelect param="status" placeholder="All Status" options={Object.entries(GOAL_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
        {ctx.scope === "ALL" && <FilterSelect param="company" placeholder="All Companies" options={[{ value: "vmh", label: "Vertex Media House" }, { value: "vth", label: "Vertex Tech House" }]} />}
        <DateRangePicker {...range} />
      </Card>
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead><tr className="text-left text-md text-ink-2">{["Goal", "Owner", "Due Date", "Progress", "Status", ""].map((h) => <th key={h} className="bg-surface-muted px-4 py-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map((g) => { const [Icon, tone] = ICONS[g.icon ?? "target"] ?? [Target, "green"]; const st = goalStatus({ progress: g.progress, startDate: g.startDate, endDate: g.endDate, now: now() }); return (
              <tr key={g.id} className="border-b last:border-0">
                <td className="px-4 py-5"><span className="flex items-center gap-4"><IconTile icon={Icon} tone={tone} size="lg" /><span><span className="block text-base font-bold text-ink">{g.title}</span><span className="text-md text-ink-muted">{g.subtitle}</span></span></span></td>
                <td className="px-4 py-5 text-md">{g.members.length > 1 ? <AvatarStack people={g.members.map((m) => m.user)} size={30} /> : <span className="flex items-center gap-2"><Avatar person={g.owner} size={32} />{g.owner.name}</span>}</td>
                <td className="px-4 py-5 text-md">{formatDate(g.endDate)}</td>
                <td className="px-4 py-5"><span className="flex items-center gap-3"><ProgressBar value={g.progress} tone={barTone(g)} height={10} className="w-44" /><span className="text-base font-semibold">{Math.round(g.progress)}%</span></span></td>
                <td className="px-4 py-5"><EnumPill map={GOAL_STATUS} value={st} size="md" /></td>
                <td className="px-4 py-5"><Link href={`?view=detailed&id=${g.id}`} aria-label="Open goal" className="inline-flex size-9 items-center justify-center rounded-lg border"><MoreVertical className="size-4" /></Link></td>
              </tr>
            ); })}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState title="No goals yet" />}
      </Card>
    </div>
  );
}
