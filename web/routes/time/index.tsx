// Ported from app/(app)/time/page.tsx: the Prisma queries moved to the server route,
// the render is unchanged.
import { useQuery } from "@tanstack/react-query";
import { Clock, Download, Pause, PlayCircle, Users, Pencil, Square, StickyNote, Play } from "lucide-react";
import { useSearchParams } from "@/lib/nav";
import { now } from "@/lib/clock";
import { formatDate, formatDateTime, formatDuration, formatTime } from "@/lib/format";
import { pctChange, resolvePeriod, dayKey, lastDay } from "@/lib/period";
import { readParams } from "@/lib/search-params";
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
import { API_URL, api, query } from "@/web/api";
import { useTitle } from "@/web/title";

const logIcon: Record<string, [typeof Play, string]> = { timer_started: [Play, "bg-success text-white"], timer_stopped: [Square, "bg-danger text-white"], time_edited: [Pencil, "bg-brand-strong text-white"], time_note: [StickyNote, "bg-surface-muted text-ink-2"], time_added: [Pencil, "bg-brand-strong text-white"] };

export default function TimePage() {
  useTitle("Time Tracking");
  const [params] = useSearchParams();
  const sp = Object.fromEntries(params);
  const { data } = useQuery({ queryKey: ["time", params.toString()], queryFn: () => query(api.api.time.$get({ query: sp })) });

  if (!data) return <CardSkeleton className="h-96" />;
  if (!data.allowed) return <p className="p-6 text-sm text-ink-2">You don&apos;t have access to time tracking.</p>;

  // The same period the server resolved, from the same params.
  const p = readParams(sp);
  const unit = p.str("view") ?? "week";
  const period = p.str("range") || p.str("from") ? p.period : resolvePeriod({}, now(), "month");
  const { mine, sheet, chart, tickLines, cats, team, recent, logs, projects, people, canApprove, agg, prevAgg, scope, members } = data;

  const m = (f: (r: (typeof agg)[number]) => boolean) => agg.filter(f).reduce((a, r) => a + r.minutes, 0);
  const total = m(() => true), billable = m((r) => r.billable), nonBill = total - billable;
  const prevTotal = prevAgg.reduce((a, r) => a + r.minutes, 0);
  const prevBill = prevAgg.find((r) => r.billable)?.minutes ?? 0;
  const split = (f: (co: string) => string | number) => (scope === "ALL" ? [{ value: f("vmh"), label: "VMH" }, { value: f("vth"), label: "VTH" }] : undefined);
  const activeMembers = (co?: string) => new Set(members.filter((r) => !co || r.companyId === co).map((r) => r.userId)).size;

  const catTotal = Object.values(cats).reduce((a, b) => a + b, 0) || 1;
  const catData = ["VIDEO_EDITING", "WEBSITE_DEVELOPMENT", "CRM_ERP", "AUTOMATION", "DESIGN", "MEETINGS", "OTHER"].filter((c) => cats[c]).map((c) => ({ label: WORK_CATEGORY_LABELS[c]!, value: cats[c]!, color: WORK_CATEGORY_COLORS[c]!, href: `/time?cat=${c}` }));
  const exportHref = `${API_URL}/api/time/export?${new URLSearchParams(sp)}`;

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
            <SectionCard title="Hours Overview" action={<ChartLegend items={[{ label: `VMH (${formatDuration(data.chartByCompany.vmh)})`, color: COMPANY_COLORS.VMH, href: "/time?co=vmh" }, { label: `VTH (${formatDuration(data.chartByCompany.vth)})`, color: COMPANY_COLORS.VTH, href: "/time?co=vth" }]} />}>
              <BarsChart data={chart} xKey="day" series={[{ key: "VMH", label: "VMH", color: COMPANY_COLORS.VMH, href: "/time?co=vmh" }, { key: "VTH", label: "VTH", color: COMPANY_COLORS.VTH, href: "/time?co=vth" }]} yFormat="hours" xTickLines={tickLines} height={180} />
            </SectionCard>
            <SectionCard title="Hours by Project Type">
              <div className="flex items-center gap-4">
                <DonutChart data={catData} center={formatDuration(data.chartMins)} centerLabel="Total" size={140} thickness={18} />
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
              {data.scope === "ALL" && <FilterTabs param="co" active={p.str("co") ?? "all"} tabs={[{ value: "all", label: "All", tone: "blue" }, { value: "vmh", label: "VMH", tone: "vmh" }, { value: "vth", label: "VTH", tone: "vth" }]} className="mr-auto" />}
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
                      <td className="px-2 py-2">{formatDate(new Date(e.start))}</td>
                      <td className="px-2 py-2"><span className="flex items-center gap-2"><Avatar person={e.user} size={24} />{e.user?.name ?? "–"}</span></td>
                      <td className="px-2 py-2"><p className="font-semibold text-ink">{e.project?.client?.name ?? `${companyCode(e.companyId)} Internal`}</p><p className="text-ink-muted">{e.project?.name}</p></td>
                      <td className="px-2 py-2">{e.task?.title ?? e.note}</td>
                      <td className="px-2 py-2"><CompanyBadge code={companyCode(e.companyId)} /></td>
                      <td className="px-2 py-2">{formatTime(new Date(e.start))}</td>
                      <td className="px-2 py-2">{e.end && formatTime(new Date(e.end))}</td>
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
              {people.map((u) => { const mins = team.find((r) => r.userId === u.id)?.minutes ?? 0; const pct = (mins / (u.weeklyCapacityHours * 60)) * 100; return <li key={u.id} className="grid grid-cols-[minmax(0,1fr)_62px_80px_34px] items-center gap-2 text-xs"><span className="flex items-center gap-2"><Avatar person={u} size={22} />{u.name}</span><span className="tabular">{formatDuration(mins)}</span><ProgressBar value={pct} /><span className="text-right tabular">{Math.round(pct)}%</span></li>; })}
            </ul>
          </SectionCard>
          <SectionCard title="Recent Time Entries" href="/time">
            {recent.map((e) => <div key={e.id} className="flex items-start gap-2.5 py-1.5"><Avatar person={e.user} size={28} /><div className="min-w-0 flex-1 text-2xs"><p className="text-ink-muted">{e.user?.name ?? "–"}</p><p className="truncate text-xs font-semibold text-ink">{e.task?.title ?? e.note}</p><p className="text-ink-muted">{e.project?.client?.name ?? "Internal"}</p></div><div className="text-right text-2xs"><p className="text-sm font-bold text-ink">{formatDuration(e.durationMin ?? 0)}</p><p className="text-ink-muted">{formatDateTime(new Date(e.start))}</p></div></div>)}
          </SectionCard>
          <SectionCard title="Time Log Activity" href="/time">
            {logs.map((a) => { const [Icon, cls] = logIcon[a.verb] ?? [Clock, "bg-surface-muted text-ink-2"]; const detail = (a.meta as { detail?: string } | null)?.detail; return <div key={a.id} className="flex items-start gap-2.5 py-1.5 text-2xs"><span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full ${cls}`}><Icon className="size-3.5" /></span><div className="min-w-0 flex-1"><p className="text-xs text-ink">{a.summary}</p>{detail && <p className="text-ink-muted">{detail}</p>}</div><span className="text-ink-muted">{formatDateTime(new Date(a.createdAt))}</span></div>; })}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
