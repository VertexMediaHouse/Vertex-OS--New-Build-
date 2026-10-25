import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getStaffUser } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { now } from "@/lib/clock";
import { formatRelative } from "@/lib/format";
import { Card } from "@/components/shared/primitives";
import { CardSkeleton, EmptyState, PageHeader } from "@/components/shared/layout";
import { MarkAllRead } from "./mark-all-read";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return <Suspense fallback={<CardSkeleton className="h-96" />}><Notifications /></Suspense>;
}

async function Notifications() {
  const user = await getStaffUser();
  const list = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const t = now();
  return (
    <div className="space-y-3.5">
      <PageHeader title="Notifications" subtitle="Assignments, mentions, approvals, payments and alerts." actions={list.some((n) => !n.readAt) && <MarkAllRead />} />
      <Card className="divide-y">
        {list.length === 0 && <EmptyState title="You're all caught up" />}
        {list.map((n) => (
          <Link key={n.id} href={n.link ?? "#"} className="flex items-start gap-3 p-4 hover:bg-accent">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "" : "bg-brand-strong"}`} aria-label={n.readAt ? undefined : "Unread"} />
            <span className="flex-1"><span className={`block text-sm ${n.readAt ? "text-ink-2" : "font-semibold text-ink"}`}>{n.title}</span>{n.body && <span className="block text-xs text-ink-muted">{n.body}</span>}</span>
            <span className="text-2xs text-ink-muted">{formatRelative(n.createdAt, t)}</span>
          </Link>
        ))}
      </Card>
    </div>
  );
}
