// Ported from app/(app)/leads/page.tsx: the Prisma work moved to server/routes/leads.ts,
// the render is unchanged apart from reading data from React Query.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock, Download, Filter, Handshake, Users } from "lucide-react";
import { BarsChart, ChartLegend, DonutChart } from "@/components/shared/charts";
import { ActivityRow } from "@/components/shared/display";
import { DateRangePicker, FilterSelect, SearchInput } from "@/components/shared/filters";
import { KpiCard } from "@/components/shared/kpi-card";
import { CardSkeleton, KeyValue, PageHeader } from "@/components/shared/layout";
import { FilterTabs } from "@/components/shared/nav";
import { CompanyBadge, EnumPill, companyCode } from "@/components/shared/pills";
import { Avatar, Card, SectionCard } from "@/components/shared/primitives";
import { DeleteButton } from "@/components/shared/delete-button";
import { UrlSheet } from "@/components/shared/url-sheet";
import { ConvertButtons } from "@/components/leads/convert-buttons";
import { LeadBoard, type BoardLead } from "@/components/leads/lead-board";
import { LeadFormDialog, SOURCE_LABEL } from "@/components/leads/lead-form";
import Link from "@/components/ui/link";
import { COMPANY_COLORS } from "@/lib/chart-colors";
import { now } from "@/lib/clock";
import { formatDate, formatINR, formatRelative } from "@/lib/format";
import { useSearchParams } from "@/lib/nav";
import { pctChange } from "@/lib/period";
import { readParams } from "@/lib/search-params";
import { LEAD_STAGE } from "@/lib/status";
import { API_URL, api, call, query } from "@/web/api";
import { useTitle } from "@/web/title";

const deleteLead = (leadId: string) => call(api.api.leads.delete.$post({ json: { leadId } }));

