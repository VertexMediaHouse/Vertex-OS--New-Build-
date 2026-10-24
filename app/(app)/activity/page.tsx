import { Suspense } from "react";
import type { Metadata } from "next";
import { getRequestContext } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { scopedSharedWhere } from "@/lib/db/scope";
import { now } from "@/lib/clock";
import { formatDateTime, formatRelative } from "@/lib/format";
import { Card } from "@/components/shared/primitives";
import { CardSkeleton, EmptyState, PageHeader } from "@/components/shared/layout";
import { CompanyBadge, companyCode } from "@/components/shared/pills";
import { ActivityRow } from "@/components/shared/display";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return <Suspense fallback={<CardSkeleton className="h-96" />}><Activity /></Suspense>;
}

/** Everything that happened, newest first: the audit trail behind the "Recent Activity" widgets. */
async function Activity() {
  const ctx = await getRequestContext();
  const items = await db.activity.findMany({ where: scopedSharedWhere(ctx), orderBy: { createdAt: "desc" }, take: 150, include: { actor: { select: { name: true, image: true } } } });
  const t = now();
  return (
    <div className="space-y-3.5">
      <PageHeader title="Activity" subtitle="Every create, update, status change and payment, across the selected companies." />
      <Card className="p-4">
        {items.length === 0 && <EmptyState title="No activity yet" />}
        {items.map((a) => <ActivityRow key={a.id} person={a.actor ?? undefined} text={a.summary} time={`${formatRelative(a.createdAt, t)} · ${formatDateTime(a.createdAt)}`} right={<CompanyBadge code={companyCode(a.companyId)} />} />)}
      </Card>
    </div>
  );
}
