import { Suspense } from "react";
import type { Metadata } from "next";
import { Clock, Download, Pause, PlayCircle, Users, Pencil, Square, StickyNote, Play } from "lucide-react";
import { getRequestContext } from "@/lib/auth/context";
import { can, isMemberOnly } from "@/lib/auth/permissions";
import { db, type Prisma } from "@/lib/db";
import { addDays, now, startOfDayIST, startOfWeekIST } from "@/lib/clock";
import { formatDate, formatDateTime, formatDuration, formatShortDate, formatTime } from "@/lib/format";
import { pctChange, resolvePeriod, dayKey, lastDay } from "@/lib/period";
import { readParams, subScope, type SP } from "@/lib/search-params";
import { COMPANY_COLORS, WORK_CATEGORY_COLORS, WORK_CATEGORY_LABELS } from "@/lib/chart-colors";
import { TIME_STATUS } from "@/lib/status";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, SectionCard, Avatar, ProgressBar } from "@/components/shared/primitives";
import { CardSkeleton, EmptyState, PageHeader } from "@/components/shared/layout";
import { FilterTabs, SegmentedControl } from "@/components/shared/nav";
import { DateRangePicker, FilterSelect, SearchInput } from "@/components/shared/filters";
import { BarsChart, ChartLegend, DonutChart, DonutLegend } from "@/components/shared/charts";
import { CompanyBadge, EnumPill, companyCode } from "@/components/shared/pills";
import { BillableToggle, EntryActions, StartTimerPanel } from "@/components/time/time-client";

export const metadata: Metadata = { title: "Time Tracking" };

export default function TimePage({ searchParams }: PageProps<"/time">) {
  return <Suspense fallback={<CardSkeleton className="h-96" />}><Time searchParams={searchParams} /></Suspense>;
}

