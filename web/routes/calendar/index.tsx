// Ported from app/(app)/calendar/page.tsx: the Prisma query moved to the server route,
// the rest of the render is unchanged.
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "@/lib/nav";
import { CardSkeleton, PageHeader } from "@/components/shared/layout";
import { CompanyBadge, companyCode } from "@/components/shared/pills";
import { Card } from "@/components/shared/primitives";
import Link from "@/components/ui/link";
import { addDays, now, startOfDayIST } from "@/lib/clock";
import { formatLongDate, formatTimePadded } from "@/lib/format";
import { dayKey, parseDay } from "@/lib/period";
import { api, query } from "@/web/api";
import { useTitle } from "@/web/title";
import { EventForm } from "./event-form";

export default function CalendarPage() {
  useTitle("Calendar");
  const [params] = useSearchParams();
  const weekParam = params.get("week") ?? undefined;
  const { data } = useQuery({
    queryKey: ["calendar", weekParam ?? ""],
    queryFn: () => query(api.api.calendar.$get({ query: { week: weekParam } })),
  });

  if (!data) return <CardSkeleton className="h-96" />;

  const week = parseDay(data.week)!;
  const today = dayKey(startOfDayIST(now()));
  return (
    <div className="space-y-3.5">
      <PageHeader title="Calendar" subtitle="Calls, reviews, follow-ups and team meetings. Today's items show on the dashboard agenda." actions={<EventForm clients={data.clients} companies={data.companies} />} />
      <div className="flex items-center gap-3 text-sm">
        <Link href={`?week=${dayKey(addDays(week, -7))}`} className="text-brand-text">‹ Previous</Link>
        <Link href="/calendar" className="text-brand-text">This week</Link>
        <Link href={`?week=${dayKey(addDays(week, 7))}`} className="text-brand-text">Next ›</Link>
      </div>
      <div className="grid gap-3 md:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(week, i);
          const items = data.events.filter((e) => dayKey(new Date(e.start)) === dayKey(d));
          return (
            <Card key={i} className={`min-h-48 p-3 ${dayKey(d) === today ? "ring-2 ring-brand/40" : ""}`}>
              <p className="mb-2 text-xs font-semibold text-ink">{formatLongDate(d).split(" ").slice(0, 3).join(" ")}</p>
              {items.map((e) => (
                <div key={e.id} className="mb-2 rounded-lg bg-surface-muted p-2 text-2xs">
                  <p className="flex justify-between"><span className="text-ink-muted">{formatTimePadded(new Date(e.start))}</span><CompanyBadge code={companyCode(e.companyId)} /></p>
                  <p className="font-semibold text-ink">{e.title}</p>
                  {(e.client || e.project) && <p className="text-ink-muted">{e.client?.name ?? e.project?.name}</p>}
                </div>
              ))}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
