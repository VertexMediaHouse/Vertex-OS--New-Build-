// Ported from app/(app)/team/page.tsx.
import { useQuery } from "@tanstack/react-query";
import { CardSkeleton, PageHeader } from "@/components/shared/layout";
import { Chip, CompanyBadges } from "@/components/shared/pills";
import { Avatar, Card, ProgressBar } from "@/components/shared/primitives";
import { InviteDialog } from "@/components/team/team-client";
import Link from "@/components/ui/link";
import { roleLabel } from "@/lib/auth/permissions";
import { formatDuration } from "@/lib/format";
import { workloadState } from "@/lib/metrics/workload";
import { api, query } from "@/web/api";
import { useTitle } from "@/web/title";

export default function TeamPage() {
  useTitle("Team");
  const { data } = useQuery({ queryKey: ["team"], queryFn: () => query(api.api.team.$get()) });
  if (!data) return <CardSkeleton className="h-96" />;
  if (!data.allowed) return <p className="p-6 text-sm text-ink-2">You don&apos;t have access to the team.</p>;

  return (
    <div className="space-y-3.5">
      <PageHeader title="Team" subtitle="Who works on what, and how full everyone's week is." actions={data.invitable.length > 0 && <InviteDialog companies={data.invitable} />} />
      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {data.users.map((u) => {
          const w = data.workload.find((x) => x.id === u.id);
          const st = w ? workloadState(w.pct) : "ok";
          return (
            <Link key={u.id} href={`/team/${u.id}`}>
              <Card className="p-4 hover:bg-accent">
                <div className="flex items-center gap-3">
                  <Avatar person={u} size={44} />
                  <div className="min-w-0 flex-1"><p className="font-semibold text-ink">{u.name}{!u.active && <span className="ml-2 text-2xs text-danger-text">inactive</span>}</p><p className="text-xs text-ink-muted">{roleLabel({ ...u, memberships: u.memberships, kind: "STAFF" })}</p></div>
                  <CompanyBadges codes={u.memberships.map((m: any) => (m.companyId === "vmh" ? "VMH" : "VTH") as "VMH").sort()} />
                </div>
                {w && (
                  <div className="mt-4 space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-ink-muted">This week</span><span>{formatDuration(w.loggedMin)} of {u.weeklyCapacityHours}h</span></div>
                    <div className="flex items-center gap-2"><ProgressBar value={w.pct} tone={st === "over" ? "danger" : st === "idle" ? "warning" : "success"} /><span className="w-10 text-right font-semibold">{Math.round(w.pct)}%</span>{st === "over" && <Chip tone="danger">Over</Chip>}{st === "idle" && <Chip tone="warning">Idle</Chip>}</div>
                  </div>
                )}
                <p className="mt-3 text-xs text-ink-2">{data.tasks.find((t) => t.assigneeId === u.id)?.count ?? 0} open tasks</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
