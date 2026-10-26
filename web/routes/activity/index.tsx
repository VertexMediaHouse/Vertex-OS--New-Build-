// Ported from app/(app)/activity/page.tsx.
import { useQuery } from "@tanstack/react-query";
import { ActivityRow } from "@/components/shared/display";
import { CardSkeleton, EmptyState, PageHeader } from "@/components/shared/layout";
import { CompanyBadge, companyCode } from "@/components/shared/pills";
import { Card } from "@/components/shared/primitives";
import { now } from "@/lib/clock";
import { formatDateTime, formatRelative } from "@/lib/format";
import { api, query } from "@/web/api";
import { useTitle } from "@/web/title";

/** Everything that happened, newest first: the audit trail behind the "Recent Activity" widgets. */
export default function ActivityPage() {
  useTitle("Activity");
  const { data } = useQuery({ queryKey: ["activity"], queryFn: () => query(api.api.activity.$get()) });
  if (!data) return <CardSkeleton className="h-96" />;
  const t = now();
  return (
    <div className="space-y-3.5">
      <PageHeader title="Activity" subtitle="Every create, update, status change and payment, across the selected companies." />
      <Card className="p-4">
        {data.items.length === 0 && <EmptyState title="No activity yet" />}
        {data.items.map((a) => <ActivityRow key={a.id} person={a.actor ?? undefined} text={a.summary} time={`${formatRelative(new Date(a.createdAt), t)} · ${formatDateTime(new Date(a.createdAt))}`} right={<CompanyBadge code={companyCode(a.companyId)} />} />)}
      </Card>
    </div>
  );
}
