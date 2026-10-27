// Ported from app/(app)/clients/[id]/page.tsx.
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { Globe, Mail, Phone } from "lucide-react";
import { ActivityRow, FileIcon } from "@/components/shared/display";
import { CardSkeleton, EmptyState, KeyValue } from "@/components/shared/layout";
import { CompanyBadges, EnumPill } from "@/components/shared/pills";
import { Avatar, Card, ProgressBar, SectionCard } from "@/components/shared/primitives";
import { ClientFormDialog } from "@/components/clients/client-form";
import Link from "@/components/ui/link";
import { now } from "@/lib/clock";
import { formatDate, formatFileSize, formatINR, formatRelative } from "@/lib/format";
import { CLIENT_STATUS, INVOICE_STATUS, PROJECT_STATUS } from "@/lib/status";
import { api, query } from "@/web/api";
import { useTitle } from "@/web/title";

export default function ClientDetailPage() {
  const { id = "" } = useParams();
  const { data } = useQuery({ queryKey: ["clients", "detail", id], queryFn: () => query(api.api.clients[":id"].$get({ param: { id } })) });
  useTitle(data?.client.name ?? "Client");

  if (!data) return <CardSkeleton className="h-96" />;
  const { client, activity, notes, owners, color, billed, editable, editableCompanies } = data;
  const t = now();
  const codes = client.companies.map((c: any) => (c.companyId === "vmh" ? "VMH" : "VTH") as "VMH" | "VTH").sort();
  const revenue = client.projects.reduce((a: any, p: any) => a + Number(p.value), 0);

  return (
    <div className="space-y-3.5">
      <p className="text-xs text-ink-muted"><Link href="/clients" className="hover:underline">Clients</Link> › {client.name}</p>
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <span className="inline-flex size-14 items-center justify-center rounded-xl text-2xl font-bold" style={{ background: `${color}1F`, color }}>{client.name[0]}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-ink">{client.name}</h1>
            <CompanyBadges codes={codes} />
            <EnumPill map={CLIENT_STATUS} value={client.status} />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">{client.domain && <><Globe className="size-3.5" />{client.domain} · </>}{client.type}</p>
        </div>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div><p className="text-xl font-bold text-ink">{client.projects.length}</p><p className="text-2xs text-ink-muted">Projects</p></div>
          <div><p className="text-xl font-bold text-ink">{formatINR(revenue)}</p><p className="text-2xs text-ink-muted">Project value</p></div>
          <div><p className="text-xl font-bold text-ink">{formatINR(billed)}</p><p className="text-2xs text-ink-muted">Invoiced</p></div>
        </div>
        {editable && (
          <ClientFormDialog
            // Every company the user may edit, so a company can be added here too.
            companies={editableCompanies}
            owners={owners}
            client={{ id: client.id, name: client.name, domain: client.domain ?? "", type: client.type ?? "", status: client.status as "ACTIVE", companies: client.companies.map((c: any) => c.companyId as "vmh"), ownerId: client.ownerId ?? "", tags: client.tags, notes: client.notes ?? "", address: client.address ?? "" }}
          />
        )}
      </Card>

      <div className="grid gap-3.5 xl:grid-cols-3">
        <SectionCard title="Overview">
          <KeyValue rows={[["Owner", client.owner?.name ?? "–"], ["Companies", <CompanyBadges key="c" codes={codes} />], ["Billing address", client.address ?? "–"], ["Tags", client.tags.join(", ") || "–"], ["Client since", formatDate(new Date(client.createdAt))], ["Last activity", formatRelative(new Date(client.lastActivityAt), t)]]} />
          {client.notes && <p className="mt-3 rounded-lg bg-surface-muted p-3 text-xs text-ink-2">{client.notes}</p>}
        </SectionCard>
        <SectionCard title="Contacts">
          {client.contacts.length === 0 && <EmptyState title="No contacts yet" />}
          <ul className="space-y-3">
            {client.contacts.map((c: any) => (
              <li key={c.id} className="flex items-start gap-3">
                <Avatar person={c} size={32} />
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-ink">{c.name} {c.isPrimary && <span className="ml-1 text-2xs font-normal text-brand-text">Primary</span>}</p>
                  <p className="text-ink-muted">{c.title}</p>
                  {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-brand-text hover:underline"><Mail className="size-3" />{c.email}</a>}
                  {c.phone && <p className="flex items-center gap-1 text-ink-2"><Phone className="size-3" />{c.phone}</p>}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Notes">
          {notes.length === 0 && <EmptyState title="No notes yet" />}
          {notes.map((n) => <ActivityRow key={n.id} person={n.author} text={n.body} time={formatRelative(new Date(n.createdAt), t)} />)}
        </SectionCard>
      </div>

      <div className="grid gap-3.5 xl:grid-cols-2">
        <SectionCard title="Projects" href={`/projects?client=${client.id}`}>
          {client.projects.length === 0 && <EmptyState title="No projects yet" />}
          <ul className="divide-y">
            {client.projects.map((p: any) => (
              <li key={p.id} className="flex items-center gap-3 py-2 text-xs">
                <Link href={`/projects?id=${p.id}&company=${p.companyId}`} className="min-w-0 flex-1 truncate font-semibold text-ink hover:underline">{p.name}</Link>
                <CompanyBadges codes={[p.companyId === "vmh" ? "VMH" : "VTH"]} />
                <EnumPill map={PROJECT_STATUS} value={p.status} size="xs" />
                <span className="w-20"><ProgressBar value={p.progress} /></span>
                <span className="w-16 text-right tabular">{formatINR(p.value)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Invoices" href={`/invoices?client=${client.id}`}>
          {client.invoices.length === 0 && <EmptyState title="No invoices yet" />}
          <ul className="divide-y">
            {client.invoices.map((i: any) => (
              <li key={i.id} className="flex items-center gap-3 py-2 text-xs">
                <Link href={`/invoices?id=${i.id}`} className="w-20 font-semibold text-ink hover:underline">#{i.number}</Link>
                <span className="flex-1 text-ink-muted">{formatDate(new Date(i.issueDate))}</span>
                <EnumPill map={INVOICE_STATUS} value={i.status} size="xs" />
                <span className="w-24 text-right tabular">{formatINR(i.total)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Files" href={`/files?client=${client.id}`}>
          {client.files.length === 0 && <EmptyState title="No files yet" />}
          <ul className="divide-y">
            {client.files.map((f: any) => (
              <li key={f.id} className="flex items-center gap-3 py-2 text-xs">
                <FileIcon ext={f.ext} size={26} />
                <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
                <span className="text-ink-muted">{formatFileSize(f.size)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Activity">
          {activity.length === 0 && <EmptyState title="No activity yet" />}
          {activity.map((a) => <ActivityRow key={a.id} person={a.actor ?? undefined} text={a.summary} time={formatRelative(new Date(a.createdAt), t)} />)}
        </SectionCard>
      </div>
    </div>
  );
}