async function Time({ searchParams }: { searchParams: Promise<SP> }) {
  const [ctx, sp] = await Promise.all([getRequestContext(), searchParams]);
  const p = readParams(sp);
  const t = now();
  const unit = p.str("view") ?? "week";
  const period = p.str("range") || p.str("from") ? p.period : resolvePeriod({}, t, "month");
  const mine = isMemberOnly(ctx.user);
  const base: Prisma.TimeEntryWhereInput = { companyId: { in: ctx.companyIds }, ...(mine && { userId: ctx.user.id }), status: { not: "RUNNING" } };
  const inP = { ...base, start: { gte: period.from, lt: period.to } };
  const prevP = { ...base, start: { gte: period.prevFrom, lt: period.prevTo } };
  const q = p.str("q");
  const sheetWhere: Prisma.TimeEntryWhereInput = {
    ...inP,
    companyId: { in: subScope(ctx.companyIds, p.str("co")) },
    ...(p.str("member") && { userId: p.str("member")! }),
    ...(p.str("project") && { projectId: p.str("project")! }),
    ...(p.str("status") === "NON_BILLABLE" ? { billable: false } : p.str("status") ? { status: p.str("status") as "APPROVED" } : {}),
    // ?cat= is what the "Hours by Project Type" donut links to; MEETINGS lives on the entry.
    ...(p.str("cat") === "MEETINGS" ? { category: "MEETINGS" as const } : p.str("cat") ? { project: { category: p.str("cat") as "DESIGN" } } : {}),
    ...(q && { OR: [{ note: { contains: q, mode: "insensitive" } }, { task: { title: { contains: q, mode: "insensitive" } } }, { project: { name: { contains: q, mode: "insensitive" } } }, { user: { name: { contains: q, mode: "insensitive" } } }] }),
  };
  const weekStart = startOfWeekIST(t);
  const chartFrom = unit === "day" ? startOfDayIST(t) : unit === "month" ? period.from : weekStart;
  const chartTo = unit === "day" ? addDays(chartFrom, 1) : unit === "month" ? period.to : addDays(weekStart, 7);
  const [agg, prevAgg, members, sheet, chartRows, team, recent, logs, projects, people] = await Promise.all([
    db.timeEntry.groupBy({ by: ["companyId", "billable"], _sum: { durationMin: true }, where: inP }),
    db.timeEntry.groupBy({ by: ["billable"], _sum: { durationMin: true }, where: prevP }),
    db.timeEntry.groupBy({ by: ["companyId", "userId"], where: { ...inP, user: { isOwner: false } } }),
    db.timeEntry.findMany({ where: sheetWhere, orderBy: { start: "desc" }, take: 50, include: { user: { select: { name: true } }, project: { select: { name: true, client: { select: { name: true } } } }, task: { select: { title: true } } } }),
    db.timeEntry.findMany({ where: { ...base, start: { gte: chartFrom, lt: chartTo } }, select: { start: true, durationMin: true, companyId: true, category: true, project: { select: { category: true } } } }),
    db.timeEntry.groupBy({ by: ["userId"], _sum: { durationMin: true }, where: { ...base, start: { gte: weekStart, lt: addDays(weekStart, 7) }, user: { isOwner: false } } }),
    db.timeEntry.findMany({ where: base, orderBy: { start: "desc" }, take: 4, include: { user: { select: { name: true } }, task: { select: { title: true } }, project: { select: { name: true, client: { select: { name: true } } } } } }),
    db.activity.findMany({ where: { entityType: "TIME_ENTRY", OR: [{ companyId: { in: ctx.companyIds } }, { companyId: null }] }, orderBy: { createdAt: "desc" }, take: 4, include: { actor: { select: { name: true } } } }),
    db.project.findMany({ where: { companyId: { in: ctx.companyIds }, status: { not: "COMPLETED" }, ...(mine && { members: { some: { userId: ctx.user.id } } }) }, select: { id: true, name: true, client: { select: { name: true } }, tasks: { where: { status: { not: "COMPLETED" } }, select: { id: true, title: true } } }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { kind: "STAFF", isOwner: false, memberships: { some: { companyId: { in: ctx.companyIds } } } }, select: { id: true, name: true, weeklyCapacityHours: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const m = (f: (r: (typeof agg)[number]) => boolean) => agg.filter(f).reduce((a, r) => a + Number(r._sum.durationMin ?? 0), 0);
  const total = m(() => true), billable = m((r) => r.billable), nonBill = total - billable;
  const prevTotal = prevAgg.reduce((a, r) => a + Number(r._sum.durationMin ?? 0), 0);
  const prevBill = Number(prevAgg.find((r) => r.billable)?._sum.durationMin ?? 0);
  const split = (f: (co: string) => string | number) => (ctx.scope === "ALL" ? [{ value: f("vmh"), label: "VMH" }, { value: f("vth"), label: "VTH" }] : undefined);
  const activeMembers = (co?: string) => new Set(members.filter((r) => !co || r.companyId === co).map((r) => r.userId)).size;

  const buckets = unit === "month"
    ? Array.from({ length: Math.ceil((chartTo.getTime() - chartFrom.getTime()) / (7 * 86_400_000)) }, (_, i) => ({ from: addDays(chartFrom, i * 7), to: addDays(chartFrom, Math.min((i + 1) * 7, (chartTo.getTime() - chartFrom.getTime()) / 86_400_000)), label: `Week ${i + 1}` }))
    : unit === "day" ? [{ from: chartFrom, to: chartTo, label: "Today" }]
    : Array.from({ length: 7 }, (_, i) => ({ from: addDays(chartFrom, i), to: addDays(chartFrom, i + 1), label: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Asia/Kolkata" }).format(addDays(chartFrom, i)) }));
  const chart = buckets.map((b) => {
    const rows = chartRows.filter((r) => r.start >= b.from && r.start < b.to);
    const h = (co: string) => Math.round((rows.filter((r) => r.companyId === co).reduce((a, r) => a + (r.durationMin ?? 0), 0) / 60) * 10) / 10;
    return { day: b.label, VMH: h("vmh"), VTH: h("vth") };
  });
  const tickLines = Object.fromEntries(buckets.map((b) => [b.label, unit === "month" ? `${formatShortDate(b.from)} - ${formatShortDate(addDays(b.to, -1))}` : formatShortDate(b.from)]));
  const cats: Record<string, number> = {};
  for (const r of chartRows) { const c = r.category ?? r.project?.category ?? "OTHER"; cats[c] = (cats[c] ?? 0) + (r.durationMin ?? 0); }
  const catTotal = Object.values(cats).reduce((a, b) => a + b, 0) || 1;
  const catData = ["VIDEO_EDITING", "WEBSITE_DEVELOPMENT", "CRM_ERP", "AUTOMATION", "DESIGN", "MEETINGS", "OTHER"].filter((c) => cats[c]).map((c) => ({ label: WORK_CATEGORY_LABELS[c]!, value: cats[c]!, color: WORK_CATEGORY_COLORS[c]!, href: `/time?cat=${c}` }));
  const chartMins = chartRows.reduce((a, r) => a + (r.durationMin ?? 0), 0);
  const canApprove = ctx.companyIds.some((c) => can(ctx.user, "approve", "time", c));
  const exportHref = `/time/export?${new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"))}`;
  const logIcon: Record<string, [typeof Play, string]> = { timer_started: [Play, "bg-success text-white"], timer_stopped: [Square, "bg-danger text-white"], time_edited: [Pencil, "bg-brand-strong text-white"], time_note: [StickyNote, "bg-surface-muted text-ink-2"], time_added: [Pencil, "bg-brand-strong text-white"] };

  return (
    <div className="space-y-3.5">
      <PageHeader title="Time Tracking" subtitle="Track team hours across all projects and clients for Vertex Media House and Vertex Tech House." actions={<><DateRangePicker preset={period.preset} from={dayKey(period.from)} to={dayKey(lastDay(period))} /><SegmentedControl param="view" active={unit} options={[{ value: "week", label: "Week" }, { value: "day", label: "Day" }, { value: "month", label: "Month" }]} /></>} />
      <div className="grid gap-3.5 xl:grid-cols-[1fr_327px]">
        <div className="space-y-3.5">
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={Clock} tone="purple" label="Total Hours" value={formatDuration(total)} trend={pctChange(total, prevTotal)} split={split((co) => formatDuration(m((r) => r.companyId === co)))} />
            <KpiCard icon={PlayCircle} tone="blue" label="Billable Hours" value={formatDuration(billable)} trend={pctChange(billable, prevBill)} split={split((co) => formatDuration(m((r) => r.companyId === co && r.billable)))} />
            <KpiCard icon={Pause} tone="orange" label="Non-Billable Hours" value={formatDuration(nonBill)} trend={pctChange(nonBill, prevTotal - prevBill)} inverse split={split((co) => formatDuration(m((r) => r.companyId === co && !r.billable)))} />
            <KpiCard icon={Users} tone="blue" label="Active Team Members" value={activeMembers()} split={split((co) => activeMembers(co))} />
          </div>
          <div className="grid gap-3.5 xl:grid-cols-[1.35fr_1fr]">
            <SectionCard title="Hours Overview" action={<ChartLegend items={[{ label: `VMH (${formatDuration(chartRows.filter((r) => r.companyId === "vmh").reduce((a, r) => a + (r.durationMin ?? 0), 0))})`, color: COMPANY_COLORS.VMH, href: "/time?co=vmh" }, { label: `VTH (${formatDuration(chartRows.filter((r) => r.companyId === "vth").reduce((a, r) => a + (r.durationMin ?? 0), 0))})`, color: COMPANY_COLORS.VTH, href: "/time?co=vth" }]} />}>
              <BarsChart data={chart} xKey="day" series={[{ key: "VMH", label: "VMH", color: COMPANY_COLORS.VMH, href: "/time?co=vmh" }, { key: "VTH", label: "VTH", color: COMPANY_COLORS.VTH, href: "/time?co=vth" }]} yFormat="hours" xTickLines={tickLines} height={180} />
            </SectionCard>
            <SectionCard title="Hours by Project Type">
              <div className="flex items-center gap-4">
                <DonutChart data={catData} center={formatDuration(chartMins)} centerLabel="Total" size={140} thickness={18} />
                <DonutLegend items={catData.map((c) => ({ ...c, value: `${Math.round((c.value / catTotal) * 100)}%` }))} />
              </div>
            </SectionCard>
          </div>
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="mr-auto text-xl font-bold text-ink">Timesheet</h2>
              <a href={exportHref} className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-xs font-medium"><Download className="size-4" />Export</a>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              {ctx.scope === "ALL" && <FilterTabs param="co" active={p.str("co") ?? "all"} tabs={[{ value: "all", label: "All", tone: "blue" }, { value: "vmh", label: "VMH", tone: "vmh" }, { value: "vth", label: "VTH", tone: "vth" }]} className="mr-auto" />}
              <SearchInput placeholder="Search team members, projects, tasks..." className="w-64" />
              {!mine && <FilterSelect param="member" placeholder="All Team Members" options={people.map((u) => ({ value: u.id, label: u.name }))} />}
              <FilterSelect param="project" placeholder="All Projects" options={projects.map((x) => ({ value: x.id, label: `${x.client?.name ?? "Internal"} · ${x.name}` }))} />
              <FilterSelect param="status" placeholder="All Status" options={Object.entries(TIME_STATUS).filter(([k]) => k !== "RUNNING").map(([value, s]) => ({ value, label: s.label }))} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-2xs">
                <thead><tr className="text-left text-ink-2">{["Date", "Team Member", "Project", "Task", "Company", "Start Time", "End Time", "Duration", "Billable", "Status", ""].map((h) => <th key={h} className="bg-surface-muted px-2 py-2 font-medium first:rounded-l-md last:rounded-r-md">{h}</th>)}</tr></thead>
                <tbody>
                  {sheet.map((e) => (
                    <tr key={e.id} className="border-b">
                      <td className="px-2 py-2">{formatDate(e.start)}</td>
                      <td className="px-2 py-2"><span className="flex items-center gap-2"><Avatar person={e.user} size={24} />{e.user.name}</span></td>
                      <td className="px-2 py-2"><p className="font-semibold text-ink">{e.project?.client?.name ?? `${companyCode(e.companyId)} Internal`}</p><p className="text-ink-muted">{e.project?.name}</p></td>
                      <td className="px-2 py-2">{e.task?.title ?? e.note}</td>
                      <td className="px-2 py-2"><CompanyBadge code={companyCode(e.companyId)} /></td>
                      <td className="px-2 py-2">{formatTime(e.start)}</td>
                      <td className="px-2 py-2">{e.end && formatTime(e.end)}</td>
                      <td className="px-2 py-2 tabular">{formatDuration(e.durationMin ?? 0)}</td>
                      <td className="px-2 py-2"><BillableToggle id={e.id} billable={e.billable} disabled={Boolean(e.invoiceId)} /></td>
                      <td className="px-2 py-2"><EnumPill map={TIME_STATUS} value={e.billable ? e.status : "NON_BILLABLE"} dot={false} size="xs" /></td>
                      <td className="px-2 py-2"><EntryActions id={e.id} canApprove={canApprove} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sheet.length === 0 && <EmptyState title="No time logged in this period" />}
            </div>
          </Card>
        </div>
        <div className="space-y-3.5">
          <StartTimerPanel projects={projects.map((x) => ({ id: x.id, label: `${x.client?.name ?? "Internal"} · ${x.name}`, tasks: x.tasks }))} />
          <SectionCard title={<>Team Hours <span className="font-normal text-ink-muted">(This Week)</span></>} href="/team">
            <ul className="space-y-2.5">
              {people.map((u) => { const mins = Number(team.find((r) => r.userId === u.id)?._sum.durationMin ?? 0); const pct = (mins / (u.weeklyCapacityHours * 60)) * 100; return <li key={u.id} className="grid grid-cols-[minmax(0,1fr)_62px_80px_34px] items-center gap-2 text-xs"><span className="flex items-center gap-2"><Avatar person={u} size={22} />{u.name}</span><span className="tabular">{formatDuration(mins)}</span><ProgressBar value={pct} /><span className="text-right tabular">{Math.round(pct)}%</span></li>; })}
            </ul>
          </SectionCard>
          <SectionCard title="Recent Time Entries" href="/time">
            {recent.map((e) => <div key={e.id} className="flex items-start gap-2.5 py-1.5"><Avatar person={e.user} size={28} /><div className="min-w-0 flex-1 text-2xs"><p className="text-ink-muted">{e.user.name}</p><p className="truncate text-xs font-semibold text-ink">{e.task?.title ?? e.note}</p><p className="text-ink-muted">{e.project?.client?.name ?? "Internal"}</p></div><div className="text-right text-2xs"><p className="text-sm font-bold text-ink">{formatDuration(e.durationMin ?? 0)}</p><p className="text-ink-muted">{formatDateTime(e.start)}</p></div></div>)}
          </SectionCard>
          <SectionCard title="Time Log Activity" href="/time">
            {logs.map((a) => { const [Icon, cls] = logIcon[a.verb] ?? [Clock, "bg-surface-muted text-ink-2"]; const detail = (a.meta as { detail?: string } | null)?.detail; return <div key={a.id} className="flex items-start gap-2.5 py-1.5 text-2xs"><span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full ${cls}`}><Icon className="size-3.5" /></span><div className="min-w-0 flex-1"><p className="text-xs text-ink">{a.summary}</p>{detail && <p className="text-ink-muted">{detail}</p>}</div><span className="text-ink-muted">{formatDateTime(a.createdAt)}</span></div>; })}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

