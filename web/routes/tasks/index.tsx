// Ported from app/(app)/tasks/page.tsx: the Prisma queries moved to the server route,
// the render is unchanged.
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, CircleCheck, Clock, Columns3, ExternalLink, List, Users } from "lucide-react";
import { useSearchParams } from "@/lib/nav";
import Link from "@/components/ui/link";
import { formatDate, formatDateTime, formatDaysLeft, formatDuration, formatFileSize, formatShortDate } from "@/lib/format";
import { pctChange } from "@/lib/period";
import { PRIORITY, TASK_STATUS } from "@/lib/status";
import { DeleteButton } from "@/components/shared/delete-button";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, ProgressBar, SectionCard, Avatar } from "@/components/shared/primitives";
import { CardSkeleton, EmptyState, KeyValue, PageHeader } from "@/components/shared/layout";
import { SegmentedControl } from "@/components/shared/nav";
import { ClearFilters, FilterSelect, SearchInput } from "@/components/shared/filters";
import { CompanyBadge, EnumPill, companyCode } from "@/components/shared/pills";
import { UrlSheet } from "@/components/shared/url-sheet";
import { FileIcon } from "@/components/shared/display";
import { ChecklistControls, CommentBox, NewTaskDialog, RoutinesDialog, TaskBoard, TaskFieldSelect, TaskReview, TaskStatusSelect, type BoardTask } from "@/components/tasks/task-client";
import { workloadState } from "@/lib/metrics/workload";
import { API_URL, api, call, query } from "@/web/api";
import { useTitle } from "@/web/title";

const deleteTask = (taskId: string) => call(api.api.tasks.delete.$post({ json: { taskId } }));

