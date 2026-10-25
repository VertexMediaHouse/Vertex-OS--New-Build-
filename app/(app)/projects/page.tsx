import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Filter, FileCheck, FileText, FolderOpen, Mail, MessageSquare, Pencil, Phone, Clock, Target, Receipt, StickyNote, Activity as ActivityIcon, Plus } from "lucide-react";
import { getRequestContext } from "@/lib/auth/context";
import { can, isMemberOnly } from "@/lib/auth/permissions";
import { db, type Prisma } from "@/lib/db";
import { now } from "@/lib/clock";
import { dayKey } from "@/lib/period";
import { formatDate, formatDateTime, formatDaysLeft, formatDuration, formatINR, formatRelative, formatShortDate } from "@/lib/format";
import { readParams, type SP } from "@/lib/search-params";
import { logoColor } from "@/lib/clients";
import { APPROVAL_STATUS, FILE_STATUS, INVOICE_STATUS, MILESTONE_STATUS, PRIORITY, PROJECT_STATUS, PRODUCTION_STAGE, TASK_STATUS } from "@/lib/status";
import { BILLING_LABELS, LIST_TABS, TAB_LABELS, TEMPLATES } from "@/lib/projects/templates";
import { Card, ProgressBar, SectionCard, Avatar, AvatarStack } from "@/components/shared/primitives";
import { CardSkeleton, EmptyState, KeyValue } from "@/components/shared/layout";
import { FilterTabs, Pagination, UnderlineTabs } from "@/components/shared/nav";
import { SearchInput } from "@/components/shared/filters";
import { CompanyBadge, EnumPill, StatusPill } from "@/components/shared/pills";
import { ActivityRow, CheckRow, FileRow, Timeline, type TimelinePoint } from "@/components/shared/display";
import { DeliverableStepper, MilestoneToggle, NewProjectDialog, NoteForm, PercentInput, PortalAccessButton, ProjectStatusSelect, RequestApproval } from "@/components/projects/controls";
import { NewTaskDialog } from "@/components/tasks/task-client";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Projects" };
const PAGE = 10;

export default function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  return (
    <Suspense fallback={<CardSkeleton className="h-96" />}>
      <Projects searchParams={searchParams} />
    </Suspense>
  );
}

