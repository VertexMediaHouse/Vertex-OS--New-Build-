// Ported from app/(app)/notifications/{page.tsx,mark-all-read.tsx}.
import { useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CardSkeleton, EmptyState, PageHeader } from "@/components/shared/layout";
import { Card } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { now } from "@/lib/clock";
import { formatRelative } from "@/lib/format";
import { api, call, query } from "@/web/api";
import { useTitle } from "@/web/title";

function MarkAllRead() {
  const [pending, start] = useTransition();
  const queryClient = useQueryClient();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => start(async () => {
        await call(api.api.notifications["read-all"].$post());
        await queryClient.invalidateQueries();
      })}
    >
      Mark all read
    </Button>
  );
}

export default function NotificationsPage() {
  useTitle("Notifications");
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => query(api.api.notifications.$get()) });
  if (!data) return <CardSkeleton className="h-96" />;
  const t = now();
  return (
    <div className="space-y-3.5">
      <PageHeader title="Notifications" subtitle="Assignments, mentions, approvals, payments and alerts." actions={data.list.some((n) => !n.readAt) && <MarkAllRead />} />
      <Card className="divide-y">
        {data.list.length === 0 && <EmptyState title="You're all caught up" />}
        {data.list.map((n) => (
          <Link key={n.id} href={n.link ?? "#"} className="flex items-start gap-3 p-4 hover:bg-accent">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "" : "bg-brand-strong"}`} aria-label={n.readAt ? undefined : "Unread"} />
            <span className="flex-1"><span className={`block text-sm ${n.readAt ? "text-ink-2" : "font-semibold text-ink"}`}>{n.title}</span>{n.body && <span className="block text-xs text-ink-muted">{n.body}</span>}</span>
            <span className="text-2xs text-ink-muted">{formatRelative(new Date(n.createdAt), t)}</span>
          </Link>
        ))}
      </Card>
    </div>
  );
}
