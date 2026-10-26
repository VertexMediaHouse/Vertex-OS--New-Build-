// Ported from app/(app)/clients/page.tsx. Filtering, sorting and paging happen in
// server/routes/clients.ts, where the RSC did them.
import { useQuery } from "@tanstack/react-query";
import { CircleDollarSign, Clock, Download, Handshake, UserPlus, Users } from "lucide-react";
import { DonutChart, DonutLegend } from "@/components/shared/charts";
import { FilterSelect, SearchInput } from "@/components/shared/filters";
import { KpiCard } from "@/components/shared/kpi-card";
import { CardSkeleton, PageHeader } from "@/components/shared/layout";
import { FilterTabs, Pagination } from "@/components/shared/nav";
import { Card, IconTile, SectionCard } from "@/components/shared/primitives";
import { ClientFormDialog } from "@/components/clients/client-form";
import { ClientsTable } from "@/components/clients/clients-table";
import Link from "@/components/ui/link";
import { CLIENT_SEGMENT_COLORS } from "@/lib/chart-colors";
import { now } from "@/lib/clock";
import { formatINR, formatRelative } from "@/lib/format";
import { useSearchParams } from "@/lib/nav";
import { pctChange } from "@/lib/period";
import { CLIENT_STATUS } from "@/lib/status";
import { API_URL, api, query } from "@/web/api";
import { useTitle } from "@/web/title";

