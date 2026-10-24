import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarDays, Clock, Filter, Handshake, Users } from "lucide-react";
import { getRequestContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db, type Prisma } from "@/lib/db";
import { scopedWhere } from "@/lib/db/scope";
import { addDays, now } from "@/lib/clock";
import { formatDate, formatINR, formatRelative } from "@/lib/format";
import { pctChange } from "@/lib/period";
import { readParams, subScope, type SP } from "@/lib/search-params";
import { COMPANY_COLORS } from "@/lib/chart-colors";
import { LEAD_STAGE } from "@/lib/status";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, SectionCard, Avatar } from "@/components/shared/primitives";
import { CardSkeleton, KeyValue, PageHeader } from "@/components/shared/layout";
import { FilterTabs } from "@/components/shared/nav";
import { DateRangePicker, FilterSelect, SearchInput } from "@/components/shared/filters";
import { BarsChart, ChartLegend, DonutChart } from "@/components/shared/charts";
import { CompanyBadge, EnumPill, companyCode } from "@/components/shared/pills";
import { UrlSheet } from "@/components/shared/url-sheet";
import { ActivityRow } from "@/components/shared/display";
import { LeadBoard, type BoardLead } from "@/components/leads/lead-board";
import { LeadFormDialog, SOURCE_LABEL } from "@/components/leads/lead-form";
import { ConvertButtons } from "@/components/leads/convert-buttons";
import Link from "next/link";

export const metadata: Metadata = { title: "Leads" };

export default function LeadsPage({ searchParams }: PageProps<"/leads">) {
  return (
    <Suspense fallback={<CardSkeleton className="h-96" />}>
      <Leads searchParams={searchParams} />
    </Suspense>
  );
}


