// Ported from app/(app)/invoices/page.tsx: the Prisma work moved to server/routes/invoices.ts.
import { useQuery } from "@tanstack/react-query";
import { CircleDollarSign, Clock, Download, ExternalLink, Maximize2, Plus, Users, Wallet } from "lucide-react";
import { ActivityRow } from "@/components/shared/display";
import { ClearFilters, FilterSelect, SearchInput } from "@/components/shared/filters";
import { KpiCard } from "@/components/shared/kpi-card";
import { CardSkeleton, EmptyState, KeyValue, PageHeader, SidePanel } from "@/components/shared/layout";
import { Logo } from "@/components/shared/logo";
import { FilterTabs, Pagination, UnderlineTabs } from "@/components/shared/nav";
import { CompanyBadge, EnumPill, companyCode } from "@/components/shared/pills";
import { Card, ProgressBar } from "@/components/shared/primitives";
import { InvoiceActions } from "@/components/invoices/invoice-client";
import Link from "@/components/ui/link";
import { now } from "@/lib/clock";
import { logoColor } from "@/lib/chart-colors";
import { formatDate, formatDaysLeft, formatMoney, formatRelative } from "@/lib/format";
import { useSearchParams } from "@/lib/nav";
import { INVOICE_STATUS } from "@/lib/status";
import { API_URL, api, query } from "@/web/api";
import { useTitle } from "@/web/title";