export default function ClientsPage() {
  useTitle("Clients");
  const [params] = useSearchParams();
  const sp = Object.fromEntries(params);
  const { data } = useQuery({ queryKey: ["clients", params.toString()], queryFn: () => query(api.api.clients.$get({ query: sp })) });

  if (!data) return <CardSkeleton className="h-96" />;
  if (!data.canView) return <p className="p-6 text-sm text-ink-2">You don&apos;t have access to clients.</p>;

  const { all, pageRows, total, pageSize, page, archived, owners, tags, scope, creatable } = data;
  const month = new Date(data.month);
  const prevMonth = new Date(month.getTime() - 86_400_000 * 28);
  const has = (c: (typeof all)[number], co: string) => c.companies.includes(co.toUpperCase() as "VMH");
  const count = (f: (c: (typeof all)[number]) => boolean, co?: string) => all.filter((c) => f(c) && (!co || has(c, co))).length;
  const sumRev = (co?: string) => all.filter((c) => !co || has(c, co)).reduce((a, c) => a + c.revenue, 0);
  const split = (f: (co: string) => React.ReactNode) => (scope === "ALL" ? [{ value: f("vmh"), label: "VMH" }, { value: f("vth"), label: "VTH" }] : undefined);
  const isNew = (c: (typeof all)[number]) => new Date(c.createdAt) >= month;
  const newPrev = all.filter((c) => new Date(c.createdAt) >= prevMonth && new Date(c.createdAt) < month).length;
  const segments = (["ACTIVE", "ON_HOLD", "COMPLETED", "INACTIVE"] as const).map((s) => ({ label: CLIENT_STATUS[s]!.label, value: count((c) => c.status === s), color: CLIENT_SEGMENT_COLORS[s], href: `/clients?status=${s}` }));
  const top = [...all].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const recent = [...all].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4);
  const t = now();
  const exportHref = `${API_URL}/api/clients/export?${params.toString()}`;

  return (
    <div className="space-y-3.5">
      <PageHeader title="Clients" subtitle="Manage all your clients across Vertex Media House and Vertex Tech House." actions={creatable.length > 0 && <ClientFormDialog companies={creatable} owners={owners} />} />
      <div className="grid gap-3.5 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard icon={Users} tone="purple" label="Total Clients" value={all.length} trend={pctChange(count(isNew), newPrev)} split={split((co) => count(() => true, co))} />
        <KpiCard icon={Handshake} tone="green" label="Active Clients" value={count((c) => c.status === "ACTIVE")} split={split((co) => count((c) => c.status === "ACTIVE", co))} />
        <KpiCard icon={Clock} tone="orange" label="On Hold" value={count((c) => c.status === "ON_HOLD")} inverse split={split((co) => count((c) => c.status === "ON_HOLD", co))} />
        <KpiCard icon={UserPlus} tone="blue" label="New Clients" suffix="(This Month)" value={count(isNew)} trend={pctChange(count(isNew), newPrev)} split={split((co) => count(isNew, co))} />
        <KpiCard icon={CircleDollarSign} tone="green" label="Total Revenue" suffix="(Clients)" value={formatINR(sumRev())} split={split((co) => formatINR(sumRev(co)))} />
      </div>

      <div className="grid gap-3.5 xl:grid-cols-[1fr_285px]">
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            {scope === "ALL" ? (
              <FilterTabs param="co" active={sp.co ?? "all"} className="mr-auto" tabs={[{ value: "all", label: "All Clients", count: all.length, tone: "blue" }, { value: "vmh", label: "VMH Clients", count: count(() => true, "vmh"), tone: "vmh" }, { value: "vth", label: "VTH Clients", count: count(() => true, "vth"), tone: "vth" }]} />
            ) : <span className="mr-auto" />}
            <SearchInput placeholder="Search clients..." className="w-48" />
            <FilterSelect param="status" placeholder="All Status" options={Object.entries(CLIENT_STATUS).map(([value, m]) => ({ value, label: m.label }))} />
            <FilterSelect param="tag" placeholder="All Tags" options={tags.map((tg) => ({ value: tg.name, label: tg.name }))} />
            <FilterSelect param="owner" placeholder="All Owners" options={owners.map((o) => ({ value: o.id, label: o.name }))} />
            <Link href={archived ? "/clients" : "/clients?archived=1"} className="inline-flex h-9 items-center rounded-lg border bg-card px-3 text-xs font-medium text-ink-2 hover:bg-accent">{archived ? "Active clients" : "Archived"}</Link>
            <a href={exportHref} className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-xs font-medium text-ink-2 hover:bg-accent"><Download className="size-4" /> Export</a>
          </div>
          <ClientsTable archived={archived} rows={pageRows.map(({ createdAt, lastActivityAt, tags: _t, ...r }) => (void createdAt, void lastActivityAt, void _t, r))} />
          <Pagination className="mt-4" page={page} pageSize={pageSize} total={total} noun="clients" />
        </Card>
        <div className="space-y-3.5">
          <SectionCard title="Client Segments">
            <div className="flex items-center gap-4">
              <DonutChart data={segments} center={all.length} centerLabel="Clients" size={104} thickness={14} />
              <DonutLegend items={segments.map((s) => ({ ...s, extra: `${all.length ? Math.round((s.value / all.length) * 100) : 0}%` }))} />
            </div>
          </SectionCard>
          <SectionCard title="Top Clients by Revenue" href="/clients?sort=revenue">
            <ul className="space-y-2.5">
              {top.map((c) => (
                <li key={c.id} className="flex items-center gap-2.5 text-xs">
                  <span className="inline-flex size-6 items-center justify-center rounded-md text-xs font-bold" style={{ background: `${c.logoColor}1F`, color: c.logoColor }}>{c.name[0]}</span>
                  <Link href={`/clients/${c.id}`} className="flex-1 truncate text-ink hover:underline">{c.name}</Link>
                  <span className="font-semibold text-ink tabular">{formatINR(c.revenue)}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
          <SectionCard title="Recent New Clients" href="/clients?sort=created">
            <ul className="space-y-3">
              {recent.map((c) => (
                <li key={c.id} className="flex items-center gap-2.5">
                  <IconTile icon={Users} tone="purple" size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/clients/${c.id}`} className="block truncate text-xs font-semibold text-ink hover:underline">{c.name}</Link>
                    <p className="text-2xs text-ink-muted">{c.type}</p>
                  </div>
                  <span className="text-2xs text-ink-muted">{formatRelative(new Date(c.createdAt), t)}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
