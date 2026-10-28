// Ported from app/(app)/goals/page.tsx: Prisma reads moved to server/routes/goals.ts,
// the filtering and chart maths stay here unchanged.
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, BarChart3, Clock, FileText, FolderCheck, GraduationCap, LineChart, MonitorPlay, MoreVertical, Rocket, Smile, Target, UserPlus, Users, Video, Workflow, type LucideIcon } from "lucide-react";
import { ChartLegend, DonutChart, DonutLegend, LinesChart } from "@/components/shared/charts";
import { ActivityRow } from "@/components/shared/display";
import { DateRangePicker, FilterSelect, SearchInput } from "@/components/shared/filters";
import { KpiCard, KpiTile } from "@/components/shared/kpi-card";
import { CardSkeleton, EmptyState, KeyValue, PageHeader } from "@/components/shared/layout";
import { FilterTabs, SegmentedControl, UnderlineTabs } from "@/components/shared/nav";
import { CompanyBadge, EnumPill, companyCode } from "@/components/shared/pills";
import { Avatar, AvatarStack, Card, IconTile, ProgressBar, SectionCard, type TileTone } from "@/components/shared/primitives";
import { AddMilestone, GoalDialog, MilestoneCheck, ProgressEditor } from "@/components/goals/goal-client";
import Link from "@/components/ui/link";
import { addMonthsIST, now } from "@/lib/clock";
import { GOAL_CATEGORY_COLORS, GOAL_CATEGORY_LABELS, GOAL_LINE_COLORS, OTHER_GREY } from "@/lib/chart-colors";
import { formatDate, formatINR, formatMonthYear, formatShortDate } from "@/lib/format";
import { goalStatus } from "@/lib/metrics/goals";
import { useSearchParams } from "@/lib/nav";
import { dayKey, lastDay, parseDay, type Period } from "@/lib/period";
import { GOAL_STATUS } from "@/lib/status";
import { api, query } from "@/web/api";
import { useTitle } from "@/web/title";

const ICONS: Record<string, [LucideIcon, TileTone]> = {
  target: [Target, "red"], users: [Users, "purple"], "folder-check": [FolderCheck, "purple"], rocket: [Rocket, "blue"], "user-plus": [UserPlus, "pink"], workflow: [Workflow, "red"],
  youtube: [MonitorPlay, "red"], smile: [Smile, "blue"], "graduation-cap": [GraduationCap, "blue"], "bar-chart": [BarChart3, "green"], "file-text": [FileText, "orange"], video: [Video, "purple"],
};

type Payload = Awaited<ReturnType<typeof fetchGoals>>;
type Loaded = Extract<Payload, { denied: false }>;
type Row = Omit<Loaded["rows"][number], "startDate" | "endDate"> & {
  startDate: Date;
  endDate: Date;
  owner: { name: string; image: string | null };
  members: { userId: string; user: { id: string; name: string; image: string | null } }[];
};
type Props = {
  rows: Row[];
  sp: Record<string, string>;
  scope: string;
  userId: string;
  range: { preset: string; from: string; to: string };
  people: { id: string; name: string }[];
  companies: ("vmh" | "vth")[];
  canCreate: boolean;
  toggle: React.ReactNode;
};

const fetchGoals = (q: Record<string, string>) => query(api.api.goals.$get({ query: q }));

const valueText = (g: Row, v: unknown) => (g.unit === "CURRENCY" ? formatINR(Number(v)) : g.unit === "PERCENT" ? `${Number(v)}%` : g.unit === "HOURS" ? `${Number(v)}h` : String(Number(v)));
const barTone = (g: Row) => (g.status === "COMPLETED" || g.progress >= 100 ? "success" : g.status === "OVERDUE" || g.status === "OFF_TRACK" ? "danger" : "primary") as "success";

export default function GoalsPage() {
  useTitle("Goals");
  const [params] = useSearchParams();
  const sp = Object.fromEntries(params);
  const { data } = useQuery({ queryKey: ["goals", sp], queryFn: () => fetchGoals(sp) });

  if (!data) return <CardSkeleton className="h-96" />;
  if (data.denied) return <p className="p-6 text-sm text-ink-2">You don&apos;t have access to goals.</p>;

  const t = now();
  const from = new Date(data.from);
  const to = new Date(data.to);
  const period: Period = { preset: "custom", from, to, prevFrom: from, prevTo: from };
  const rows = data.rows.map((g) => ({ ...g, startDate: new Date(g.startDate), endDate: new Date(g.endDate) })) as Row[];
  const simple = (sp.view ?? (data.memberOnly ? "simple" : "detailed")) === "simple";
  const range = { preset: "custom", from: dayKey(from), to: dayKey(lastDay(period)) };
  const toggle = <SegmentedControl param="view" active={simple ? "simple" : "detailed"} options={[{ value: "detailed", label: "Detailed" }, { value: "simple", label: "Simple" }]} />;
  const shared = { rows, sp, scope: data.scope, userId: data.userId, range, people: data.people, companies: data.companies, canCreate: data.canCreate, toggle };
  return simple ? <Simple {...shared} /> : <Detailed {...shared} t={t} />;
}

