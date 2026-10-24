import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Mail, MailOpen, Plus, Reply, Send } from "lucide-react";
import { getRequestContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { readParams, type SP } from "@/lib/search-params";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card } from "@/components/shared/primitives";
import { CardSkeleton, EmptyState, PageHeader, SidePanel } from "@/components/shared/layout";
import { CompanyBadge, StatusPill } from "@/components/shared/pills";
import { CampaignStatusButtons, RecipientButtons } from "@/components/campaigns/campaign-client";

export const metadata: Metadata = { title: "Email Campaigns" };
const code = (id: string | null) => (id === "vmh" ? "VMH" : id === "vth" ? "VTH" : "ALL") as "VMH";
const TONE = { DRAFT: "neutral", SCHEDULED: "info", ACTIVE: "success", PAUSED: "warning", COMPLETED: "info" } as const;

export default function CampaignsPage({ searchParams }: PageProps<"/campaigns">) {
  return <Suspense fallback={<CardSkeleton className="h-96" />}><Campaigns searchParams={searchParams} /></Suspense>;
}

async function Campaigns({ searchParams }: { searchParams: Promise<SP> }) {
  const [ctx, sp] = await Promise.all([getRequestContext(), searchParams]);
  if (!can(ctx.user, "view", "campaign")) return <p className="p-6 text-sm">You don&apos;t have access to campaigns.</p>;
  const p = readParams(sp);
  const list = await db.emailCampaign.findMany({ where: { OR: [{ companyId: { in: ctx.companyIds } }, { companyId: null }] }, orderBy: { createdAt: "desc" } });
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const active = list.filter((c) => c.status === "ACTIVE");
  const sum = (f: (c: (typeof list)[number]) => number) => list.reduce((a, c) => a + f(c), 0);
  const sent = sum((c) => c.sentCount);
  const openId = p.str("id");
  return (
    <div className="space-y-3.5">
      <PageHeader title="Email Campaigns" subtitle="Outreach sequences for both companies, with opens, replies and meetings." actions={can(ctx.user, "create", "campaign") && <Link href="/campaigns/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-md font-semibold text-white"><Plus className="size-4" /> New Campaign</Link>} />
      <div className="grid gap-3.5 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard icon={Send} tone="blue" label="Active Campaigns" value={active.length} />
        <KpiCard icon={Mail} tone="purple" label="Emails Sent" value={sent.toLocaleString("en-IN")} />
        <KpiCard icon={MailOpen} tone="green" label="Avg Open Rate" value={`${pct(sum((c) => c.openCount), sent)}%`} />
        <KpiCard icon={Reply} tone="orange" label="Avg Reply Rate" value={`${pct(sum((c) => c.replyCount), sent)}%`} />
        <KpiCard icon={CalendarCheck} tone="pink" label="Meetings Booked" value={sum((c) => c.meetingsCount)} />
      </div>
      <div className={`grid gap-3.5 ${openId ? "xl:grid-cols-[1fr_380px]" : ""}`}>
        <Card className="p-4">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-2xs text-ink-2">{["Name", "Company", "Status", "Sent", "Open %", "Reply %", "Meetings", "Created"].map((h) => <th key={h} className="bg-surface-muted px-2 py-2 font-medium first:rounded-l-md last:rounded-r-md">{h}</th>)}</tr></thead>
            <tbody>{list.map((c) => <tr key={c.id} className={`border-b ${c.id === openId ? "bg-[#EAF4FC]" : "hover:bg-[#F8FAFC]"}`}><td className="px-2 py-2.5"><Link href={`?id=${c.id}`} scroll={false} className="font-semibold text-ink hover:underline">{c.name}</Link></td><td className="px-2"><CompanyBadge code={code(c.companyId)} /></td><td className="px-2"><StatusPill label={c.status[0] + c.status.slice(1).toLowerCase()} tone={TONE[c.status]} /></td><td className="px-2 tabular">{c.sentCount.toLocaleString("en-IN")}</td><td className="px-2 text-success-text">{pct(c.openCount, c.sentCount)}%</td><td className="px-2 text-danger-text">{pct(c.replyCount, c.sentCount)}%</td><td className="px-2">{c.meetingsCount}</td><td className="px-2">{formatDate(c.createdAt)}</td></tr>)}</tbody>
          </table>
          {list.length === 0 && <EmptyState title="No campaigns yet" action={<Link href="/campaigns/new" className="text-blue">Create one</Link>} />}
        </Card>
        {openId && <Suspense fallback={<CardSkeleton />}><CampaignPanel id={openId} /></Suspense>}
      </div>
    </div>
  );
}

async function CampaignPanel({ id }: { id: string }) {
  const c = await db.emailCampaign.findUnique({ where: { id }, include: { recipients: { orderBy: { sentAt: "desc" }, take: 100 } } });
  if (!c) return null;
  return (
    <SidePanel title={c.name} closeHref="/campaigns" header={<><CompanyBadge code={code(c.companyId)} /><StatusPill label={c.status} tone={TONE[c.status]} /></>}>
      <CampaignStatusButtons id={c.id} status={c.status} />
      <p className="mt-3 text-xs text-ink-muted">Subject: {c.subject}</p>
      <h3 className="mt-4 mb-1 text-sm font-semibold text-ink">Recipients ({c.recipients.length})</h3>
      <ul className="divide-y text-xs">
        {c.recipients.map((r) => <li key={r.id} className="flex items-center gap-2 py-2"><span className="min-w-0 flex-1 truncate">{r.name ?? r.email}<span className="block text-2xs text-ink-muted">{r.email}</span></span><StatusPill size="xs" dot={false} label={r.status.toLowerCase()} tone={r.status === "REPLIED" ? "success" : r.status === "OPENED" ? "info" : r.status === "BOUNCED" ? "danger" : "neutral"} /><RecipientButtons id={r.id} replied={Boolean(r.repliedAt)} meeting={Boolean(r.meetingBookedAt)} /></li>)}
      </ul>
    </SidePanel>
  );
}
