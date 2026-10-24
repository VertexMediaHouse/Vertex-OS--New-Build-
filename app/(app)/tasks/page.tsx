import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarDays, CircleCheck, Clock, Columns3, ExternalLink, List, Users } from "lucide-react";
import { getRequestContext } from "@/lib/auth/context";
import { can, isMemberOnly } from "@/lib/auth/permissions";
import { db, type Prisma } from "@/lib/db";
import { addDays, now, startOfDayIST, startOfMonthIST, startOfWeekIST } from "@/lib/clock";
import { formatDate, formatDateTime, formatDaysLeft, formatDuration, formatFileSize, formatShortDate } from "@/lib/format";
import { pctChange } from "@/lib/period";
import { readParams, subScope, type SP } from "@/lib/search-params";
import { PRIORITY, TASK_STATUS } from "@/lib/status";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, ProgressBar, SectionCard, Avatar } from "@/components/shared/primitives";
import { CardSkeleton, EmptyState, KeyValue, PageHeader } from "@/components/shared/layout";
import { SegmentedControl } from "@/components/shared/nav";
import { ClearFilters, FilterSelect, SearchInput } from "@/components/shared/filters";
import { CompanyBadge, EnumPill, companyCode } from "@/components/shared/pills";
import { UrlSheet } from "@/components/shared/url-sheet";
import { FileIcon } from "@/components/shared/display";
import { ChecklistControls, CommentBox, NewTaskDialog, TaskBoard, TaskFieldSelect, TaskStatusSelect, type BoardTask } from "@/components/tasks/task-client";
import * as M from "@/lib/metrics/dashboard";
import { workloadState } from "@/lib/metrics/workload";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return <Suspense fallback={<CardSkeleton className="h-96" />}><Tasks searchParams={searchParams} /></Suspense>;
}

