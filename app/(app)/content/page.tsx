import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarCheck, Clapperboard, Lightbulb, Send } from "lucide-react";
import { getRequestContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db, type Prisma } from "@/lib/db";
import { addDays, now, startOfDayIST } from "@/lib/clock";
import { formatShortDate } from "@/lib/format";
import { dayKey } from "@/lib/period";
import { readParams, subScope, type SP } from "@/lib/search-params";
import { KpiCard } from "@/components/shared/kpi-card";
import { CardSkeleton, PageHeader } from "@/components/shared/layout";
import { FilterSelect, SearchInput } from "@/components/shared/filters";
import { companyCode } from "@/components/shared/pills";
import { ContentBoard, ContentDialog, type ContentCard } from "@/components/content/content-client";
import { CHANNELS } from "@/lib/content";

export const metadata: Metadata = { title: "Content" };

export default function ContentPage({ searchParams }: PageProps<"/content">) {
  return <Suspense fallback={<CardSkeleton className="h-96" />}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  const [ctx, sp] = await Promise.all([getRequestContext(), searchParams]);
  if (!can(ctx.user, "view", "content")) return <p className="p-6 text-sm text-ink-2">You don&apos;t have access to content.</p>;
  const p = readParams(sp);
  const q = p.str("q");
  const t = now();
  const today = startOfDayIST(t);
  const where: Prisma.ContentItemWhereInput = {
    companyId: { in: subScope(ctx.companyIds, p.str("co")) },
    ...(p.str("channel") && { channel: p.str("channel") as "YOUTUBE" }),
    ...(p.str("owner") && { ownerId: p.str("owner")! }),
    ...(q && { OR: [{ title: { contains: q, mode: "insensitive" } }, { hook: { contains: q, mode: "insensitive" } }] }),
  };
  const [rows, people, ideas, shooting, scheduled, publishedMonth] = await Promise.all([
    db.contentItem.findMany({ where, orderBy: [{ position: "asc" }], include: { owner: { select: { name: true, image: true } } } }),
    db.user.findMany({ where: { kind: "STAFF", memberships: { some: { companyId: { in: ctx.companyIds } } } }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    db.contentItem.count({ where: { companyId: { in: ctx.companyIds }, stage: "IDEA" } }),
    db.contentItem.count({ where: { companyId: { in: ctx.companyIds }, shootDate: { gte: today, lt: addDays(today, 8) } } }),
    db.contentItem.count({ where: { companyId: { in: ctx.companyIds }, stage: "SCHEDULED" } }),
    db.contentItem.count({ where: { companyId: { in: ctx.companyIds }, stage: "PUBLISHED", publishedAt: { gte: addDays(today, -30) } } }),
  ]);

  const board: Record<string, ContentCard[]> = { IDEA: [], SCRIPTING: [], FILMING: [], EDITING: [], SCHEDULED: [], PUBLISHED: [] };
  for (const c of rows) {
    board[c.stage]!.push({
      id: c.id,
      title: c.title,
      co: companyCode(c.companyId),
      companyId: c.companyId,
      channel: c.channel,
      stage: c.stage,
      hook: c.hook,
      owner: c.owner,
      ownerId: c.ownerId,
      shootDate: c.shootDate ? dayKey(c.shootDate) : null,
      publishDate: c.publishDate ? dayKey(c.publishDate) : null,
      shootLabel: c.shootDate ? formatShortDate(c.shootDate) : null,
      publishLabel: c.publishDate ? formatShortDate(c.publishDate) : null,
      notes: c.notes,
      link: c.link,
    });
  }
  const companies = ctx.companyIds.filter((c): c is "vmh" | "vth" => can(ctx.user, "create", "content", c));

  return (
    <div className="space-y-3.5">
      <PageHeader
        title="Content"
        subtitle="Every idea from first thought to published, so a busy week still goes out."
        actions={companies.length > 0 && <ContentDialog companies={companies} people={people} />}
      />
      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Lightbulb} tone="amber" label="Ideas waiting" value={ideas} />
        <KpiCard icon={Clapperboard} tone="orange" label="Shooting" suffix="(next 7 days)" value={shooting} />
        <KpiCard icon={CalendarCheck} tone="blue" label="Scheduled" value={scheduled} />
        <KpiCard icon={Send} tone="green" label="Published" suffix="(last 30 days)" value={publishedMonth} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search content..." className="w-64" />
        {ctx.scope === "ALL" && <FilterSelect param="co" placeholder="All Companies" options={[{ value: "vmh", label: "VMH" }, { value: "vth", label: "VTH" }]} />}
        <FilterSelect param="channel" placeholder="All Channels" options={CHANNELS.map(([value, label]) => ({ value, label }))} />
        <FilterSelect param="owner" placeholder="All Owners" options={people.map((x) => ({ value: x.id, label: x.name }))} />
      </div>
      <ContentBoard items={board} companies={companies} people={people} />
    </div>
  );
}
