import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestContext } from "@/lib/auth/context";
import { can, roleLabel } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { addDays, now, startOfWeekIST } from "@/lib/clock";
import { formatDate, formatDuration, formatRelative, formatShortDate } from "@/lib/format";
import { GOAL_STATUS, TASK_STATUS } from "@/lib/status";
import { goalProgress } from "@/lib/metrics/goals";
import { Card, ProgressBar, SectionCard, Avatar } from "@/components/shared/primitives";
import { CardSkeleton, EmptyState } from "@/components/shared/layout";
import { CompanyBadges, EnumPill } from "@/components/shared/pills";
import { ActivityRow } from "@/components/shared/display";
import { EditMember } from "@/components/team/team-client";

export default function MemberPage({ params }: PageProps<"/team/[id]">) {
  return <Suspense fallback={<CardSkeleton className="h-96" />}><Member params={params} /></Suspense>;
}

async function Member({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, ctx] = await Promise.all([params, getRequestContext()]);
  const u = await db.user.findFirst({ where: { id, kind: "STAFF", memberships: { some: { companyId: { in: ctx.companyIds } } } }, include: { memberships: true } });
  if (!u) notFound();
  const t = now();
  const week = startOfWeekIST(t);
  const [tasks, time, goals, activity] = await Promise.all([
    db.task.findMany({ where: { assigneeId: id, status: { not: "COMPLETED" }, companyId: { in: ctx.companyIds } }, orderBy: { dueDate: "asc" }, take: 15, include: { project: { select: { name: true } } } }),
    db.timeEntry.findMany({ where: { userId: id, start: { gte: addDays(week, -21) }, companyId: { in: ctx.companyIds } }, orderBy: { start: "desc" }, take: 20, include: { project: { select: { name: true } } } }),
    db.goal.findMany({ where: { OR: [{ ownerId: id }, { members: { some: { userId: id } } }], endDate: { gte: addDays(t, -30) } } }),
    db.activity.findMany({ where: { actorId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const weekMin = time.filter((e) => e.start >= week).reduce((a, e) => a + (e.durationMin ?? 0), 0);
  const editable = !u.isOwner && u.memberships.every((m) => can(ctx.user, "update", "team", m.companyId));
  return (
    <div className="space-y-3.5">
      <p className="text-xs text-ink-muted"><Link href="/team" className="hover:underline">Team</Link> › {u.name}</p>
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <Avatar person={u} size={56} />
        <div className="flex-1"><h1 className="text-3xl font-bold text-ink">{u.name}</h1><p className="text-sm text-ink-muted">{roleLabel({ ...u, kind: "STAFF", memberships: u.memberships })} · {u.email}</p></div>
        <CompanyBadges codes={u.memberships.map((m) => (m.companyId === "vmh" ? "VMH" : "VTH") as "VMH").sort()} />
        <div className="text-right"><p className="text-xl font-bold">{formatDuration(weekMin)}</p><p className="text-2xs text-ink-muted">this week of {u.weeklyCapacityHours}h</p></div>
      </Card>
      <div className="grid gap-3.5 xl:grid-cols-3">
        <SectionCard title="Open tasks">{tasks.length === 0 && <EmptyState title="No open tasks" />}{tasks.map((tk) => <Link key={tk.id} href={`/tasks?id=${tk.id}`} className="flex items-center gap-2 border-b py-2 text-xs last:border-0"><span className="flex-1 truncate">{tk.title}<span className="block text-2xs text-ink-muted">{tk.project?.name}</span></span>{tk.dueDate && <span className="text-ink-muted">{formatShortDate(tk.dueDate)}</span>}<EnumPill map={TASK_STATUS} value={tk.status} size="xs" /></Link>)}</SectionCard>
        <SectionCard title="Recent time">{time.map((e) => <div key={e.id} className="flex justify-between border-b py-2 text-xs last:border-0"><span>{formatDate(e.start)} · {e.project?.name}</span><b>{formatDuration(e.durationMin ?? 0)}</b></div>)}</SectionCard>
        <SectionCard title="Goals">{goals.map((g) => <div key={g.id} className="py-2 text-xs"><div className="flex justify-between"><span>{g.title}</span><EnumPill map={GOAL_STATUS} value={g.status} size="xs" /></div><ProgressBar value={goalProgress(g)} className="mt-1" /></div>)}{goals.length === 0 && <EmptyState title="No goals" />}</SectionCard>
        <SectionCard title="Activity">{activity.map((a) => <ActivityRow key={a.id} text={a.summary} time={formatRelative(a.createdAt, t)} />)}</SectionCard>
        {editable && <SectionCard title="Access & capacity"><EditMember userId={u.id} title={u.title ?? ""} capacity={u.weeklyCapacityHours} active={u.active} memberships={u.memberships.map((m) => ({ companyId: m.companyId, role: m.role }))} companies={ctx.companyIds} /></SectionCard>}
      </div>
    </div>
  );
}