export default function InvoicesPage() {
  useTitle("Invoices");
  const [params] = useSearchParams();
  const sp = Object.fromEntries(params);
  const { data } = useQuery({
    queryKey: ["invoices", sp],
    queryFn: () => query(api.api.invoices.$get({ query: sp })),
  });

  if (!data) return <CardSkeleton className="h-96" />;
  if (data.denied) return <p className="p-6 text-sm">You don&apos;t have access to invoices.</p>;

  const { rows, total, byStatus, agg, clients, projects, scope, companies, page, pageSize } = data;
  const status = sp.status;
  const openId = sp.id;
  const s = (co: string | null, f: (r: (typeof agg)[number]) => number) => agg.filter((r) => !co || r.companyId === co).reduce((a, r) => a + f(r), 0);
  const tot = (r: (typeof agg)[number]) => Number(r._sum.total ?? 0);
  const paid = (r: (typeof agg)[number]) => Number(r._sum.paidAmount ?? 0);
  const split = (f: (co: string) => React.ReactNode) => (scope === "ALL" ? [{ value: f("vmh"), label: "VMH" }, { value: f("vth"), label: "VTH" }] : undefined);
  const cnt = (st?: string) => byStatus.filter((b) => !st || b.status === st).reduce((a, b) => a + b._count, 0);

  return (
    <div className="space-y-3.5">
      <PageHeader title="Invoices" subtitle="Create, manage and track all invoices across Vertex Media House and Vertex Tech House." actions={companies.length > 0 && <Link href="/invoices/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-strong px-4 text-md font-semibold text-white"><Plus className="size-4" /> Create Invoice</Link>} />
      <div className={`grid gap-3.5 ${openId ? "xl:grid-cols-[1fr_330px]" : ""}`}>
        <div className="min-w-0 space-y-3.5">
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={Users} tone="purple" label="Total Invoices" value={s(null, (r) => r._count)} split={split((co) => s(co, (r) => r._count))} />
            <KpiCard icon={CircleDollarSign} tone="green" label="Total Amount" value={formatMoney(s(null, tot))} split={split((co) => formatMoney(s(co, tot)))} />
            <KpiCard icon={Wallet} tone="blue" label="Paid Amount" value={formatMoney(s(null, paid))} split={split((co) => formatMoney(s(co, paid)))} />
            <KpiCard icon={Clock} tone="orange" label="Outstanding Amount" value={formatMoney(s(null, tot) - s(null, paid))} split={split((co) => formatMoney(s(co, tot) - s(co, paid)))} />
          </div>
          <Card className="p-4">
            <FilterTabs param="status" active={status ?? "all"} tabs={[{ value: "all", label: "All Invoices", count: cnt(), tone: "blue" }, { value: "PAID", label: "Paid", count: cnt("PAID"), tone: "success" }, { value: "PENDING", label: "Pending", count: cnt("PENDING"), tone: "review" }, { value: "OVERDUE", label: "Overdue", count: cnt("OVERDUE"), tone: "danger" }, { value: "DRAFT", label: "Draft", count: cnt("DRAFT"), tone: "neutral" }, { value: "CANCELLED", label: "Cancelled", count: cnt("CANCELLED"), tone: "neutral" }]} />
            <div className="my-3 flex flex-wrap items-center gap-3">
              <SearchInput placeholder="Search invoices..." className="w-64" />
              {scope === "ALL" && <FilterSelect param="co" placeholder="All Companies" options={[{ value: "vmh", label: "Vertex Media House" }, { value: "vth", label: "Vertex Tech House" }]} />}
              <FilterSelect param="client" placeholder="All Clients" options={clients.map((x) => ({ value: x.id, label: x.name }))} />
              <FilterSelect param="project" placeholder="All Projects" options={projects.map((x) => ({ value: x.id, label: x.name }))} />
              <ClearFilters params={["q", "co", "status", "client", "project"]} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-2xs">
                <thead><tr className="text-left text-ink-2">{["Invoice #", "Client", "Company", "Project", "Issue Date", "Due Date", "Amount", "Status", "Payment Progress"].map((h) => <th key={h} className="bg-surface-muted px-2 py-2 font-medium first:rounded-l-md last:rounded-r-md">{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((i) => {
                    const pct = Number(i.total) ? (Number(i.paidAmount) / Number(i.total)) * 100 : 0;
                    const color = logoColor(i.client?.name);
                    return (
                      <tr key={i.id} className={`border-b ${i.id === openId ? "bg-brand-soft" : "hover:bg-accent"}`}>
                        <td className="px-2 py-2.5"><Link href={`?${new URLSearchParams({ ...sp, id: i.id })}`} scroll={false} className="font-medium text-ink hover:underline">#{i.number}</Link></td>
                        <td className="px-2 py-2.5"><span className="flex items-center gap-2"><span className="inline-flex size-6 items-center justify-center rounded-md text-xs font-bold" style={{ background: `${color}1F`, color }}>{(i.client?.name ?? "?")[0]}</span><span className="font-semibold text-ink">{i.client?.name}</span></span></td>
                        <td className="px-2 py-2.5"><CompanyBadge code={companyCode(i.companyId)} /></td>
                        <td className="px-2 py-2.5 text-ink-2">{i.project?.name}</td>
                        <td className="px-2 py-2.5">{formatDate(new Date(i.issueDate))}</td>
                        <td className="px-2 py-2.5">{formatDate(new Date(i.dueDate))}</td>
                        <td className="px-2 py-2.5 font-medium text-ink tabular">{formatMoney(i.total, i.currency)}</td>
                        <td className="px-2 py-2.5"><EnumPill map={INVOICE_STATUS} value={i.status} /></td>
                        <td className="px-2 py-2.5"><span className="flex items-center gap-2"><ProgressBar value={pct} tone={pct >= 100 ? "success" : "primary"} className="w-20" />{Math.round(pct)}%</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length === 0 && <EmptyState title="No invoices match" />}
            </div>
            <Pagination className="mt-4" page={page} pageSize={pageSize} total={total} noun="invoices" />
          </Card>
        </div>
        {openId && <InvoicePanel id={openId} tab={sp.tab ?? "overview"} sp={sp} />}
      </div>
    </div>
  );
}

function InvoicePanel({ id, tab, sp }: { id: string; tab: string; sp: Record<string, string> }) {
  const { data } = useQuery({ queryKey: ["invoices", "panel", id], queryFn: () => query(api.api.invoices[":id"].panel.$get({ param: { id } })) });
  if (!data) return <CardSkeleton className="h-96" />;
  if (!data.found) return null;

  const { inv, notes, activity, canUpdate } = data;
  const t = now();
  const balance = Number(inv.total) - Number(inv.paidAmount);
  const pct = Number(inv.total) ? (Number(inv.paidAmount) / Number(inv.total)) * 100 : 0;
  const closeHref = `?${new URLSearchParams(Object.entries(sp).filter(([k]) => k !== "id" && k !== "tab"))}`;
  const color = logoColor(inv.client?.name);
  const pdfHref = `${API_URL}/api/invoices/${inv.id}/pdf`;
  return (
    <div className="space-y-3.5">
      <SidePanel title={`Invoice #${inv.number}`} closeHref={closeHref} header={<EnumPill map={INVOICE_STATUS} value={inv.status} />}>
        <UnderlineTabs active={tab} tabs={[{ value: "overview", label: "Overview" }, { value: "payments", label: "Payments" }, { value: "notes", label: `Notes (${notes.length})` }, { value: "activity", label: "Activity" }]} className="-mx-1 mb-3" />
        {tab === "overview" && (
          <>
            <div className="mb-3 flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-lg text-lg font-bold" style={{ background: `${color}1F`, color }}>{(inv.client?.name ?? "?")[0]}</span>
              <div className="flex-1"><p className="text-sm font-semibold text-ink">{inv.client.name}</p><p className="text-2xs text-ink-muted">{inv.client.domain}</p></div>
              <Link href={`/clients/${inv.clientId}`} className="text-2xs text-brand-text hover:underline">View Client →</Link>
            </div>
            <KeyValue labelWidth={90} rows={[
              ["Project", inv.project ? <Link key="p" href={`/projects?id=${inv.project.id}`} className="inline-flex items-center gap-1 text-brand-text hover:underline">{inv.project.name}<ExternalLink className="size-3" /></Link> : "–"],
              ["Company", <span key="c" className="flex items-center gap-1.5"><CompanyBadge code={companyCode(inv.companyId)} />{inv.company.name}</span>],
              ["Issue Date", formatDate(new Date(inv.issueDate))],
              ["Due Date", <span key="d" className={balance > 0 ? "text-danger-text" : ""}>{formatDate(new Date(inv.dueDate))}{balance > 0 && ` (${formatDaysLeft(new Date(inv.dueDate), t)})`}</span>],
              ["Amount", formatMoney(inv.total, inv.currency)],
              ["Paid Amount", formatMoney(inv.paidAmount, inv.currency)],
              ["Outstanding", formatMoney(balance, inv.currency)],
            ]} />
            <div className="mt-3 flex items-center gap-3"><ProgressBar value={pct} /><span className="text-xs font-semibold">{Math.round(pct)}%</span></div>
            {canUpdate && <div className="mt-4"><InvoiceActions id={inv.id} status={inv.status} balance={balance} currency={inv.currency} /></div>}
          </>
        )}
        {tab === "payments" && (inv.payments.length ? inv.payments.map((pm: any) => <div key={pm.id} className="flex justify-between border-b py-2 text-xs"><span>{formatDate(new Date(pm.date))} · {pm.method.replace("_", " ").toLowerCase()}{pm.reference && ` · ${pm.reference}`}</span><b>{formatMoney(pm.amount, inv.currency)}</b></div>) : <EmptyState title="No payments yet" />)}
        {tab === "notes" && notes.map((n) => <ActivityRow key={n.id} person={n.author} text={n.body} time={formatRelative(new Date(n.createdAt), t)} />)}
        {tab === "activity" && activity.map((a) => <ActivityRow key={a.id} person={a.actor ?? undefined} text={a.summary} time={formatRelative(new Date(a.createdAt), t)} />)}
      </SidePanel>
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-md font-bold text-ink">Invoice Preview</h3>
          <div className="flex gap-2">
            <a href={pdfHref} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs"><Download className="size-3.5" /> Download</a>
            <a href={pdfHref} target="_blank" rel="noreferrer" aria-label="Open full size" className="inline-flex size-8 items-center justify-center rounded-lg border"><Maximize2 className="size-3.5" /></a>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-[9.5px] text-ink-2" style={{ backgroundImage: "radial-gradient(120% 60% at 100% 120%, var(--brand-soft) 0 40%, transparent 41%)" }}>
          <div className="flex justify-between">
            <Logo tone="dark" subtitle={inv.company.code === "VTH" ? "TECH HOUSE" : "MEDIA HOUSE"} className="origin-top-left scale-75" />
            <div className="text-right"><p className="text-xs font-bold text-ink">#{inv.number}</p><p>Issue Date: {formatDate(new Date(inv.issueDate))}</p><p>Due Date: {formatDate(new Date(inv.dueDate))}</p></div>
          </div>
          <p className="mt-2 text-lg font-bold text-ink">INVOICE</p>
          <div className="mt-2 flex justify-between gap-4">
            <div><p className="font-bold text-ink">Bill To</p><p className="font-semibold text-ink">{inv.client.name}</p><p>{inv.client.address}</p></div>
            {inv.project && <div><p className="font-bold text-ink">Project</p><p>{inv.project.name}</p></div>}
          </div>
          <div className="overflow-x-auto"><table className="mt-3 w-full overflow-hidden rounded border">
            <thead className="bg-surface-muted text-ink"><tr>{["#", "Description", "Qty", "Rate", "Amount"].map((h, n) => <th key={h} className={`px-1.5 py-1 font-semibold ${n >= 2 ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
            <tbody>{inv.lineItems.map((l: any, n: any) => <tr key={l.id}><td className="px-1.5 py-1">{n + 1}</td><td className="px-1.5 py-1">{l.description}</td><td className="px-1.5 py-1 text-right">{Number(l.qty)}</td><td className="px-1.5 py-1 text-right">{formatMoney(l.rate, inv.currency)}</td><td className="px-1.5 py-1 text-right">{formatMoney(l.amount, inv.currency)}</td></tr>)}</tbody>
          </table></div>
          <div className="mt-2 ml-auto w-1/2 space-y-0.5">
            <p className="flex justify-between"><span>Subtotal</span><b className="text-ink">{formatMoney(inv.subtotal, inv.currency)}</b></p>
            <p className="flex justify-between"><span>Tax ({Number(inv.taxRate)}%)</span><span>{formatMoney(inv.taxAmount, inv.currency)}</span></p>
            <p className="flex justify-between border-t pt-0.5 font-bold text-ink"><span>Total</span><span>{formatMoney(inv.total, inv.currency)}</span></p>
          </div>
          {inv.notes && <div className="mt-3"><p className="font-bold text-ink">Notes</p><p>{inv.notes}</p></div>}
        </div>
      </Card>
    </div>
  );
}