async function Projects({ searchParams }: { searchParams: Promise<SP> }) {
  const [ctx, sp] = await Promise.all([getRequestContext(), searchParams]);
  const p = readParams(sp);
  const q = p.str("q");
  const base: Prisma.ProjectWhereInput = { companyId: { in: ctx.companyIds }, clientId: { not: null }, ...(p.str("client") && { clientId: p.str("client")! }) };
  if (isMemberOnly(ctx.user)) base.members = { some: { userId: ctx.user.id } };
  const tab = (p.str("list") ?? "all") as keyof typeof LIST_TABS;
  const statuses = LIST_TABS[tab] ?? null;
  const where: Prisma.ProjectWhereInput = { ...base, ...(statuses && { status: { in: [...statuses] as never } }), ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { client: { name: { contains: q, mode: "insensitive" } } }] }) };
  const [list, total, counts, clients] = await Promise.all([
    db.project.findMany({ where, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: (p.page - 1) * PAGE, take: PAGE, include: { client: { select: { name: true } }, members: { include: { user: { select: { name: true, image: true } } } } } }),
    db.project.count({ where }),
    db.project.groupBy({ by: ["status"], _count: true, where: base }),
    db.client.findMany({ where: { archivedAt: null, companies: { some: { companyId: { in: ctx.companyIds } } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const tabCount = (k: keyof typeof LIST_TABS) => counts.filter((c) => !LIST_TABS[k] || (LIST_TABS[k] as readonly string[]).includes(c.status)).reduce((a, c) => a + c._count, 0);
  const selectedId = p.str("id") ?? list[0]?.id;
  const vth = ctx.scope === "VTH";
  const creatable = ctx.companyIds.filter((c): c is "vmh" | "vth" => can(ctx.user, "create", "project", c));

  return (
    <div className="-mx-4 -mt-5 grid min-h-[calc(100vh-56px)] xl:grid-cols-[406px_1fr]">
      <aside className="border-r bg-page px-4 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-ink">{vth ? "Projects (VTH)" : "Client Projects"}</h1>
            <p className="mt-0.5 text-md text-ink-muted">{vth ? "Manage all website, CRM, ERP and automation projects" : "Manage and track all client projects"}</p>
          </div>
          {creatable.length > 0 && <NewProjectDialog companies={creatable} clients={clients} brandGreen={vth} />}
        </div>
        <FilterTabs
          param="list"
          active={tab}
          className="mt-4"
          tabs={[
            { value: "all", label: "All", count: tabCount("all"), tone: vth ? "vth" : "blue" },
            { value: "active", label: "Active", count: tabCount("active") },
            { value: "review", label: "In Review", count: tabCount("review") },
            { value: "completed", label: "Completed", count: tabCount("completed") },
          ]}
        />
        <div className="mt-3 flex gap-2">
          <SearchInput placeholder="Search projects..." className="flex-1" />
          <span className="inline-flex size-9 items-center justify-center rounded-lg border bg-card text-ink-2" aria-hidden><Filter className="size-4" /></span>
        </div>
        <ul className="mt-3 space-y-2">
          {list.map((pr) => {
            const selected = pr.id === selectedId;
            const color = logoColor(pr.client?.name ?? "?");
            return (
              <li key={pr.id}>
                <Link
                  href={`?${new URLSearchParams({ ...strParams(sp), id: pr.id, tab: "" }).toString().replace(/&?tab=/, "")}`}
                  scroll={false}
                  className={cn("block rounded-[10px] border bg-card p-3 transition-colors", selected ? (vth ? "border-l-2 border-l-vth bg-brand-soft/60" : "border-l-2 border-l-blue bg-brand-soft/60") : "hover:bg-accent")}
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-lg font-bold" style={{ background: `${color}1F`, color }}>{pr.client?.name[0]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{pr.client?.name}</p>
                          <p className="truncate text-xs text-ink-muted">{pr.name}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {!vth && <CompanyBadge code={pr.template} />}
                          <EnumPill map={PROJECT_STATUS} value={pr.status} />
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center gap-3">
                        <ProgressBar value={pr.progress} className="max-w-[150px]" />
                        <span className="text-xs text-ink-2 tabular">{pr.progress}%</span>
                        <span className="ml-auto"><AvatarStack people={pr.members.map((m) => m.user)} size={22} /></span>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
          {list.length === 0 && <EmptyState title="No projects match" />}
        </ul>
        <Pagination className="mt-4" page={p.page} pageSize={PAGE} total={total} noun="projects" />
      </aside>
      <section className="min-w-0 px-4 pt-5 pb-6">
        {selectedId ? (
          <Suspense fallback={<CardSkeleton className="h-96" />}>
            <ProjectDetail id={selectedId} tab={p.str("tab") ?? "overview"} sp={sp} />
          </Suspense>
        ) : (
          <EmptyState title="No project selected" hint="Create a project to get started." />
        )}
      </section>
    </div>
  );
}

const strParams = (sp: SP) => Object.fromEntries(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"));

async function ProjectDetail({ id, tab, sp }: { id: string; tab: string; sp: SP }) {
  const ctx = await getRequestContext();
  const pr = await db.project.findFirst({
    // Same rule as the list: members only see projects they're on.
    where: { id, companyId: { in: ctx.companyIds }, ...(isMemberOnly(ctx.user) && { members: { some: { userId: ctx.user.id } } }) },
    include: {
      client: { include: { contacts: { orderBy: { isPrimary: "desc" }, include: { projects: { where: { projectId: id }, select: { projectId: true } } } } } },
      company: { select: { name: true, code: true } },
      members: { include: { user: { select: { name: true, image: true } } } },
      deliverables: { orderBy: { order: "asc" } },
      milestones: { orderBy: [{ order: "asc" }, { dueDate: "asc" }] },
      phases: { orderBy: { order: "asc" } },
      approvals: { orderBy: { requestedAt: "desc" }, take: 6 },
      invoices: { orderBy: { issueDate: "desc" } },
    },
  });
  if (!pr) notFound();
  const vth = pr.template === "VTH";
  const t = now();
  const [tasks, taskCount, doneCount, files, time, notes, activity, clients, people] = await Promise.all([
    db.task.findMany({ where: { projectId: id }, orderBy: [{ dueDate: "asc" }], take: tab === "tasks" ? 100 : 5, include: { assignee: { select: { name: true, image: true } } } }),
    db.task.count({ where: { projectId: id } }),
    db.task.count({ where: { projectId: id, status: "COMPLETED" } }),
    db.file.findMany({ where: { projectId: id, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: tab === "files" ? 100 : 5 }),
    db.timeEntry.groupBy({ by: ["billable"], _sum: { durationMin: true }, where: { projectId: id } }),
    db.comment.findMany({ where: { entityType: "PROJECT", entityId: id }, orderBy: { createdAt: "desc" }, take: tab === "notes" ? 100 : 3, include: { author: { select: { name: true, image: true } } } }),
    db.activity.findMany({ where: { entityId: id }, orderBy: { createdAt: "desc" }, take: 20, include: { actor: { select: { name: true } } } }),
    db.client.findMany({ where: { archivedAt: null, companies: { some: { companyId: pr.companyId } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { kind: "STAFF", memberships: { some: { companyId: pr.companyId } } }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const billable = Number(time.find((x) => x.billable)?._sum.durationMin ?? 0);
  const nonBillable = Number(time.find((x) => !x.billable)?._sum.durationMin ?? 0);
  const primary = pr.client?.contacts.find((c) => c.isPrimary) ?? pr.client?.contacts[0];
  const others = pr.client?.contacts.filter((c) => c.id !== primary?.id) ?? [];
  const due = pr.dueDate;
  const daysLeft = due ? formatDaysLeft(due, t) : null;
  const dueRed = due ? due.getTime() - t.getTime() < 7 * 86_400_000 : false;
  const color = logoColor(pr.client?.name ?? "?");
  const editable = can(ctx.user, "update", "project", pr.companyId);
  const formValues = { id: pr.id, companyId: pr.companyId as "vmh" | "vth", clientId: pr.clientId ?? "", name: pr.name, typeLabel: pr.typeLabel, category: pr.category, billingType: pr.billingType, value: Number(pr.value), retainerHours: pr.retainerHours, startDate: dayKey(pr.startDate), dueDate: pr.dueDate ? dayKey(pr.dueDate) : "", priority: pr.priority, summary: pr.summary ?? "", description: pr.description ?? "" };
  const editDialog = (trigger: React.ReactNode) => <NewProjectDialog companies={[pr.companyId as "vmh"]} clients={clients} project={formValues} trigger={trigger} />;
  const accent = vth ? "text-vth-text" : "text-brand-text";
  const dueText = due && <span className={dueRed ? "text-danger-text" : undefined}>{formatDate(due)} ({daysLeft})</span>;
  const timeline: TimelinePoint[] = (pr.phases.length ? pr.phases : pr.milestones.map((m) => ({ label: m.title, date: m.dueDate, status: m.status }))).map((ph, i, arr) => {
    const firstOpen = arr.findIndex((x) => x.status !== "COMPLETED");
    const state = ph.status === "COMPLETED" ? "done" : ph.status === "IN_PROGRESS" ? "current" : i === firstOpen || (i === firstOpen + 1 && arr[firstOpen]?.status === "IN_PROGRESS") ? "next" : "todo";
    return { label: ph.label, date: formatShortDate(ph.date), state };
  });

  const tabs = TEMPLATES[pr.template].tabs.map((k) => ({ value: k, label: <>{k === "notes" && <StickyNote className="size-3.5" />}{k === "activity" && <ActivityIcon className="size-3.5" />}{TAB_LABELS[k]}</> }));

  const taskTable = (
    <table className="w-full text-2xs">
      <thead><tr className="text-left text-ink-2">{["Task", "Assignee", "Due Date", "Status"].map((h) => <th key={h} className="bg-surface-muted px-2 py-1.5 font-medium first:rounded-l-md last:rounded-r-md">{h}</th>)}</tr></thead>
      <tbody>
        {tasks.map((tk) => {
          const label = !vth && tk.status === "IN_PROGRESS" && tk.productionStage ? PRODUCTION_STAGE[tk.productionStage]! : TASK_STATUS[tk.status]!;
          return (
            <tr key={tk.id} className="border-b last:border-0">
              <td className="px-2 py-1.5"><Link href={`/tasks?id=${tk.id}`} className="flex items-center gap-2 text-ink hover:underline"><span className={cn("size-2.5 rounded-full border", tk.status === "COMPLETED" ? "border-success bg-success" : "border-input")} aria-hidden />{tk.title}</Link></td>
              <td className="px-2 py-1.5">{tk.assignee && <Avatar person={tk.assignee} size={22} />}</td>
              <td className="px-2 py-1.5 text-ink-2">{tk.dueDate && formatShortDate(tk.dueDate)}</td>
              <td className="px-2 py-1.5"><StatusPill label={tk.status === "TODO" ? "Pending" : label.label} tone={label.tone} size="xs" /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
  const fileList = files.length ? files.map((f) => <FileRow key={f.id} name={f.name} ext={f.ext} size={f.size} date={f.updatedAt} status={f.status ? <EnumPill map={FILE_STATUS} value={f.status} dot={false} size="xs" /> : undefined} href={`/api/files/${f.id}/download`} />) : <EmptyState title="No files yet" />;
  const noteList = (
    <>
      {notes.map((n) => <ActivityRow key={n.id} person={n.author} text={<><span className="font-semibold">{n.author.name}</span> <span className="float-right text-ink-muted">{formatDateTime(n.createdAt)}</span><br />{n.body}</>} time="" />)}
      {editable && <NoteForm projectId={pr.id} />}
    </>
  );
  const invoiceTable = (
    <>
      <table className="w-full text-2xs">
        <thead><tr className="text-left text-ink-2">{["Invoice", "Amount", "Status", "Due Date"].map((h) => <th key={h} className="bg-surface-muted px-2 py-1.5 font-medium first:rounded-l-md last:rounded-r-md">{h}</th>)}</tr></thead>
        <tbody>{pr.invoices.map((i) => <tr key={i.id} className="border-b last:border-0"><td className="px-2 py-1.5"><Link href={`/invoices?id=${i.id}`} className="text-ink hover:underline">#{i.number}</Link></td><td className="px-2 py-1.5 tabular">{formatINR(i.total)}</td><td className="px-2 py-1.5"><EnumPill map={INVOICE_STATUS} value={i.status} size="xs" /></td><td className="px-2 py-1.5 text-ink-2">{formatDate(i.dueDate)}</td></tr>)}</tbody>
      </table>
      {can(ctx.user, "create", "invoice", pr.companyId) && <Link href={`/invoices/new?project=${pr.id}`} className="mt-3 inline-flex h-8 items-center gap-1 rounded-lg bg-brand-soft px-3 text-xs font-semibold text-brand-text"><Plus className="size-3.5" /> Create Invoice</Link>}
    </>
  );

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-muted"><Link href="/projects" className="hover:underline">Projects</Link> › {pr.client?.name} › {pr.name}</p>
        <div className="flex gap-2">
          {editable && editDialog(<button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-xs font-medium hover:bg-accent"><Pencil className="size-3.5" /> Edit Project</button>)}
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-xl text-2xl font-bold" style={{ background: `${color}1F`, color }}>{pr.client?.name[0]}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><h2 className="text-xl font-bold text-ink">{pr.name}</h2><CompanyBadge code={pr.template} /></div>
          {pr.client && <Link href={`/clients/${pr.clientId}`} className={cn("mt-0.5 inline-flex items-center gap-1 text-sm font-medium hover:underline", accent)}>{pr.client.name} <ExternalLink className="size-3.5" /></Link>}
          <p className="mt-1 text-sm text-ink-muted">{pr.summary}</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-4">
            {editable ? <ProjectStatusSelect projectId={pr.id} status={pr.status} statuses={TEMPLATES[pr.template].statuses} /> : <EnumPill map={PROJECT_STATUS} value={pr.status} />}
            <span className="w-40"><ProgressBar value={pr.progress} /></span>
            <span className="text-sm font-semibold text-ink">{pr.progress}%</span>
          </div>
          <div className="flex gap-8 text-xs">
            <div><p className="text-ink-muted">Start Date</p><p className="font-semibold text-ink">{formatDate(pr.startDate)}</p></div>
            {due && <div><p className="text-ink-muted">Due Date</p><p className="font-semibold">{dueText}</p></div>}
          </div>
        </div>
      </div>
      <UnderlineTabs tabs={tabs} active={tab} />

      {tab === "overview" && (
        <>
          <div className="grid gap-3.5 xl:grid-cols-[1fr_1.15fr_0.85fr]">
            <SectionCard title="Project Details" action={editable ? editDialog(<button type="button" className={cn("text-xs hover:underline", accent)}>Edit</button>) : undefined}>
              <KeyValue labelWidth={100} rows={[
                ["Client", pr.client?.name],
                ["Company", <span key="c" className="flex items-center gap-1.5"><CompanyBadge code={pr.template} />{pr.company.name} ({pr.company.code})</span>],
                ["Project Type", pr.typeLabel],
                ["Start Date", formatDate(pr.startDate)],
                ["Due Date", dueText ?? "–"],
                ["Status", <EnumPill key="s" map={PROJECT_STATUS} value={pr.status} />],
                ["Priority", <EnumPill key="p" map={PRIORITY} value={pr.priority} />],
                ["Project Value", <span key="v" className="font-bold">{formatINR(pr.value)}</span>],
                ["Billing Type", BILLING_LABELS[pr.billingType]],
                ["Team Members", <AvatarStack key="m" people={pr.members.map((m) => m.user)} size={28} />],
              ]} />
            </SectionCard>
            <SectionCard title="Project Description">
              <p className="text-xs leading-5 text-ink-2">{pr.description}</p>
              <h3 className="mt-4 mb-1 text-md font-bold text-ink">{vth ? "Key Deliverables" : "Deliverables"}</h3>
              {pr.deliverables.map((d) => {
                const isCount = d.targetCount !== null;
                const pct = isCount ? ((d.completedCount ?? 0) / (d.targetCount || 1)) * 100 : (d.percent ?? 0);
                return (
                  <CheckRow key={d.id} done={isCount || pct > 0} label={d.title} right={
                    <span className="flex items-center gap-2">
                      <span className="w-10 text-right text-2xs text-ink-2 tabular">{isCount ? `${d.completedCount} / ${d.targetCount}` : `${pct}%`}</span>
                      <span className="w-16"><ProgressBar value={pct} tone={vth && pct >= 60 ? "success" : "primary"} /></span>
                      {editable && (isCount ? <DeliverableStepper id={d.id} value={d.completedCount ?? 0} max={d.targetCount!} /> : <PercentInput id={d.id} value={d.percent ?? 0} />)}
                    </span>
                  } />
                );
              })}
            </SectionCard>
            <SectionCard title="Client Contact" action={pr.client ? <Link href={`/clients/${pr.clientId}`} className={cn("text-xs", accent)}>View Client →</Link> : undefined}>
              {primary ? (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-3"><Avatar person={primary} size={40} /><div><p className="text-sm font-semibold text-ink">{primary.name}</p><p className="text-ink-muted">{primary.title}</p></div></div>
                  {primary.email && <p className="flex items-center gap-2"><Mail className="size-3.5 text-ink-muted" /><a href={`mailto:${primary.email}`} className={vth ? accent : "text-ink-2"}>{primary.email}</a></p>}
                  {primary.phone && <p className="flex items-center gap-2"><Phone className="size-3.5 text-ink-muted" />{primary.phone}</p>}
                  {primary.location && <p className="flex items-center gap-2"><Clock className="size-3.5 text-ink-muted" />{primary.location}</p>}
                  <div className="flex gap-2">
                    {primary.email && <a href={`mailto:${primary.email}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5"><Mail className="size-3.5" />Email</a>}
                    {primary.phone && <a href={`tel:${primary.phone.replace(/\s/g, "")}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5"><Phone className="size-3.5" />Call</a>}
                    <Link href={`?${new URLSearchParams({ ...strParams(sp), tab: "notes" })}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5"><MessageSquare className="size-3.5" />Message</Link>
                  </div>
                  {others.length > 0 && <p className="pt-1 text-sm font-semibold text-ink">Additional Contacts</p>}
                  {others.map((c) => (
                    <div key={c.id} className="flex items-center gap-3"><Avatar person={c} size={32} /><div><p className="font-semibold text-ink">{c.name}</p><p className="text-ink-muted">{c.title}</p>{c.email && <a href={`mailto:${c.email}`} className={cn("flex items-center gap-1", accent)}><Mail className="size-3" />{c.email}</a>}</div></div>
                  ))}
                </div>
              ) : <EmptyState title="No contact yet" />}
            </SectionCard>
          </div>

          <div className="grid gap-3.5 xl:grid-cols-3">
            {vth ? (
              <SectionCard title={`Milestones (${pr.milestones.filter((m) => m.status === "COMPLETED").length}/${pr.milestones.length} completed)`} icon={Target} tone="purple" href={`?${new URLSearchParams({ ...strParams(sp), tab: "milestones" })}`}>
                {pr.milestones.map((m, i) => (
                  <CheckRow key={m.id} round done={m.status === "COMPLETED"} label={`${i + 1}. ${m.title}`} right={<span className="flex items-center gap-2"><span className="w-12 text-2xs text-ink-2">{formatShortDate(m.dueDate)}</span><EnumPill map={MILESTONE_STATUS} value={m.status} size="xs" /></span>} />
                ))}
              </SectionCard>
            ) : (
              <SectionCard title={`Tasks (${doneCount}/${taskCount} completed)`} icon={FileCheck} tone="purple" href={`?${new URLSearchParams({ ...strParams(sp), tab: "tasks" })}`}>{taskTable}</SectionCard>
            )}
            {vth ? <SectionCard title={`Tasks (${taskCount} total)`} icon={FileCheck} tone="green" href={`?${new URLSearchParams({ ...strParams(sp), tab: "tasks" })}`}>{taskTable}</SectionCard> : <SectionCard title="Recent Files" icon={FileText} tone="blue" href={`?${new URLSearchParams({ ...strParams(sp), tab: "files" })}`}>{fileList}</SectionCard>}
            {vth ? <SectionCard title="Recent Files" icon={FileText} tone="blue" href={`?${new URLSearchParams({ ...strParams(sp), tab: "files" })}`}>{fileList}</SectionCard> : (
              <SectionCard title="Client Approvals" icon={FolderOpen} tone="orange" href={`?${new URLSearchParams({ ...strParams(sp), tab: "access" })}`}>
                {pr.approvals.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 py-1.5">
                    <span className="inline-flex size-9 items-center justify-center rounded-md bg-surface-muted text-2xs font-bold text-ink-2">{a.title.slice(0, 2)}</span>
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-ink">{a.title}</p><p className="text-2xs text-ink-muted">{a.status === "PENDING" ? "Pending approval" : a.status === "APPROVED" ? `Approved on ${formatShortDate(a.respondedAt!)}` : `Changes requested on ${formatShortDate(a.respondedAt!)}`}</p></div>
                    <EnumPill map={APPROVAL_STATUS} value={a.status} dot={false} />
                  </div>
                ))}
                {pr.approvals.length === 0 && <EmptyState title="Nothing sent for approval" />}
              </SectionCard>
            )}
          </div>

          <div className={cn("grid gap-3.5", vth ? "xl:grid-cols-[1.75fr_1fr]" : "xl:grid-cols-3")}>
            <SectionCard title="Project Timeline" icon={Target} tone="purple"><div className="pt-3"><Timeline points={timeline} doneColor={vth ? "var(--vth)" : "var(--vmh)"} /></div></SectionCard>
            {vth ? (
              <SectionCard title="Time Tracking" icon={Clock} tone="green" href={`?${new URLSearchParams({ ...strParams(sp), tab: "time" })}`}>
                <div className="grid grid-cols-3 text-xs">
                  <div><p className="text-ink-muted">Total Hours</p><p className="text-xl font-bold text-ink">{formatDuration(billable + nonBillable)}</p></div>
                  <div><p className="text-ink-muted">Billable Hours</p><p className="text-xl font-bold text-ink">{formatDuration(billable)}</p></div>
                  <div><p className="text-ink-muted">Non-Billable</p><p className="text-xl font-bold text-ink">{formatDuration(nonBillable)}</p></div>
                </div>
                <div className="mt-4 flex items-center gap-3"><ProgressBar value={billable + nonBillable ? (billable / (billable + nonBillable)) * 100 : 0} tone="success" height={8} /><span className="text-xs font-semibold">{billable + nonBillable ? Math.round((billable / (billable + nonBillable)) * 100) : 0}%</span></div>
              </SectionCard>
            ) : (
              <>
                <SectionCard title="Invoices" icon={Receipt} tone="blue" href={`?${new URLSearchParams({ ...strParams(sp), tab: "invoices" })}`}>{invoiceTable}</SectionCard>
                <SectionCard title="Notes" icon={MessageSquare} tone="purple" href={`?${new URLSearchParams({ ...strParams(sp), tab: "notes" })}`}>{noteList}</SectionCard>
              </>
            )}
          </div>
        </>
      )}

      {tab === "tasks" && (
        <Card className="p-4">
          {/* Created here with this project already set, so it shows up on the Tasks board too. */}
          {editable && (
            <div className="mb-3 flex justify-end">
              <NewTaskDialog companies={[pr.companyId as "vmh"]} projects={[{ id: pr.id, name: pr.name, companyId: pr.companyId }]} people={people} />
            </div>
          )}
          {taskTable}
        </Card>
      )}
      {tab === "milestones" && (
        <Card className="p-4">
          {pr.milestones.map((m, i) => <CheckRow key={m.id} round done={m.status === "COMPLETED"} label={`${i + 1}. ${m.title}`} right={<span className="flex items-center gap-3"><span className="text-2xs text-ink-2">{formatDate(m.dueDate)}</span><EnumPill map={MILESTONE_STATUS} value={m.status} size="xs" />{editable && <MilestoneToggle id={m.id} status={m.status} />}</span>} />)}
        </Card>
      )}
      {tab === "files" && <Card className="p-4">{fileList}</Card>}
      {tab === "invoices" && <Card className="p-4">{invoiceTable}</Card>}
      {tab === "notes" && <Card className="p-4">{noteList}</Card>}
      {tab === "time" && (
        <Card className="space-y-2 p-4 text-sm">
          <p>Total <b>{formatDuration(billable + nonBillable)}</b> · Billable <b>{formatDuration(billable)}</b> · Non-billable <b>{formatDuration(nonBillable)}</b></p>
          {pr.retainerHours && <p>Retainer: {pr.retainerHours}h per month</p>}
          <Link href={`/time?project=${pr.id}`} className="text-brand-text hover:underline">Open in timesheet →</Link>
        </Card>
      )}
      {tab === "activity" && <Card className="p-4">{activity.map((a) => <ActivityRow key={a.id} person={a.actor ?? undefined} text={a.summary} time={formatRelative(a.createdAt, t)} />)}{activity.length === 0 && <EmptyState title="No activity yet" />}</Card>}
      {tab === "access" && (
        <div className="grid gap-3.5 xl:grid-cols-2">
          <SectionCard title="Client portal access">
            <p className="mb-3 text-xs text-ink-muted">A contact sees a project only once it is shared with them. Sharing this one shows them its files, invoices and deliverables to approve, and nothing else.</p>
            <ul className="space-y-3">
              {pr.client?.contacts.map((c) => (
                <li key={c.id} className="flex items-center gap-3"><Avatar person={c} size={32} /><div className="min-w-0 flex-1 text-xs"><p className="font-semibold text-ink">{c.name}</p><p className="text-ink-muted">{c.email ?? "No email"}</p></div>{editable && <PortalAccessButton contactId={c.id} projectId={pr.id} active={c.portalAccess} shared={c.projects.length > 0} />}</li>
              ))}
            </ul>
          </SectionCard>
          <SectionCard title="Approvals">
            {editable && <RequestApproval projectId={pr.id} files={files.map((f) => ({ id: f.id, name: f.name }))} />}
            <ul className="mt-3 divide-y">
              {pr.approvals.map((a) => <li key={a.id} className="flex items-center gap-3 py-2 text-xs"><span className="flex-1 font-medium text-ink">{a.title}</span><span className="text-ink-muted">{formatShortDate(a.requestedAt)}</span><EnumPill map={APPROVAL_STATUS} value={a.status} dot={false} size="xs" /></li>)}
            </ul>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