export default function TasksPage() {
  useTitle("Tasks");
  const [params] = useSearchParams();
  const sp = Object.fromEntries(params);
  const { data } = useQuery({
    queryKey: ["tasks", params.toString()],
    queryFn: () => query(api.api.tasks.$get({ query: sp })),
  });

  if (!data) return <CardSkeleton className="h-96" />;
  if (data.denied) return <p className="p-6 text-sm text-ink-2">You don&apos;t have access to tasks.</p>;

  const view = params.get("view") ?? "kanban";
  const today = new Date(data.today);
  const board = data.board as Record<string, BoardTask[]>;
  const { kpis } = data;
  const addHref = `?${new URLSearchParams({ ...sp, new: "1" })}`;

  return (
    <div className="space-y-3.5">
      <PageHeader
        title="Tasks"
        subtitle="Plan, assign and track all tasks across Vertex Media House and Vertex Tech House."
        actions={
          <>
            {data.companies.length > 0 && <RoutinesDialog companies={data.companies} projects={data.projects} people={data.people} routines={data.routines} />}
            {data.companies.length > 0 && <NewTaskDialog key={params.get("new") ?? "x"} companies={data.companies} projects={data.projects} people={data.people} open={Boolean(params.get("new"))} status={params.get("status") ?? undefined} />}
            <SegmentedControl param="view" active={view} options={[{ value: "kanban", label: "Kanban", icon: <Columns3 className="size-4" /> }, { value: "list", label: "List", icon: <List className="size-4" /> }, { value: "calendar", label: "Calendar", icon: <CalendarDays className="size-4" /> }]} />
          </>
        }
      />
      <div className="grid gap-3.5 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard icon={Users} tone="blue" label="Total Tasks" value={kpis.total} trend={pctChange(kpis.createdNow, kpis.createdPrev)} split={kpis.splits.total} />
        <KpiCard icon={Clock} tone="purple" label="Pending" value={kpis.pending} split={kpis.splits.pending} />
        <KpiCard icon={CalendarDays} tone="orange" label="Due Today" value={kpis.dueToday} split={kpis.splits.dueToday} />
        <KpiCard icon={AlertTriangle} tone="red" label="Overdue" value={kpis.overdue} inverse split={kpis.splits.overdue} />
        <KpiCard icon={CircleCheck} tone="green" label="Completed" suffix="(This Week)" value={kpis.doneWeek} trend={pctChange(kpis.doneWeek, kpis.donePrev)} split={kpis.splits.doneWeek} />
      </div>
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <SearchInput placeholder="Search tasks..." className="w-52" />
        {data.scope === "ALL" && <FilterSelect param="co" placeholder="All Companies" options={[{ value: "vmh", label: "Vertex Media House" }, { value: "vth", label: "Vertex Tech House" }]} />}
        <FilterSelect param="project" placeholder="All Projects" options={data.projects.map((x) => ({ value: x.id, label: `${x.client?.name ?? ""} · ${x.name}` }))} />
        {!data.mine && <FilterSelect param="assignee" placeholder="All Assignees" options={data.people.map((x) => ({ value: x.id, label: x.name }))} />}
        <FilterSelect param="priority" placeholder="All Priority" options={Object.entries(PRIORITY).map(([value, m]) => ({ value, label: m.label }))} />
        <FilterSelect param="status" placeholder="All Status" options={Object.entries(TASK_STATUS).map(([value, m]) => ({ value, label: m.label }))} />
        <ClearFilters params={["q", "co", "project", "assignee", "priority", "status", "due"]} />
      </Card>

      {view === "kanban" && <TaskBoard items={board} addHref={addHref} />}
      {view === "list" && (
        <Card className="p-4">
          <table className="w-full text-2xs">
            <thead><tr className="text-left text-ink-2">{["Task", "Company", "Project", "Priority", "Due Date", "Progress", "Status", "Assignee"].map((h) => <th key={h} className="bg-surface-muted px-2 py-2 font-medium first:rounded-l-md last:rounded-r-md">{h}</th>)}</tr></thead>
            <tbody>
              {data.tasks.map((tk) => {
                const due = tk.dueDate ? new Date(tk.dueDate) : null;
                return (
                  <tr key={tk.id} className="border-b hover:bg-accent">
                    <td className="px-2 py-2"><Link href={`?id=${tk.id}&view=list`} className="font-semibold text-ink hover:underline">{tk.title}</Link></td>
                    <td className="px-2 py-2"><CompanyBadge code={companyCode(tk.companyId)} /></td>
                    <td className="px-2 py-2 text-ink-2">{tk.project?.client?.name}</td>
                    <td className="px-2 py-2"><EnumPill map={PRIORITY} value={tk.priority} size="xs" /></td>
                    <td className={`px-2 py-2 ${due && due < today && tk.status !== "COMPLETED" ? "text-danger-text" : "text-ink-2"}`}>{due && formatDate(due)}</td>
                    <td className="w-28 px-2 py-2"><ProgressBar value={tk.progress} /></td>
                    <td className="px-2 py-2"><EnumPill map={TASK_STATUS} value={tk.status} size="xs" /></td>
                    <td className="px-2 py-2">{tk.assignee?.name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.tasks.length === 0 && <EmptyState title="No tasks match" />}
        </Card>
      )}
      {view === "calendar" && <TaskCalendar tasks={data.tasks.map((tk) => ({ id: tk.id, title: tk.title, due: tk.dueDate ? new Date(tk.dueDate) : null, status: tk.status }))} month={params.get("month")} />}

      <div className="grid gap-3.5 xl:grid-cols-2">
        <SectionCard title="My Tasks" href="/tasks?view=list">
          <table className="w-full text-2xs">
            <thead><tr className="text-left text-ink-2">{["Task", "Project", "Due Date", "Priority", "Status"].map((h) => <th key={h} className="bg-surface-muted px-2 py-1.5 font-medium first:rounded-l-md last:rounded-r-md">{h}</th>)}</tr></thead>
            <tbody>{data.myTasks.map((tk) => <tr key={tk.id} className="border-b last:border-0"><td className="px-2 py-1.5"><Link href={`?id=${tk.id}`} className="flex items-center gap-2 text-ink hover:underline">{tk.assignee && <Avatar person={tk.assignee} size={20} />}{tk.title}</Link></td><td className="px-2 py-1.5 text-ink-2">{tk.project?.client?.name}</td><td className="px-2 py-1.5 text-ink-2">{tk.dueDate && formatShortDate(new Date(tk.dueDate))}</td><td className="px-2 py-1.5"><EnumPill map={PRIORITY} value={tk.priority} size="xs" /></td><td className="px-2 py-1.5"><EnumPill map={TASK_STATUS} value={tk.status} size="xs" /></td></tr>)}</tbody>
          </table>
        </SectionCard>
        <SectionCard title="Team Workload" href="/team">
          <table className="w-full text-2xs">
            <thead><tr className="text-left text-ink-2">{["Team Member", "Assigned", "Completed", "In Progress", "Overdue", "Workload"].map((h) => <th key={h} className="bg-surface-muted px-2 py-1.5 font-medium first:rounded-l-md last:rounded-r-md">{h}</th>)}</tr></thead>
            <tbody>{data.workload.map((u) => { const st = workloadState(u.pct); return <tr key={u.id} className="border-b last:border-0"><td className="px-2 py-1.5"><span className="flex items-center gap-2"><Avatar person={u} size={22} />{u.name}</span></td><td className="px-2 py-1.5">{u.assigned}</td><td className="px-2 py-1.5">{u.completed}</td><td className="px-2 py-1.5">{u.inProgress}</td><td className={`px-2 py-1.5 ${u.overdue ? "text-danger-text" : ""}`}>{u.overdue}</td><td className="px-2 py-1.5"><span className="flex items-center gap-2"><ProgressBar value={u.pct} tone={st === "over" ? "danger" : st === "idle" ? "warning" : "success"} className="w-24" />{Math.round(u.pct)}%</span></td></tr>; })}</tbody>
          </table>
          <p className="mt-2 text-[10.5px] text-ink-muted">Workload = hours logged and planned this week ÷ weekly capacity.</p>
        </SectionCard>
      </div>

      {params.get("id") && <TaskDrawer id={params.get("id")!} people={data.people} />}
    </div>
  );
}

function TaskCalendar({ tasks, month }: { tasks: { id: string; title: string; due: Date | null; status: string }[]; month: string | null }) {
  const start = month && /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01T00:00:00+05:30`) : new Date();
  const ist = new Date(start.getTime() + 5.5 * 3600_000);
  const y = ist.getUTCFullYear(), m = ist.getUTCMonth();
  const daysIn = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const key = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m, 1)));
  const nav = (delta: number) => { const d = new Date(Date.UTC(y, m + delta, 1)); return `?view=calendar&month=${d.toISOString().slice(0, 7)}`; };
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-3"><Link href={nav(-1)} className="text-brand-text">‹</Link><h2 className="text-lg font-semibold text-ink">{label}</h2><Link href={nav(1)} className="text-brand-text">›</Link></div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-card-border text-2xs">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="bg-surface-muted p-2 font-medium text-ink-2">{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} className="min-h-24 bg-card" />)}
        {Array.from({ length: daysIn }, (_, i) => {
          const dk = `${y}-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
          const items = tasks.filter((tk) => tk.due && key(tk.due) === dk);
          return (
            <div key={dk} className="min-h-24 bg-card p-1.5">
              <p className="mb-1 text-ink-muted">{i + 1}</p>
              {items.slice(0, 3).map((tk) => <Link key={tk.id} href={`?view=calendar&id=${tk.id}`} className={`mb-0.5 block truncate rounded px-1 py-0.5 ${tk.status === "COMPLETED" ? "bg-success-soft text-success-text" : "bg-info-soft text-info-text"}`}>{tk.title}</Link>)}
              {items.length > 3 && <p className="text-ink-muted">+{items.length - 3} more</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TaskDrawer({ id, people }: { id: string; people: { id: string; name: string }[] }) {
  const { data } = useQuery({ queryKey: ["tasks", "detail", id], queryFn: () => query(api.api.tasks.detail.$get({ query: { id } })) });
  if (!data?.task) return null;
  const tk = data.task;
  const t = new Date(data.now);
  const done = tk.checklist.filter((c) => c.done).length;
  const dueDate = tk.dueDate ? new Date(tk.dueDate) : null;
  return (
    <UrlSheet title={tk.title} width={380}>
      <div className="space-y-4 p-5 text-xs">
        <div>
          <h2 className="text-lg font-bold text-ink">{tk.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CompanyBadge code={companyCode(tk.companyId)} />
            <TaskStatusSelect taskId={tk.id} value={tk.status} />
            <TaskFieldSelect taskId={tk.id} field="priority" value={tk.priority} options={Object.entries(PRIORITY).map(([value, m]) => ({ value, label: m.label }))} />
          </div>
        </div>
        <KeyValue labelWidth={80} rows={[
          ["Project", tk.project ? <Link key="p" href={`/projects?id=${tk.projectId}`} className="inline-flex items-center gap-1 text-brand-text hover:underline">{tk.project.client?.name} - {tk.project.name} <ExternalLink className="size-3" /></Link> : "–"],
          ["Client", tk.project?.client ? <Link key="c" href={`/clients/${tk.project.clientId}`} className="text-brand-text hover:underline">{tk.project.client.name}</Link> : "–"],
          ["Start Date", tk.startDate ? formatDate(new Date(tk.startDate)) : "–"],
          ["Due Date", dueDate ? <span key="d" className={tk.status !== "COMPLETED" && dueDate.getTime() - t.getTime() < 3 * 86_400_000 ? "text-danger-text" : ""}>{formatDate(dueDate)} ({formatDaysLeft(dueDate, t)})</span> : "–"],
          ["Assignee", <TaskFieldSelect key="a" taskId={tk.id} field="assigneeId" value={tk.assigneeId ?? ""} options={[{ value: "", label: "Unassigned" }, ...people.map((x) => ({ value: x.id, label: x.name }))]} />],
          ["Tags", tk.tags.length ? <span key="t" className="flex flex-wrap gap-1">{tk.tags.map((g) => <span key={g} className="rounded bg-surface-muted px-1.5 py-0.5">{g}</span>)}</span> : "–"],
          ["Time logged", formatDuration(data.minutes)],
        ]} />
        {/* The review cycle: hand it up when you finish it, approve or return it when it lands with you. */}
        {tk.status === "IN_REVIEW" && tk.assigneeId === data.viewerId ? (
          <TaskReview taskId={tk.id} mode="review" />
        ) : tk.status !== "COMPLETED" && tk.assigneeId === data.viewerId ? (
          <TaskReview taskId={tk.id} mode="do" />
        ) : null}
        <section><h3 className="mb-1 text-sm font-semibold text-ink">Description</h3><p className="leading-5 text-ink-2">{tk.description}</p></section>
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink">Checklist ({done}/{tk.checklist.length})</h3>
          <ChecklistControls taskId={tk.id} items={tk.checklist.map((c) => ({ id: c.id, text: c.text, done: c.done, assignee: c.assignee?.name ?? null }))} />
        </section>
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink">Files ({tk.files.length})</h3>
          {tk.files.map((f) => <a key={f.id} href={`${API_URL}/api/files/${f.id}/download`} className="flex items-center gap-2 py-1 hover:underline"><FileIcon ext={f.ext} size={26} /><span className="flex-1">{f.name}<span className="block text-ink-muted">{formatFileSize(f.size)} • {formatDate(new Date(f.createdAt))}</span></span></a>)}
        </section>
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink">Comments ({data.comments.length})</h3>
          {data.comments.map((c) => <div key={c.id} className="flex gap-2 py-1.5"><Avatar person={c.author} size={26} /><div><p><b>{c.author.name}</b> <span className="text-ink-muted">{formatDateTime(new Date(c.createdAt))}</span></p><p className="text-ink-2">{c.body}</p></div></div>)}
          <CommentBox taskId={tk.id} />
        </section>
        {data.canDelete && <DeleteButton action={() => deleteTask(tk.id)} noun="task" name={tk.title} redirectTo="/tasks" />}
        <section><h3 className="mb-1 text-sm font-semibold text-ink">Activity</h3>{data.activity.map((a) => <p key={a.id} className="py-0.5 text-ink-2">{a.summary} · <span className="text-ink-muted">{formatDateTime(new Date(a.createdAt))}</span></p>)}</section>
      </div>
    </UrlSheet>
  );
}
