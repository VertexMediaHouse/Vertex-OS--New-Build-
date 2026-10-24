import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getRequestContext } from "@/lib/auth/context";
import { can, roleLabel } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import * as M from "@/lib/metrics/dashboard";
import { formatDuration } from "@/lib/format";
import { workloadState } from "@/lib/metrics/workload";
import { Card, ProgressBar, Avatar } from "@/components/shared/primitives";
import { CardSkeleton, PageHeader } from "@/components/shared/layout";
import { Chip, CompanyBadges } from "@/components/shared/pills";
import { InviteDialog } from "@/components/team/team-client";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return <Suspense fallback={<CardSkeleton className="h-96" />}><Team /></Suspense>;
}

async function Team() {
  const ctx = await getRequestContext();
  const [workload, users, tasks] = await Promise.all([
    M.teamWorkload(ctx),
    db.user.findMany({ where: { kind: "STAFF", memberships: { some: { companyId: { in: ctx.companyIds } } } }, include: { memberships: true }, orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }] }),
    db.task.groupBy({ by: ["assigneeId"], _count: true, where: { companyId: { in: ctx.companyIds }, status: { not: "COMPLETED" } } }),
  ]);
  const invitable = ctx.companyIds.filter((c) => can(ctx.user, "create", "team", c));
  return (
    <div className="space-y-3.5">
      <PageHeader title="Team" subtitle="Who works on what, and how full everyone's week is." actions={invitable.length > 0 && <InviteDialog companies={invitable} />} />
      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {users.map((u) => {
          const w = workload.find((x) => x.id === u.id);
          const st = w ? workloadState(w.pct) : "ok";
          return (
            <Link key={u.id} href={`/team/${u.id}`}>
              <Card className="p-4 hover:bg-[#F8FAFC]">
                <div className="flex items-center gap-3">
                  <Avatar person={u} size={44} />
                  <div className="min-w-0 flex-1"><p className="font-semibold text-ink">{u.name}{!u.active && <span className="ml-2 text-2xs text-danger-text">inactive</span>}</p><p className="text-xs text-ink-muted">{roleLabel({ ...u, memberships: u.memberships.map((m) => ({ companyId: m.companyId, role: m.role })), kind: "STAFF" })}</p></div>
                  <CompanyBadges codes={u.memberships.map((m) => (m.companyId === "vmh" ? "VMH" : "VTH") as "VMH").sort()} />
                </div>
                {w && (
                  <div className="mt-4 space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-ink-muted">This week</span><span>{formatDuration(w.loggedMin)} of {u.weeklyCapacityHours}h</span></div>
                    <div className="flex items-center gap-2"><ProgressBar value={w.pct} tone={st === "over" ? "danger" : st === "idle" ? "warning" : "success"} /><span className="w-10 text-right font-semibold">{Math.round(w.pct)}%</span>{st === "over" && <Chip tone="danger">Over</Chip>}{st === "idle" && <Chip tone="warning">Idle</Chip>}</div>
                  </div>
                )}
                <p className="mt-3 text-xs text-ink-2">{tasks.find((t) => t.assigneeId === u.id)?._count ?? 0} open tasks</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