function Detailed({ rows, sp, scope, userId, range, people, companies, canCreate, toggle, t }: Props & { t: Date }) {
  const tab = sp.tab ?? "overview";
  const scopeTab = { company: "COMPANY", team: "TEAM", personal: "PERSONAL" }[tab];
  const co = sp.co;
  const q = sp.q?.toLowerCase();
  const filtered = rows.filter((g) => (!scopeTab || g.scope === scopeTab) && (!co || g.companyId === co || g.companyId === null) && (!sp.category || g.category === sp.category) && (!sp.status || g.status === sp.status) && (!sp.owner || g.ownerId === sp.owner) && (!q || g.title.toLowerCase().includes(q)));
  const count = (st: string, c?: string) => rows.filter((g) => g.status === st && (!c || g.companyId === c)).length;
  const total = (c?: string) => rows.filter((g) => !c || g.companyId === c).length;
  const split = (f: (c: string) => number) => (scope === "ALL" ? [{ value: f("vmh"), label: "VMH" }, { value: f("vth"), label: "VTH" }] : undefined);
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
  const catData = [...cats.map((x) => ({ label: GOAL_CATEGORY_LABELS[x]!, value: rows.filter((g) => g.category === x).length, color: GOAL_CATEGORY_COLORS[x]!, href: `/goals?category=${x}` })), { label: "Other", value: rows.filter((g) => !cats.includes(g.category)).length, color: OTHER_GREY, href: "/goals" }].filter((x) => x.value);
  const selected = rows.find((g) => g.id === sp.id) ?? filtered[0];
  return (
    <div className="space-y-3.5">
      <PageHeader title="Goals" subtitle="Set, track, and achieve goals across Vertex Media House and Vertex Tech House." actions={<>{toggle}<DateRangePicker {...range} />{canCreate && <GoalDialog label="Create Goal" companies={companies} people={people} />}</>} />
      <UnderlineTabs active={tab} tabs={[{ value: "overview", label: "Overview" }, { value: "company", label: "Company Goals" }, { value: "team", label: "Team Goals" }, { value: "personal", label: "Personal Goals" }]} />
      <div className="grid gap-3.5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-3.5">
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={Target} tone="green" label="Total Goals" value={rows.length} split={split((x) => total(x))} />
            <KpiCard icon={LineChart} tone="blue" label="On Track" value={count("ON_TRACK")} trend={pct(count("ON_TRACK"))} split={split((x) => count("ON_TRACK", x))} />
            <KpiCard icon={Clock} tone="orange" label="At Risk" value={count("AT_RISK")} trend={pct(count("AT_RISK"))} inverse split={split((x) => count("AT_RISK", x))} />
            <KpiCard icon={AlertCircle} tone="red" label="Off Track" value={count("OFF_TRACK") + count("OVERDUE")} trend={pct(count("OFF_TRACK") + count("OVERDUE"))} inverse split={split((x) => count("OFF_TRACK", x) + count("OVERDUE", x))} />
          </div>
          <div className="grid gap-3.5 xl:grid-cols-[1.7fr_1fr]">
            <SectionCard title="Goal Progress Overview">
              <ChartLegend className="mb-2 justify-center" items={[{ label: "All Goals", color: GOAL_LINE_COLORS.ALL, line: true, href: "/goals" }, { label: "VMH Goals", color: GOAL_LINE_COLORS.VMH, line: true, href: "/goals?co=vmh" }, { label: "VTH Goals", color: GOAL_LINE_COLORS.VTH, line: true, href: "/goals?co=vth" }]} />
              <LinesChart data={line} xKey="m" yFormat="percent" height={180} series={[{ key: "ALL", label: "All Goals", color: GOAL_LINE_COLORS.ALL, href: "/goals" }, { key: "VMH", label: "VMH Goals", color: GOAL_LINE_COLORS.VMH, href: "/goals?co=vmh" }, { key: "VTH", label: "VTH Goals", color: GOAL_LINE_COLORS.VTH, href: "/goals?co=vth" }]} />
            </SectionCard>
            <SectionCard title="Goals by Category">
              <div className="flex items-center gap-4"><DonutChart data={catData} center={rows.length} centerLabel="Goals" size={130} thickness={20} /><DonutLegend items={catData.map((x) => ({ ...x, value: `${pct(x.value)}%` }))} /></div>
            </SectionCard>
          </div>
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              {scope === "ALL" && <FilterTabs param="co" active={co ?? "all"} className="mr-auto" tabs={[{ value: "all", label: "All Goals", count: rows.length, tone: "blue" }, { value: "vmh", label: "VMH Goals", count: total("vmh"), tone: "vmh" }, { value: "vth", label: "VTH Goals", count: total("vth"), tone: "vth" }]} />}
              <FilterSelect param="category" placeholder="All Categories" options={Object.entries(GOAL_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} />
              <FilterSelect param="status" placeholder="All Status" options={Object.entries(GOAL_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
              <FilterSelect param="owner" placeholder="All Owners" options={people.map((x) => ({ value: x.id, label: x.name }))} />
              <SearchInput placeholder="Search goals..." className="w-48" />
            </div>
            <div className="overflow-x-auto"><table className="w-full text-2xs">
              <thead><tr className="text-left text-ink-2">{["Goal Title", "Company", "Category", "Start Date", "End Date", "Progress", "Status", "Owner"].map((h) => <th key={h} className="bg-surface-muted px-2 py-2 font-medium first:rounded-l-md last:rounded-r-md">{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((g) => { const [Icon] = ICONS[g.icon ?? "target"] ?? [Target]; return (
                  <tr key={g.id} className={`border-b ${selected?.id === g.id ? "bg-brand-soft" : "hover:bg-accent"}`}>
                    <td className="px-2 py-2"><Link href={`?${new URLSearchParams({ ...sp, id: g.id })}`} scroll={false} className="flex items-center gap-2 font-semibold text-ink hover:underline"><Icon className="size-4 text-danger-text" />{g.title}</Link></td>
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
            </table></div>
            {filtered.length === 0 && <EmptyState title="No goals here yet" />}
          </Card>
        </div>
        {selected && <GoalPanel goal={selected} userId={userId} />}
      </div>
    </div>
  );
}

function GoalPanel({ goal, userId }: { goal: Row; userId: string }) {
  const { data } = useQuery({ queryKey: ["goals", "panel", goal.id], queryFn: () => query(api.api.goals[":id"].panel.$get({ param: { id: goal.id } })) });
  if (!data) return <CardSkeleton className="h-96" />;
  const { milestones, activity, canUpdate } = data;
  const canEdit = canUpdate || goal.ownerId === userId;
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
        {milestones.map((m) => <label key={m.id} className="flex items-center gap-2.5 py-1.5 text-xs">{canEdit ? <MilestoneCheck id={m.id} done={m.done} label={m.title} /> : <input type="checkbox" checked={m.done} readOnly className="size-4" />}<span className="flex-1 text-ink">{m.title}</span><span className="text-ink-muted">{formatShortDate(new Date(m.date))}</span></label>)}
        {milestones.length === 0 && <EmptyState title="No milestones" className="py-4" />}
      </SectionCard>
      <SectionCard title="Recent Activity">
        {activity.map((a) => <ActivityRow key={a.id} person={a.actor ?? undefined} text={a.summary} time={a.time} />)}
        {activity.length === 0 && <EmptyState title="No activity yet" className="py-4" />}
      </SectionCard>
    </div>
  );
}

function Simple({ rows, sp, scope, userId, range, people, companies, canCreate, toggle }: Props) {
  const tab = sp.tab ?? "my";
  const q = sp.q?.toLowerCase();
  const co = sp.company;
  const mine = (g: Row) => g.ownerId === userId || g.members.some((m) => m.userId === userId);
  const filtered = rows.filter((g) => (tab === "my" ? mine(g) : tab === "team" ? g.scope === "TEAM" : g.scope === "COMPANY") && (!q || g.title.toLowerCase().includes(q)) && (!sp.status || g.status === sp.status) && (!co || g.companyId === co || g.companyId === null));
  const n = (s: string) => filtered.filter((g) => g.status === s).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Goals" subtitle="Set, track and achieve your important goals." actions={<>{toggle}{canCreate && <GoalDialog label="Add Goal" companies={companies} people={people} />}</>} />
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
        {scope === "ALL" && <FilterSelect param="company" placeholder="All Companies" options={[{ value: "vmh", label: "Vertex Media House" }, { value: "vth", label: "Vertex Tech House" }]} />}
        <DateRangePicker {...range} />
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full">
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
        </table></div>
        {filtered.length === 0 && <EmptyState title="No goals yet" />}
      </Card>
    </div>
  );
}
