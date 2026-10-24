import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getRequestContext } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { addDays, now, startOfDayIST, startOfWeekIST } from "@/lib/clock";
import { formatLongDate, formatTimePadded } from "@/lib/format";
import { dayKey, parseDay } from "@/lib/period";
import { readParams, type SP } from "@/lib/search-params";
import { Card } from "@/components/shared/primitives";
import { CardSkeleton, PageHeader } from "@/components/shared/layout";
import { CompanyBadge, companyCode } from "@/components/shared/pills";
import { EventForm } from "./event-form";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return <Suspense fallback={<CardSkeleton className="h-96" />}><Calendar searchParams={searchParams} /></Suspense>;
}

async function Calendar({ searchParams }: { searchParams: Promise<SP> }) {
  const [ctx, sp] = await Promise.all([getRequestContext(), searchParams]);
  const p = readParams(sp);
  const week = startOfWeekIST(parseDay(p.str("week")) ?? now());
  const [events, clients] = await Promise.all([
    db.calendarEvent.findMany({ where: { OR: [{ companyId: { in: ctx.companyIds } }, { companyId: null }], start: { gte: week, lt: addDays(week, 7) } }, orderBy: { start: "asc" }, include: { client: { select: { name: true } }, project: { select: { name: true } } } }),
    db.client.findMany({ where: { archivedAt: null, companies: { some: { companyId: { in: ctx.companyIds } } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const today = dayKey(startOfDayIST(now()));
  return (
    <div className="space-y-3.5">
      <PageHeader title="Calendar" subtitle="Calls, reviews, follow-ups and team meetings. Today's items show on the dashboard agenda." actions={<EventForm clients={clients} companies={ctx.companyIds} />} />
      <div className="flex items-center gap-3 text-sm">
        <Link href={`?week=${dayKey(addDays(week, -7))}`} className="text-blue">‹ Previous</Link>
        <Link href="/calendar" className="text-blue">This week</Link>
        <Link href={`?week=${dayKey(addDays(week, 7))}`} className="text-blue">Next ›</Link>
      </div>
      <div className="grid gap-3 md:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(week, i);
          const items = events.filter((e) => dayKey(e.start) === dayKey(d));
          return (
            <Card key={i} className={`min-h-48 p-3 ${dayKey(d) === today ? "ring-2 ring-blue/40" : ""}`}>
              <p className="mb-2 text-xs font-semibold text-ink">{formatLongDate(d).split(" ").slice(0, 3).join(" ")}</p>
              {items.map((e) => (
                <div key={e.id} className="mb-2 rounded-lg bg-surface-muted p-2 text-2xs">
                  <p className="flex justify-between"><span className="text-ink-muted">{formatTimePadded(e.start)}</span><CompanyBadge code={companyCode(e.companyId)} /></p>
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