async function Leads({ searchParams }: { searchParams: Promise<SP> }) {
  const [ctx, sp] = await Promise.all([getRequestContext(), searchParams]);
  const p = readParams(sp);
  if (!can(ctx.user, "view", "lead")) return <p className="p-6 text-sm">You don&apos;t have access to leads.</p>;
  const t = now();
  const companyIds = subScope(ctx.companyIds, p.str("co"));
  const scope = { companyIds: ctx.companyIds };
  const q = p.str("q");
  const where: Prisma.LeadWhereInput = {
    companyId: { in: companyIds },
    ...(p.str("source") && { source: p.str("source") as Prisma.LeadWhereInput["source"] }),
    ...(p.str("owner") && { ownerId: p.str("owner")! }),
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { service: { contains: q, mode: "insensitive" } }] }),
    createdAt: { lt: p.period.to },
  };
  const inPeriod = { gte: p.period.from, lt: p.period.to };
  const prev = { gte: p.period.prevFrom, lt: p.period.prevTo };
  const all = { ...scopedWhere(scope), stage: { not: "LOST" as const } };

  const [leads, counts, owners, kpi] = await Promise.all([
    // Closed leads drop off the board after 30 days, so it doesn't grow without end.
    db.lead.findMany({
      where: {
        ...where,
        stage: p.str("lost") ? undefined : { not: "LOST" },
        // AND, because `where` already uses OR for the search box.
        AND: [{ OR: [{ stage: { notIn: ["WON", "LOST"] } }, { lastActivityAt: { gte: addDays(t, -30) } }] }],
      },
      orderBy: [{ position: "asc" }],
      include: { owner: { select: { name: true } } },
    }),
    db.lead.groupBy({ by: ["companyId"], _count: true, where: all }),
    db.user.findMany({ where: { kind: "STAFF", memberships: { some: { companyId: { in: ctx.companyIds } } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    Promise.all([
      db.lead.groupBy({ by: ["companyId"], _count: true, _sum: { value: true }, where: all }),
      db.lead.groupBy({ by: ["companyId"], _sum: { value: true }, where: { ...scopedWhere(scope), stage: { in: ["NEW", "CONTACTED", "PROPOSAL", "NEGOTIATION"] } } }),
      db.lead.groupBy({ by: ["companyId"], _count: true, where: { ...all, createdAt: inPeriod } }),
      db.lead.count({ where: { ...all, createdAt: prev } }),
      db.lead.groupBy({ by: ["companyId"], _count: true, where: { ...scopedWhere(scope), stage: "WON", wonAt: inPeriod } }),
      db.lead.count({ where: { ...scopedWhere(scope), stage: "WON", wonAt: prev } }),
      db.lead.groupBy({ by: ["companyId"], _count: true, where: { ...scopedWhere(scope), stage: "LOST", lostAt: inPeriod } }),
      db.lead.groupBy({ by: ["companyId"], _count: true, where: { ...scopedWhere(scope), stage: { in: ["NEW", "CONTACTED", "PROPOSAL", "NEGOTIATION"] }, createdAt: inPeriod } }),
    ]),
  ]);
  const [totals, pipeline, created, createdPrev, won, wonPrev, lost, openNew] = kpi;
  const by = <T extends { companyId: string }>(rows: T[], id: string, f: (r: T) => number) => { const r = rows.find((x) => x.companyId === id); return r ? f(r) : 0; };
  const sum = <T extends { companyId: string }>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);
  const cnt = (r: { _count: number }) => r._count;
  const conv = (id?: string) => {
    const pick = <T extends { companyId: string }>(rows: T[], f: (r: T) => number) => (id ? by(rows, id, f) : sum(rows, f));
    const w = pick(won, cnt);
    const d = w + pick(lost, cnt) + pick(openNew, cnt);
    return d ? Math.round((w / d) * 100) : 0;
  };
  const split = (f: (id: string) => React.ReactNode) => (ctx.scope === "ALL" ? [{ value: f("vmh"), label: "VMH" }, { value: f("vth"), label: "VTH" }] : undefined);

  const board: Record<string, BoardLead[]> = { NEW: [], CONTACTED: [], PROPOSAL: [], NEGOTIATION: [], WON: [], LOST: [] };
  for (const l of leads) board[l.stage]!.push({ id: l.id, name: l.name, service: l.service, value: Number(l.value), co: companyCode(l.companyId), owner: l.owner?.name ?? null, ago: l.stage === "NEW" && l.lastActivityAt.getTime() === l.createdAt.getTime() ? null : formatRelative(l.lastActivityAt, t) });

  const sources = ["FIVERR", "WEBSITE", "REFERRAL", "LINKEDIN", "EMAIL", "INSTAGRAM", "OTHER"].map((s) => ({
    source: SOURCE_LABEL[s]!,
    VMH: leads.filter((l) => l.source === s && l.companyId === "vmh").length,
    VTH: leads.filter((l) => l.source === s && l.companyId === "vth").length,
  }));
  const vmhCount = by(counts, "vmh", cnt);
  const vthCount = by(counts, "vth", cnt);
  const recent = [...leads].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5);
  const allowedCo = ctx.companyIds.filter((c): c is "vmh" | "vth" => c === "vmh" || c === "vth").filter((c) => can(ctx.user, "create", "lead", c));
  const openId = p.str("id");

  return (
    <div className="space-y-3.5">
      <PageHeader title="Leads" subtitle="Track, manage and convert leads for Vertex Media House and Vertex Tech House." actions={allowedCo.length > 0 && <LeadFormDialog owners={owners} companies={allowedCo} />} />
      <div className="grid gap-3.5 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard icon={Users} tone="blue" label="Total Leads" value={sum(totals, cnt)} trend={pctChange(sum(created, cnt), createdPrev)} split={split((id) => by(totals, id, cnt))} />
        <KpiCard icon={Filter} tone="blue" label="Pipeline Value" value={formatINR(sum(pipeline, (r) => Number(r._sum.value)))} split={split((id) => formatINR(by(pipeline, id, (r) => Number(r._sum.value))))} />
        <KpiCard icon={CalendarDays} tone="purple" label="New Leads" suffix="(This Month)" value={sum(created, cnt)} trend={pctChange(sum(created, cnt), createdPrev)} split={split((id) => by(created, id, cnt))} />
        <KpiCard icon={Handshake} tone="green" label="Won Leads" value={sum(won, cnt)} trend={pctChange(sum(won, cnt), wonPrev)} split={split((id) => by(won, id, cnt))} />
        <KpiCard icon={Clock} tone="orange" label="Conversion Rate" value={`${conv()}%`} split={split((id) => `${conv(id)}%`)} />
      </div>

      <Card className="p-4">
        <div className="mb-3.5 flex flex-wrap items-center gap-3">
          <h2 className="mr-auto text-xl font-bold text-ink xl:mr-16">Leads Pipeline</h2>
          {ctx.scope === "ALL" && (
            <FilterTabs param="co" active={p.str("co") ?? "all"} tabs={[{ value: "all", label: "All", count: vmhCount + vthCount, tone: "blue" }, { value: "vmh", label: "VMH", count: vmhCount, tone: "vmh" }, { value: "vth", label: "VTH", count: vthCount, tone: "vth" }]} className="mr-auto" />
          )}
          <SearchInput placeholder="Search leads..." className="w-52" />
          <FilterSelect param="source" placeholder="All Sources" options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))} />
          <FilterSelect param="owner" placeholder="All Owners" options={owners.map((o) => ({ value: o.id, label: o.name }))} />
          <DateRangePicker {...p.range} />
          <Link href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === "string")) as Record<string, string>, lost: p.str("lost") ? "" : "1" })}`} className="text-xs font-medium text-blue hover:underline">
            {p.str("lost") ? "Hide Lost" : "Show Lost"}
          </Link>
        </div>
        <LeadBoard items={board} showLost={Boolean(p.str("lost"))} />
      </Card>

      <div className="grid gap-3.5 xl:grid-cols-[1.6fr_1fr_2fr]">
        <SectionCard title="Leads by Source">
          <ChartLegend items={[{ label: "VMH", color: COMPANY_COLORS.VMH }, { label: "VTH", color: COMPANY_COLORS.VTH }]} className="mb-2" />
          <BarsChart data={sources} xKey="source" stacked topLabels series={[{ key: "VMH", label: "VMH", color: COMPANY_COLORS.VMH }, { key: "VTH", label: "VTH", color: COMPANY_COLORS.VTH }]} height={170} barSize={38} />
        </SectionCard>
        <SectionCard title="Leads by Company">
          <ChartLegend items={[{ label: "Vertex Media House", color: COMPANY_COLORS.VMH }, { label: "Vertex Tech House", color: COMPANY_COLORS.VTH }]} className="mb-3" />
          <div className="flex items-center gap-5">
            <DonutChart center={vmhCount + vthCount} centerLabel="Total Leads" size={130} thickness={20} data={[{ label: "VMH", value: vmhCount, color: COMPANY_COLORS.VMH }, { label: "VTH", value: vthCount, color: COMPANY_COLORS.VTH }]} />
            <ul className="space-y-3 text-sm">
              {[["VMH", vmhCount], ["VTH", vthCount]].map(([c, n]) => (
                <li key={c} className="flex items-center gap-3">
                  <span className="size-2.5 rounded-full" style={{ background: COMPANY_COLORS[c as "VMH"] }} aria-hidden />
                  <span className="font-semibold text-ink">{n}</span>
                  <span className="text-ink-muted">{vmhCount + vthCount ? Math.round((Number(n) / (vmhCount + vthCount)) * 100) : 0}%</span>
                </li>
              ))}
            </ul>
          </div>
        </SectionCard>
        <SectionCard title="Recent Leads" href="/leads?sort=created">
          <table className="w-full text-2xs">
            <thead>
              <tr className="text-left text-ink-2">
                {["Name", "Company", "Service", "Value", "Stage", "Owner", "Date"].map((h) => <th key={h} className="bg-surface-muted px-2 py-1.5 font-medium first:rounded-l-md last:rounded-r-md">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {recent.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="px-2 py-1.5 text-ink">{l.name}</td>
                  <td className="px-2 py-1.5"><CompanyBadge code={companyCode(l.companyId)} /></td>
                  <td className="px-2 py-1.5 text-ink-2">{l.service}</td>
                  <td className="px-2 py-1.5 text-ink tabular">{formatINR(l.value)}</td>
                  <td className="px-2 py-1.5"><EnumPill map={LEAD_STAGE} value={l.stage} dot={false} size="xs" /></td>
                  <td className="px-2 py-1.5">{l.owner && <Avatar person={l.owner} size={22} />}</td>
                  <td className="px-2 py-1.5 text-ink-2">{formatDate(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>

      {openId && (
        <Suspense>
          <LeadDrawer id={openId} owners={owners} companies={allowedCo} />
        </Suspense>
      )}
    </div>
  );
}

async function LeadDrawer({ id, owners, companies }: { id: string; owners: { id: string; name: string }[]; companies: ("vmh" | "vth")[] }) {
  const ctx = await getRequestContext();
  const lead = await db.lead.findFirst({ where: { id, ...scopedWhere(ctx) }, include: { owner: { select: { name: true } }, client: { select: { id: true, name: true } } } });
  if (!lead) return null;
  const [activity, events] = await Promise.all([
    db.activity.findMany({ where: { entityType: "LEAD", entityId: id }, orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true } } } }),
    db.calendarEvent.findMany({ where: { leadId: id }, orderBy: { start: "asc" } }),
  ]);
  const t = now();
  return (
    <UrlSheet title={lead.name}>
      <div className="space-y-5 p-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-ink">{lead.name}</h2>
            <CompanyBadge code={companyCode(lead.companyId)} />
          </div>
          <p className="text-sm text-ink-muted">{lead.service}</p>
          <div className="mt-2 flex items-center gap-2">
            <EnumPill map={LEAD_STAGE} value={lead.stage} />
            <span className="text-lg font-bold text-ink">{formatINR(lead.value)}</span>
          </div>
        </div>
        <KeyValue
          rows={[
            ["Source", SOURCE_LABEL[lead.source]],
            ["Owner", lead.owner?.name ?? "–"],
            ["Contact", lead.contactName ?? "–"],
            ["Email", lead.email ? <a key="e" href={`mailto:${lead.email}`} className="text-blue hover:underline">{lead.email}</a> : "–"],
            ["Phone", lead.phone ?? "–"],
            ["Created", formatDate(lead.createdAt)],
            ["Client", lead.client ? <Link key="c" href={`/clients/${lead.client.id}`} className="text-blue hover:underline">{lead.client.name}</Link> : "Not a client yet"],
          ]}
        />
        {lead.notes && <p className="rounded-lg bg-surface-muted p-3 text-xs text-ink-2">{lead.notes}</p>}
        <div className="flex flex-wrap gap-2">
          {companies.includes(lead.companyId as "vmh") && (
            <LeadFormDialog owners={owners} companies={companies} lead={{ id: lead.id, name: lead.name, service: lead.service, value: Number(lead.value), companyId: lead.companyId as "vmh", source: lead.source, ownerId: lead.ownerId ?? "", contactName: lead.contactName ?? "", email: lead.email ?? "", phone: lead.phone ?? "", notes: lead.notes ?? "" }} trigger={<button className="h-9 rounded-lg border px-3 text-sm font-medium">Edit</button>} />
          )}
        </div>
        {can(ctx.user, "create", "client", lead.companyId) && lead.stage !== "LOST" && !lead.clientId && (
          <div className="space-y-2 rounded-xl border p-3">
            <p className="text-sm font-semibold text-ink">Convert to Client</p>
            <p className="text-xs text-ink-muted">Creates (or links) the client, marks the lead Won, and optionally starts a project.</p>
            <ConvertButtons leadId={lead.id} />
          </div>
        )}
        {events.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-semibold text-ink">Upcoming</h3>
            {events.map((e) => <p key={e.id} className="text-xs text-ink-2">{formatDate(e.start)} · {e.title}</p>)}
          </div>
        )}
        <div>
          <h3 className="mb-1 text-sm font-semibold text-ink">Timeline</h3>
          {activity.length === 0 && <p className="text-xs text-ink-muted">No activity yet.</p>}
          {activity.map((a) => <ActivityRow key={a.id} person={a.actor ?? undefined} text={a.summary} time={formatRelative(a.createdAt, t)} />)}
        </div>
      </div>
    </UrlSheet>
  );
}