export default function LeadsPage() {
  useTitle("Leads");
  const [params] = useSearchParams();
  const sp = Object.fromEntries(params);
  const p = readParams(sp);
  const { data } = useQuery({ queryKey: ["leads", params.toString()], queryFn: () => query(api.api.leads.$get({ query: sp })) });

  if (!data) return <CardSkeleton className="h-96" />;
  if (!data.canView) return <p className="p-6 text-sm">You don&apos;t have access to leads.</p>;

  const t = now();
  const { leads, counts, owners, kpi, scope, allowedCo } = data;
  const { totals, pipeline, created, createdPrev, won, wonPrev, lost, openNew } = kpi;
  const by = <T extends { companyId: string }>(rows: T[], id: string, f: (r: T) => number) => { const r = rows.find((x) => x.companyId === id); return r ? f(r) : 0; };
  const sum = <T extends { companyId: string }>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);
  const cnt = (r: { _count: number }) => r._count;
  const conv = (id?: string) => {
    const pick = <T extends { companyId: string }>(rows: T[], f: (r: T) => number) => (id ? by(rows, id, f) : sum(rows, f));
    const w = pick(won, cnt);
    const d = w + pick(lost, cnt) + pick(openNew, cnt);
    return d ? Math.round((w / d) * 100) : 0;
  };
  const split = (f: (id: string) => React.ReactNode) => (scope === "ALL" ? [{ value: f("vmh"), label: "VMH" }, { value: f("vth"), label: "VTH" }] : undefined);

  const board: Record<string, BoardLead[]> = { NEW: [], CONTACTED: [], PROPOSAL: [], NEGOTIATION: [], WON: [], LOST: [] };
  for (const l of leads) board[l.stage]!.push({ id: l.id, name: l.name, service: l.service, value: Number(l.value), co: companyCode(l.companyId), owner: l.owner?.name ?? null, ago: l.stage === "NEW" && new Date(l.lastActivityAt).getTime() === new Date(l.createdAt).getTime() ? null : formatRelative(new Date(l.lastActivityAt), t) });

  const sources = ["FIVERR", "WEBSITE", "REFERRAL", "LINKEDIN", "EMAIL", "INSTAGRAM", "OTHER"].map((s) => ({
    source: SOURCE_LABEL[s]!,
    href: `/leads?source=${s}`,
    VMH: leads.filter((l) => l.source === s && l.companyId === "vmh").length,
    VTH: leads.filter((l) => l.source === s && l.companyId === "vth").length,
  }));
  const vmhCount = by(counts, "vmh", cnt);
  const vthCount = by(counts, "vth", cnt);
  const recent = [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  const openId = p.str("id");
  const exportHref = `${API_URL}/api/leads/export?${params.toString()}`;

  return (
    <div className="space-y-3.5">
      <PageHeader
        title="Leads"
        subtitle="Track, manage and convert leads for Vertex Media House and Vertex Tech House."
        actions={
          <>
            {/* Plain <a>: a file download, not a page. Carries the filters you are looking at. */}
            <a href={exportHref} className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-xs font-medium text-ink-2 hover:bg-accent"><Download className="size-4" /> Export</a>
            {allowedCo.length > 0 && <LeadFormDialog owners={owners} companies={allowedCo} />}
          </>
        }
      />
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
          {scope === "ALL" && (
            <FilterTabs param="co" active={p.str("co") ?? "all"} tabs={[{ value: "all", label: "All", count: vmhCount + vthCount, tone: "blue" }, { value: "vmh", label: "VMH", count: vmhCount, tone: "vmh" }, { value: "vth", label: "VTH", count: vthCount, tone: "vth" }]} className="mr-auto" />
          )}
          <SearchInput placeholder="Search leads..." className="w-52" />
          <FilterSelect param="source" placeholder="All Sources" options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))} />
          <FilterSelect param="owner" placeholder="All Owners" options={owners.map((o) => ({ value: o.id, label: o.name }))} />
          <DateRangePicker {...p.range} />
          <Link href={`?${new URLSearchParams({ ...sp, lost: p.str("lost") ? "" : "1" })}`} className="text-xs font-medium text-brand-text hover:underline">
            {p.str("lost") ? "Hide Lost" : "Show Lost"}
          </Link>
        </div>
        <LeadBoard items={board} showLost={Boolean(p.str("lost"))} />
      </Card>

      <div className="grid gap-3.5 xl:grid-cols-[1.6fr_1fr_2fr]">
        <SectionCard title="Leads by Source">
          <ChartLegend items={[{ label: "VMH", color: COMPANY_COLORS.VMH, href: "/leads?co=vmh" }, { label: "VTH", color: COMPANY_COLORS.VTH, href: "/leads?co=vth" }]} className="mb-2" />
          <BarsChart data={sources} xKey="source" stacked topLabels series={[{ key: "VMH", label: "VMH", color: COMPANY_COLORS.VMH }, { key: "VTH", label: "VTH", color: COMPANY_COLORS.VTH }]} height={170} barSize={38} />
        </SectionCard>
        <SectionCard title="Leads by Company">
          <ChartLegend items={[{ label: "Vertex Media House", color: COMPANY_COLORS.VMH, href: "/leads?co=vmh" }, { label: "Vertex Tech House", color: COMPANY_COLORS.VTH, href: "/leads?co=vth" }]} className="mb-3" />
          <div className="flex items-center gap-5">
            <DonutChart center={vmhCount + vthCount} centerLabel="Total Leads" size={130} thickness={20} data={[{ label: "VMH", value: vmhCount, color: COMPANY_COLORS.VMH, href: "/leads?co=vmh" }, { label: "VTH", value: vthCount, color: COMPANY_COLORS.VTH, href: "/leads?co=vth" }]} />
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
                  <td className="px-2 py-1.5 text-ink-2">{formatDate(new Date(l.createdAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>

      {openId && <LeadDrawer id={openId} owners={owners} companies={allowedCo} />}
    </div>
  );
}

function LeadDrawer({ id, owners, companies }: { id: string; owners: { id: string; name: string }[]; companies: ("vmh" | "vth")[] }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["leads", "detail", id], queryFn: () => query(api.api.leads[":id"].$get({ param: { id } })) });
  if (!data?.lead) return null;
  const { lead, activity, events, canDelete, canConvert } = data;
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
            ["Email", lead.email ? <a key="e" href={`mailto:${lead.email}`} className="text-brand-text hover:underline">{lead.email}</a> : "–"],
            ["Phone", lead.phone ?? "–"],
            ["Created", formatDate(new Date(lead.createdAt))],
            ["Client", lead.client ? <Link key="c" href={`/clients/${lead.client.id}`} className="text-brand-text hover:underline">{lead.client.name}</Link> : "Not a client yet"],
          ]}
        />
        {lead.notes && <p className="rounded-lg bg-surface-muted p-3 text-xs text-ink-2">{lead.notes}</p>}
        <div className="flex flex-wrap gap-2">
          {companies.includes(lead.companyId as "vmh") && (
            <LeadFormDialog owners={owners} companies={companies} lead={{ id: lead.id, name: lead.name, service: lead.service, value: Number(lead.value), companyId: lead.companyId as "vmh", source: lead.source, ownerId: lead.ownerId ?? "", contactName: lead.contactName ?? "", email: lead.email ?? "", phone: lead.phone ?? "", notes: lead.notes ?? "" }} trigger={<button className="h-9 rounded-lg border px-3 text-sm font-medium">Edit</button>} />
          )}
          {canDelete && (
            <DeleteButton action={async () => { const r = await deleteLead(lead.id); if (r.ok) await queryClient.invalidateQueries({ queryKey: ["leads"] }); return r; }} noun="lead" name={lead.name} redirectTo="/leads" />
          )}
        </div>
        {canConvert && lead.stage !== "LOST" && !lead.clientId && (
          <div className="space-y-2 rounded-xl border p-3">
            <p className="text-sm font-semibold text-ink">Convert to Client</p>
            <p className="text-xs text-ink-muted">Creates (or links) the client, marks the lead Won, and optionally starts a project.</p>
            <ConvertButtons leadId={lead.id} />
          </div>
        )}
        {events.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-semibold text-ink">Upcoming</h3>
            {events.map((e) => <p key={e.id} className="text-xs text-ink-2">{formatDate(new Date(e.start))} · {e.title}</p>)}
          </div>
        )}
        <div>
          <h3 className="mb-1 text-sm font-semibold text-ink">Timeline</h3>
          {activity.length === 0 && <p className="text-xs text-ink-muted">No activity yet.</p>}
          {activity.map((a) => <ActivityRow key={a.id} person={a.actor ?? undefined} text={a.summary} time={formatRelative(new Date(a.createdAt), t)} />)}
        </div>
      </div>
    </UrlSheet>
  );
}
