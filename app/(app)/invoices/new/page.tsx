import { Suspense } from "react";
import type { Metadata } from "next";
import { getRequestContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { parseCompanySettings } from "@/lib/settings";
import { readParams, type SP } from "@/lib/search-params";
import { CardSkeleton, PageHeader } from "@/components/shared/layout";
import { InvoiceBuilder } from "@/components/invoices/invoice-client";

export const metadata: Metadata = { title: "Create Invoice" };

export default function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  return <Suspense fallback={<CardSkeleton className="h-96" />}><Builder searchParams={searchParams} /></Suspense>;
}

async function Builder({ searchParams }: { searchParams: Promise<SP> }) {
  const [ctx, sp] = await Promise.all([getRequestContext(), searchParams]);
  const p = readParams(sp);
  const ids = ctx.companyIds.filter((c) => can(ctx.user, "create", "invoice", c));
  if (!ids.length) return <p className="p-6 text-sm">You don&apos;t have permission to create invoices.</p>;
  const [companies, clients, projects, entries] = await Promise.all([
    db.company.findMany({ where: { id: { in: ids } } }),
    db.client.findMany({ where: { archivedAt: null, companies: { some: { companyId: { in: ids } } } }, select: { id: true, name: true, companies: { select: { companyId: true } } }, orderBy: { name: "asc" } }),
    db.project.findMany({ where: { companyId: { in: ids } }, select: { id: true, name: true, clientId: true, companyId: true, value: true, billingType: true } }),
    db.timeEntry.findMany({ where: { companyId: { in: ids }, status: "APPROVED", billable: true, invoiceId: null }, orderBy: { start: "desc" }, take: 300, include: { project: { select: { name: true, clientId: true } }, task: { select: { title: true } }, user: { select: { name: true } } } }),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader title="Create Invoice" subtitle="Numbering follows each company's own sequence." />
      <InvoiceBuilder
        defaults={{ companyId: ctx.scope === "ALL" ? undefined : ctx.scope.toLowerCase(), projectId: p.str("project") ?? undefined }}
        companies={companies.map((c) => { const s = parseCompanySettings(c.settings); return { id: c.id as "vmh", name: c.name, taxRate: s.defaultTaxRate, terms: s.paymentTermsDays, hourlyRate: s.defaultHourlyRate }; })}
        clients={clients.map((c) => ({ id: c.id, name: c.name, companyIds: c.companies.map((x) => x.companyId) }))}
        projects={projects.map((x) => ({ id: x.id, name: x.name, clientId: x.clientId, companyId: x.companyId, value: Number(x.value), billing: x.billingType }))}
        entries={entries.map((e) => ({ id: e.id, companyId: e.companyId, clientId: e.project?.clientId ?? null, projectId: e.projectId, hours: Math.round(((e.durationMin ?? 0) / 60) * 100) / 100, label: `${e.start.toISOString().slice(0, 10)} · ${e.user.name} · ${e.task?.title ?? e.note ?? e.project?.name}` }))}
      />
    </div>
  );
}
