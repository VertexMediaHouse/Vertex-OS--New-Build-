// Ported from app/portal/page.tsx: the Prisma queries moved to server/routes/portal.ts,
// the render is unchanged apart from parsing ISO dates.
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router";
import { FileIcon } from "@/components/shared/display";
import { CardSkeleton, EmptyState } from "@/components/shared/layout";
import { Logo } from "@/components/shared/logo";
import { EnumPill } from "@/components/shared/pills";
import { Card, ProgressBar, SectionCard } from "@/components/shared/primitives";
import { formatDate, formatFileSize, formatINR } from "@/lib/format";
import { APPROVAL_STATUS, INVOICE_STATUS, PROJECT_STATUS, TASK_STATUS } from "@/lib/status";
import { api, API_URL, query } from "@/web/api";
import { useTitle } from "@/web/title";
import { ApprovalButtons } from "./approval-buttons";

export default function PortalPage() {
  useTitle("Client Portal");
  const { data } = useQuery({ queryKey: ["portal"], queryFn: () => query(api.api.portal.$get()) });

  if (!data) return <div className="p-6"><CardSkeleton className="h-96" /></div>;
  if (data.state === "staff") return <Navigate to="/dashboard" replace />;
  if (data.state === "no-access") return <p className="p-10 text-center text-sm">Your portal access has been turned off. Contact your account manager.</p>;
  if (data.state === "no-projects") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page p-10">
        <p className="max-w-sm text-center text-sm text-ink-2">
          Nothing has been shared with you yet. Your account manager will give you access to a project shortly.
        </p>
      </div>
    );
  }

  const { contact, brand, projects, approvals, files, invoices, tasks } = data;
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
                <span className="text-xs text-ink-muted">{p.dueDate ? `Due ${formatDate(new Date(p.dueDate))}` : ""}</span>
                <span className="text-xs text-ink-muted">Manager: {p.members?.[0]?.user?.name ?? "–"}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Latest updates" subtitle="Where the work stands right now.">
          {tasks.length === 0 && <EmptyState title="No updates yet" />}
          <ul className="divide-y">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1 text-ink">{t.title} <span className="text-ink-muted">· {t.project?.name}</span></span>
                {t.progress > 0 && t.status !== "COMPLETED" && <span className="w-20"><ProgressBar value={t.progress} /></span>}
                <EnumPill map={TASK_STATUS} value={t.status} size="xs" />
                <span className="w-28 text-right text-xs text-ink-muted">
                  {t.status === "COMPLETED" ? (t.completedAt ? `Done ${formatDate(new Date(t.completedAt))}` : "Done") : t.dueDate ? `Due ${formatDate(new Date(t.dueDate))}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Deliverables to review">
          {approvals.length === 0 && <EmptyState title="Nothing to review" />}
          <ul className="divide-y">
            {approvals.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="min-w-0 flex-1"><b>{a.title}</b> <span className="text-ink-muted">· {a.project.name} · sent {formatDate(new Date(a.requestedAt))}</span></span>
                {a.status === "PENDING" ? <ApprovalButtons id={a.id} /> : <EnumPill map={APPROVAL_STATUS} value={a.status} dot={false} />}
              </li>
            ))}
          </ul>
        </SectionCard>
        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard title="Files shared with you">
            {files.length === 0 && <EmptyState title="No shared files" />}
            {files.map((f) => (
              <a key={f.id} href={`${API_URL}/api/files/${f.id}/download`} className="flex items-center gap-3 py-1.5 text-xs hover:underline">
                <FileIcon ext={f.ext} size={26} /><span className="flex-1 truncate">{f.name}</span><span className="text-ink-muted">{formatFileSize(f.size)}</span>
              </a>
            ))}
          </SectionCard>
          <SectionCard title="Invoices">
            {invoices.length === 0 && <EmptyState title="No invoices" />}
            {invoices.map((i) => (
              <div key={i.id} className="flex items-center gap-3 py-1.5 text-xs">
                <span className="w-20 font-semibold">#{i.number}</span><span className="flex-1 text-ink-muted">Due {formatDate(new Date(i.dueDate))}</span>
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
