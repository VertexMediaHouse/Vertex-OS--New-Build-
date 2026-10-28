// Ported from app/(app)/team/[id]/page.tsx.
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { ActivityRow } from "@/components/shared/display";
import { CardSkeleton, EmptyState } from "@/components/shared/layout";
import { CompanyBadges, EnumPill } from "@/components/shared/pills";
import { Avatar, Card, ProgressBar, SectionCard } from "@/components/shared/primitives";
import { EditMember } from "@/components/team/team-client";
import Link from "@/components/ui/link";
import { roleLabel } from "@/lib/auth/permissions";
import { now } from "@/lib/clock";
import { formatDate, formatDuration, formatRelative, formatShortDate } from "@/lib/format";
import { goalProgress } from "@/lib/metrics/goals";
import { GOAL_STATUS, TASK_STATUS } from "@/lib/status";
import { api, query } from "@/web/api";
import { useTitle } from "@/web/title";

export default function TeamMemberPage() {
  const { id = "" } = useParams();
  const { data } = useQuery({ queryKey: ["team", id], queryFn: () => query(api.api.team[":id"].$get({ param: { id } })) });
  useTitle(data?.user?.name ?? "Team");
  if (!data) return <CardSkeleton className="h-96" />;
  const u = data.user;
  const t = now();
  return (
    <div className="space-y-3.5">
      <p className="text-xs text-ink-muted"><Link href="/team" className="hover:underline">Team</Link> › {u.name}</p>
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <Avatar person={u} size={56} />
        <div className="flex-1"><h1 className="text-3xl font-bold text-ink">{u.name}</h1><p className="text-sm text-ink-muted">{roleLabel({ ...u, kind: "STAFF", memberships: u.memberships })} · {u.email}</p></div>
        <CompanyBadges codes={u.memberships.map((m: any) => (m.companyId === "vmh" ? "VMH" : "VTH") as "VMH").sort()} />
        <div className="text-right"><p className="text-xl font-bold">{formatDuration(data.weekMin)}</p><p className="text-2xs text-ink-muted">this week of {u.weeklyCapacityHours}h</p></div>
      </Card>
      <div className="grid gap-3.5 xl:grid-cols-3">
        <SectionCard title="Open tasks">{data.tasks.length === 0 && <EmptyState title="No open tasks" />}{data.tasks.map((tk) => <Link key={tk.id} href={`/tasks?id=${tk.id}`} className="flex items-center gap-2 border-b py-2 text-xs last:border-0"><span className="flex-1 truncate">{tk.title}<span className="block text-2xs text-ink-muted">{tk.project?.name}</span></span>{tk.dueDate && <span className="text-ink-muted">{formatShortDate(new Date(tk.dueDate))}</span>}<EnumPill map={TASK_STATUS} value={tk.status} size="xs" /></Link>)}</SectionCard>
        <SectionCard title="Recent time">{data.time.map((e) => <div key={e.id} className="flex justify-between border-b py-2 text-xs last:border-0"><span>{formatDate(new Date(e.start))} · {e.project?.name}</span><b>{formatDuration(e.durationMin ?? 0)}</b></div>)}</SectionCard>
        <SectionCard title="Goals">{data.goals.map((g) => <div key={g.id} className="py-2 text-xs"><div className="flex justify-between"><span>{g.title}</span><EnumPill map={GOAL_STATUS} value={g.status} size="xs" /></div><ProgressBar value={goalProgress(g)} className="mt-1" /></div>)}{data.goals.length === 0 && <EmptyState title="No goals" />}</SectionCard>
        <SectionCard title="Activity">{data.activity.map((a) => <ActivityRow key={a.id} text={a.summary} time={formatRelative(new Date(a.createdAt), t)} />)}</SectionCard>
        {data.editable && <SectionCard title="Access & capacity"><EditMember userId={u.id} title={u.title ?? ""} capacity={u.weeklyCapacityHours} active={u.active} memberships={u.memberships.map((m: any) => ({ companyId: m.companyId, role: m.role }))} companies={data.companyIds} /></SectionCard>}
      </div>
    </div>
  );
}