async function Tasks({ searchParams }: { searchParams: Promise<SP> }) {
  const [ctx, sp] = await Promise.all([getRequestContext(), searchParams]);
  const p = readParams(sp);
  const t = now();
  const today = startOfDayIST(t);
  const weekStart = startOfWeekIST(t);
  const mine = isMemberOnly(ctx.user);
  const base: Prisma.TaskWhereInput = { companyId: { in: ctx.companyIds }, ...(mine && { assigneeId: ctx.user.id }) };
  const q = p.str("q");
  const where: Prisma.TaskWhereInput = {
    ...base,
    companyId: { in: subScope(ctx.companyIds, p.str("co")) },
    ...(p.str("project") && { projectId: p.str("project")! }),
    ...(p.str("assignee") && { assigneeId: p.str("assignee")! }),
    ...(p.str("priority") && { priority: p.str("priority") as "HIGH" }),
    ...(p.str("status") && { status: p.str("status") as "TODO" }),
    ...(q && { OR: [{ title: { contains: q, mode: "insensitive" } }, { project: { client: { name: { contains: q, mode: "insensitive" } } } }] }),
  };
  const open = { ...base, status: { not: "COMPLETED" as const } };
  const month = startOfMonthIST(t);
  const view = p.str("view") ?? "kanban";
  // The board hides tasks completed over 30 days ago, so it doesn't grow without end. Search,
  // the status filter and the other views must still find them. AND, because `where` uses OR.
  const recentOnly = view === "kanban" && !q && !p.str("status");
  const [tasks, projects, people, kpis, myTasks] = await Promise.all([
    db.task.findMany({
      where: recentOnly ? { ...where, AND: [{ OR: [{ status: { not: "COMPLETED" } }, { completedAt: { gte: addDays(t, -30) } }] }] } : where,
      orderBy: [{ position: "asc" }, { dueDate: "asc" }],
      include: { project: { select: { name: true, client: { select: { name: true } } } }, assignee: { select: { name: true } } },
    }),
    db.project.findMany({ where: { companyId: { in: ctx.companyIds }, status: { not: "COMPLETED" } }, select: { id: true, name: true, companyId: true, client: { select: { name: true } } }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { kind: "STAFF", isOwner: false, memberships: { some: { companyId: { in: ctx.companyIds } } } }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    Promise.all([
      db.task.groupBy({ by: ["companyId"], _count: true, where: base }),
      db.task.groupBy({ by: ["companyId"], _count: true, where: { ...base, status: "TODO" } }),
      db.task.groupBy({ by: ["companyId"], _count: true, where: { ...open, dueDate: { gte: today, lt: addDays(today, 1) } } }),
      db.task.groupBy({ by: ["companyId"], _count: true, where: { ...open, dueDate: { lt: today } } }),
      db.task.groupBy({ by: ["companyId"], _count: true, where: { ...base, status: "COMPLETED", completedAt: { gte: weekStart } } }),
      db.task.count({ where: { ...base, status: "COMPLETED", completedAt: { gte: addDays(weekStart, -7), lt: weekStart } } }),
      db.task.count({ where: { ...base, createdAt: { gte: month } } }),
      db.task.count({ where: { ...base, createdAt: { gte: new Date(month.getTime() - 30 * 86_400_000), lt: month } } }),
    ]),
    db.task.findMany({ where: { companyId: { in: ctx.companyIds }, status: { not: "COMPLETED" }, OR: [{ assigneeId: ctx.user.id }, { createdById: ctx.user.id }] }, orderBy: { dueDate: "asc" }, take: 5, include: { project: { select: { client: { select: { name: true } } } }, assignee: { select: { name: true } } } }),
  ]);
  const [total, pending, dueToday, overdue, doneWeek, donePrev, createdNow, createdPrev] = kpis;
  const sum = (r: { _count: number }[]) => r.reduce((a, x) => a + x._count, 0);
  const by = (r: { companyId: string; _count: number }[], c: string) => r.find((x) => x.companyId === c)?._count ?? 0;
  const split = (r: { companyId: string; _count: number }[]) => (ctx.scope === "ALL" ? [{ value: by(r, "vmh"), label: "VMH" }, { value: by(r, "vth"), label: "VTH" }] : undefined);

  const board: Record<string, BoardTask[]> = { TODO: [], IN_PROGRESS: [], IN_REVIEW: [], CLIENT_REVIEW: [], COMPLETED: [] };
  for (const tk of tasks) board[tk.status]!.push({ id: tk.id, title: tk.title, co: companyCode(tk.companyId), client: tk.project?.client?.name ?? tk.project?.name ?? null, priority: tk.priority, due: tk.dueDate ? formatShortDate(tk.dueDate) : null, progress: tk.progress, assignee: tk.assignee?.name ?? null });
  // Workload % comes from the shared helper, so this table, the dashboard and Team agree.
  const [allTasks, hours] = await Promise.all([
    db.task.findMany({ where: { ...base, assigneeId: { in: people.map((x) => x.id) } }, select: { assigneeId: true, status: true, dueDate: true, estimatedMinutes: true } }),
    M.teamWorkload({ companyIds: ctx.companyIds }),
  ]);
  const workload = people.map((u) => {
    const own = allTasks.filter((x) => x.assigneeId === u.id);
    const openOwn = own.filter((x) => x.status !== "COMPLETED");
    return { ...u, assigned: own.length, completed: own.length - openOwn.length, inProgress: own.filter((x) => x.status === "IN_PROGRESS").length, overdue: openOwn.filter((x) => x.dueDate && x.dueDate < today).length, pct: hours.find((h) => h.id === u.id)?.pct ?? 0 };
  });
  const companies = ctx.companyIds.filter((c): c is "vmh" | "vth" => can(ctx.user, "create", "task", c));
  const addHref = `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")), new: "1" })}`;

  return (
    <div className="space-y-3.5">
      <PageHeader
        title="Tasks"
        subtitle="Plan, assign and track all tasks across Vertex Media House and Vertex Tech House."
        actions={
          <>
            {companies.length > 0 && <NewTaskDialog key={p.str("new") ?? "x"} companies={companies} projects={projects} people={people} open={Boolean(p.str("new"))} status={p.str("status") ?? undefined} />}
            <SegmentedControl param="view" active={view} options={[{ value: "kanban", label: "Kanban", icon: <Columns3 className="size-4" /> }, { value: "list", label: "List", icon: <List className="size-4" /> }, { value: "calendar", label: "Calendar", icon: <CalendarDays className="size-4" /> }]} />
          </>
        }
      />
      <div className="grid gap-3.5 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard icon={Users} tone="blue" label="Total Tasks" value={sum(total)} trend={pctChange(createdNow, createdPrev)} split={split(total)} />
        <KpiCard icon={Clock} tone="purple" label="Pending" value={sum(pending)} split={split(pending)} />
        <KpiCard icon={CalendarDays} tone="orange" label="Due Today" value={sum(dueToday)} split={split(dueToday)} />
        <KpiCard icon={AlertTriangle} tone="red" label="Overdue" value={sum(overdue)} inverse split={split(overdue)} />
        <KpiCard icon={CircleCheck} tone="green" label="Completed" suffix="(This Week)" value={sum(doneWeek)} trend={pctChange(sum(doneWeek), donePrev)} split={split(doneWeek)} />
      </div>
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <SearchInput placeholder="Search tasks..." className="w-52" />
        {ctx.scope === "ALL" && <FilterSelect param="co" placeholder="All Companies" options={[{ value: "vmh", label: "Vertex Media House" }, { value: "vth", label: "Vertex Tech House" }]} />}
        <FilterSelect param="project" placeholder="All Projects" options={projects.map((x) => ({ value: x.id, label: `${x.client?.name ?? ""} · ${x.name}` }))} />
        {!mine && <FilterSelect param="assignee" placeholder="All Assignees" options={people.map((x) => ({ value: x.id, label: x.name }))} />}
        <FilterSelect param="priority" placeholder="All Priority" options={Object.entries(PRIORITY).map(([value, m]) => ({ value, label: m.label }))} />
        <FilterSelect param="status" placeholder="All Status" options={Object.entries(TASK_STATUS).map(([value, m]) => ({ value, label: m.label }))} />
        <ClearFilters params={["q", "co", "project", "assignee", "priority", "status"]} />
      </Card>

      {view === "kanban" && <TaskBoard items={board} addHref={addHref} />}
      {view === "list" && (
        <Card className="p-4">
          <table className="w-full text-2xs">
            <thead><tr className="text-left text-ink-2">{["Task", "Company", "Project", "Priority", "Due Date", "Progress", "Status", "Assignee"].map((h) => <th key={h} className="bg-surface-muted px-2 py-2 font-medium first:rounded-l-md last:rounded-r-md">{h}</th>)}</tr></thead>
            <tbody>
              {tasks.map((tk) => (
                <tr key={tk.id} className="border-b hover:bg-[#F8FAFC]">
                  <td className="px-2 py-2"><Link href={`?id=${tk.id}&view=list`} className="font-semibold text-ink hover:underline">{tk.title}</Link></td>
                  <td className="px-2 py-2"><CompanyBadge code={companyCode(tk.companyId)} /></td>
                  <td className="px-2 py-2 text-ink-2">{tk.project?.client?.name}</td>
                  <td className="px-2 py-2"><EnumPill map={PRIORITY} value={tk.priority} size="xs" /></td>
                  <td className={`px-2 py-2 ${tk.dueDate && tk.dueDate < today && tk.status !== "COMPLETED" ? "text-danger-text" : "text-ink-2"}`}>{tk.dueDate && formatDate(tk.dueDate)}</td>
                  <td className="w-28 px-2 py-2"><ProgressBar value={tk.progress} /></td>
                  <td className="px-2 py-2"><EnumPill map={TASK_STATUS} value={tk.status} size="xs" /></td>
                  <td className="px-2 py-2">{tk.assignee?.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tasks.length === 0 && <EmptyState title="No tasks match" />}
        </Card>
      )}
      {view === "calendar" && <TaskCalendar tasks={tasks.map((tk) => ({ id: tk.id, title: tk.title, due: tk.dueDate, status: tk.status }))} month={p.str("month")} />}

      <div className="grid gap-3.5 xl:grid-cols-2">
        <SectionCard title="My Tasks" href="/tasks?view=list">
          <table className="w-full text-2xs">
            <thead><tr className="text-left text-ink-2">{["Task", "Project", "Due Date", "Priority", "Status"].map((h) => <th key={h} className="bg-surface-muted px-2 py-1.5 font-medium first:rounded-l-md last:rounded-r-md">{h}</th>)}</tr></thead>
            <tbody>{myTasks.map((tk) => <tr key={tk.id} className="border-b last:border-0"><td className="px-2 py-1.5"><Link href={`?id=${tk.id}`} className="flex items-center gap-2 text-ink hover:underline">{tk.assignee && <Avatar person={tk.assignee} size={20} />}{tk.title}</Link></td><td className="px-2 py-1.5 text-ink-2">{tk.project?.client?.name}</td><td className="px-2 py-1.5 text-ink-2">{tk.dueDate && formatShortDate(tk.dueDate)}</td><td className="px-2 py-1.5"><EnumPill map={PRIORITY} value={tk.priority} size="xs" /></td><td className="px-2 py-1.5"><EnumPill map={TASK_STATUS} value={tk.status} size="xs" /></td></tr>)}</tbody>
          </table>
        </SectionCard>
        <SectionCard title="Team Workload" href="/team">
          <table className="w-full text-2xs">
            <thead><tr className="text-left text-ink-2">{["Team Member", "Assigned", "Completed", "In Progress", "Overdue", "Workload"].map((h) => <th key={h} className="bg-surface-muted px-2 py-1.5 font-medium first:rounded-l-md last:rounded-r-md">{h}</th>)}</tr></thead>
            <tbody>{workload.map((u) => { const st = workloadState(u.pct); return <tr key={u.id} className="border-b last:border-0"><td className="px-2 py-1.5"><span className="flex items-center gap-2"><Avatar person={u} size={22} />{u.name}</span></td><td className="px-2 py-1.5">{u.assigned}</td><td className="px-2 py-1.5">{u.completed}</td><td className="px-2 py-1.5">{u.inProgress}</td><td className={`px-2 py-1.5 ${u.overdue ? "text-danger-text" : ""}`}>{u.overdue}</td><td className="px-2 py-1.5"><span className="flex items-center gap-2"><ProgressBar value={u.pct} tone={st === "over" ? "danger" : st === "idle" ? "warning" : "success"} className="w-24" />{Math.round(u.pct)}%</span></td></tr>; })}</tbody>
          </table>
          <p className="mt-2 text-[10.5px] text-ink-muted">Workload = hours logged and planned this week ÷ weekly capacity.</p>
        </SectionCard>
      </div>

      {p.str("id") && <Suspense><TaskDrawer id={p.str("id")!} people={people} /></Suspense>}
    </div>
  );
}

function TaskCalendar({ tasks, month }: { tasks: { id: string; title: string; due: Date | null; status: string }[]; month: string | null }) {
  const t = now();
  const start = month && /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01T00:00:00+05:30`) : startOfMonthIST(t);
  const ist = new Date(start.getTime() + 5.5 * 3600_000);
  const y = ist.getUTCFullYear(), m = ist.getUTCMonth();
  const daysIn = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const key = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m, 1)));
  const nav = (delta: number) => { const d = new Date(Date.UTC(y, m + delta, 1)); return `?view=calendar&month=${d.toISOString().slice(0, 7)}`; };
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-3"><Link href={nav(-1)} className="text-blue">‹</Link><h2 className="text-lg font-semibold text-ink">{label}</h2><Link href={nav(1)} className="text-blue">›</Link></div>
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

async function TaskDrawer({ id, people }: { id: string; people: { id: string; name: string }[] }) {
  const ctx = await getRequestContext();
  const tk = await db.task.findFirst({
    where: { id, companyId: { in: ctx.companyIds } },
    include: { project: { include: { client: true } }, assignee: true, checklist: { orderBy: { order: "asc" }, include: { assignee: { select: { name: true } } } }, files: { where: { deletedAt: null } }, timeEntries: { select: { durationMin: true } } },
  });
  if (!tk) return null;
  const [comments, activity] = await Promise.all([
    db.comment.findMany({ where: { entityType: "TASK", entityId: id }, orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, image: true } } } }),
    db.activity.findMany({ where: { entityType: "TASK", entityId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const t = now();
  const minutes = tk.timeEntries.reduce((a, e) => a + (e.durationMin ?? 0), 0);
  const done = tk.checklist.filter((c) => c.done).length;
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
          ["Project", tk.project ? <Link key="p" href={`/projects?id=${tk.projectId}`} className="inline-flex items-center gap-1 text-blue hover:underline">{tk.project.client?.name} - {tk.project.name} <ExternalLink className="size-3" /></Link> : "–"],
          ["Client", tk.project?.client ? <Link key="c" href={`/clients/${tk.project.clientId}`} className="text-blue hover:underline">{tk.project.client.name}</Link> : "–"],
          ["Start Date", tk.startDate ? formatDate(tk.startDate) : "–"],
          ["Due Date", tk.dueDate ? <span key="d" className={tk.status !== "COMPLETED" && tk.dueDate.getTime() - t.getTime() < 3 * 86_400_000 ? "text-danger-text" : ""}>{formatDate(tk.dueDate)} ({formatDaysLeft(tk.dueDate, t)})</span> : "–"],
          ["Assignee", <TaskFieldSelect key="a" taskId={tk.id} field="assigneeId" value={tk.assigneeId ?? ""} options={[{ value: "", label: "Unassigned" }, ...people.map((x) => ({ value: x.id, label: x.name }))]} />],
          ["Tags", tk.tags.length ? <span key="t" className="flex flex-wrap gap-1">{tk.tags.map((g) => <span key={g} className="rounded bg-surface-muted px-1.5 py-0.5">{g}</span>)}</span> : "–"],
          ["Time logged", formatDuration(minutes)],
        ]} />
        <section><h3 className="mb-1 text-sm font-semibold text-ink">Description</h3><p className="leading-5 text-ink-2">{tk.description}</p></section>
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink">Checklist ({done}/{tk.checklist.length})</h3>
          <ChecklistControls taskId={tk.id} items={tk.checklist.map((c) => ({ id: c.id, text: c.text, done: c.done, assignee: c.assignee?.name ?? null }))} />
        </section>
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink">Files ({tk.files.length})</h3>
          {tk.files.map((f) => <a key={f.id} href={`/api/files/${f.id}/download`} className="flex items-center gap-2 py-1 hover:underline"><FileIcon ext={f.ext} size={26} /><span className="flex-1">{f.name}<span className="block text-ink-muted">{formatFileSize(f.size)} • {formatDate(f.createdAt)}</span></span></a>)}
        </section>
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink">Comments ({comments.length})</h3>
          {comments.map((c) => <div key={c.id} className="flex gap-2 py-1.5"><Avatar person={c.author} size={26} /><div><p><b>{c.author.name}</b> <span className="text-ink-muted">{formatDateTime(c.createdAt)}</span></p><p className="text-ink-2">{c.body}</p></div></div>)}
          <CommentBox taskId={tk.id} />
        </section>
        <section><h3 className="mb-1 text-sm font-semibold text-ink">Activity</h3>{activity.map((a) => <p key={a.id} className="py-0.5 text-ink-2">{a.summary} · <span className="text-ink-muted">{formatDateTime(a.createdAt)}</span></p>)}</section>
      </div>
    </UrlSheet>
  );
}

