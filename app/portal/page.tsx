import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { formatDate, formatFileSize, formatINR } from "@/lib/format";
import { APPROVAL_STATUS, INVOICE_STATUS, PROJECT_STATUS } from "@/lib/status";
import { Logo } from "@/components/shared/logo";
import { Card, ProgressBar, SectionCard } from "@/components/shared/primitives";
import { CardSkeleton, EmptyState } from "@/components/shared/layout";
import { EnumPill } from "@/components/shared/pills";
import { FileIcon } from "@/components/shared/display";
import { ApprovalButtons } from "./approval-buttons";

export const metadata: Metadata = { title: "Client Portal" };

export default function PortalPage() {
  return (
    <Suspense fallback={<div className="p-6"><CardSkeleton className="h-96" /></div>}>
      <Portal />
    </Suspense>
  );
}

async function Portal() {
  const user = await getCurrentUser();
  if (user.kind !== "CLIENT") redirect("/dashboard");
  const contact = await db.clientContact.findUnique({ where: { userId: user.id }, include: { client: true } });
  if (!contact?.portalAccess) return <p className="p-10 text-center text-sm">Your portal access has been turned off. Contact your account manager.</p>;
  const [projects, approvals, files, invoices] = await Promise.all([
    db.project.findMany({ where: { clientId: contact.clientId }, include: { company: true, members: { include: { user: { select: { name: true } } } } }, orderBy: { startDate: "desc" } }),
    db.approval.findMany({ where: { project: { clientId: contact.clientId } }, include: { project: { select: { name: true } }, file: true }, orderBy: { requestedAt: "desc" }, take: 20 }),
    db.file.findMany({ where: { clientId: contact.clientId, deletedAt: null, sharedWithPortal: true }, orderBy: { updatedAt: "desc" }, take: 20 }),
    db.invoice.findMany({ where: { clientId: contact.clientId, status: { not: "DRAFT" } }, orderBy: { issueDate: "desc" }, take: 20 }),
  ]);
  const brand = projects.every((p) => p.companyId === "vth") ? "vth" : "vmh";
  return (
    <div data-scope={brand} className="min-h-screen bg-page">
      <header className="flex h-16 items-center justify-between bg-sidebar-bg px-6">
        <Logo subtitle={brand === "vth" ? "TECH HOUSE" : "MEDIA HOUSE"} />
        <span className="text-sm text-sidebar-text">{contact.name} · {contact.client.name}</span>
      </header>
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <h1 className="text-3xl font-bold text-ink">Welcome, {contact.name.split(" ")[0]}</h1>
        <SectionCard title="Your projects">
          {projects.length === 0 && <EmptyState title="No projects yet" />}
          <ul className="divide-y">
            {projects.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-4 py-3 text-sm">
                <span className="min-w-0 flex-1 font-semibold text-ink">{p.name} <span className="font-normal text-ink-muted">· {p.company.name}</span></span>
                <EnumPill map={PROJECT_STATUS} value={p.status} />
                <span className="w-32"><ProgressBar value={p.progress} /></span>
                <span className="text-xs text-ink-muted">{p.dueDate ? `Due ${formatDate(p.dueDate)}` : ""}</span>
                <span className="text-xs text-ink-muted">Manager: {p.members[0]?.user.name ?? "–"}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Deliverables to review">
          {approvals.length === 0 && <EmptyState title="Nothing to review" />}
          <ul className="divide-y">
            {approvals.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="min-w-0 flex-1"><b>{a.title}</b> <span className="text-ink-muted">· {a.project.name} · sent {formatDate(a.requestedAt)}</span></span>
                {a.status === "PENDING" ? <ApprovalButtons id={a.id} /> : <EnumPill map={APPROVAL_STATUS} value={a.status} dot={false} />}
              </li>
            ))}
          </ul>
        </SectionCard>
        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard title="Files shared with you">
            {files.length === 0 && <EmptyState title="No shared files" />}
            {files.map((f) => (
              <a key={f.id} href={`/api/files/${f.id}/download`} className="flex items-center gap-3 py-1.5 text-xs hover:underline">
                <FileIcon ext={f.ext} size={26} /><span className="flex-1 truncate">{f.name}</span><span className="text-ink-muted">{formatFileSize(f.size)}</span>
              </a>
            ))}
          </SectionCard>
          <SectionCard title="Invoices">
            {invoices.length === 0 && <EmptyState title="No invoices" />}
            {invoices.map((i) => (
              <div key={i.id} className="flex items-center gap-3 py-1.5 text-xs">
                <span className="w-20 font-semibold">#{i.number}</span><span className="flex-1 text-ink-muted">Due {formatDate(i.dueDate)}</span>
                <EnumPill map={INVOICE_STATUS} value={i.status} size="xs" /><span className="w-24 text-right">{formatINR(i.total)}</span>
              </div>
            ))}
          </SectionCard>
        </div>
        <Card className="p-4 text-xs text-ink-muted">Questions? Reply to any email from your project manager.</Card>
      </main>
    </div>
  );
}
