import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getRequestContext } from "@/lib/auth/context";
import { can, RESOURCES, RESOURCE_LABELS } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { parseCompanySettings } from "@/lib/settings";
import { storageDriver } from "@/lib/storage";
import { googleEnabled } from "@/lib/auth/server";
import { readParams, type SP } from "@/lib/search-params";
import { SectionCard } from "@/components/shared/primitives";
import { CardSkeleton, KeyValue, PageHeader } from "@/components/shared/layout";
import { UnderlineTabs } from "@/components/shared/nav";
import { StatusPill } from "@/components/shared/pills";
import { CompanyForm, ModuleAccess, ProfileForm } from "@/components/settings/settings-client";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return <Suspense fallback={<CardSkeleton className="h-96" />}><Settings searchParams={searchParams} /></Suspense>;
}

async function Settings({ searchParams }: { searchParams: Promise<SP> }) {
  const [ctx, sp] = await Promise.all([getRequestContext(), searchParams]);
  if (!can(ctx.user, "view", "settings")) return <p className="p-6 text-sm text-ink-2">You don&apos;t have access to settings.</p>;
  const tab = readParams(sp).str("tab") ?? "profile";
  const me = await db.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
  const editable = ctx.companyIds.filter((c) => can(ctx.user, "update", "settings", c));
  const companies = await db.company.findMany({ where: { id: { in: editable } }, orderBy: { code: "asc" } });
  // Everyone an admin could narrow: staff in a company they control, minus themselves and the owner.
  const staff = editable.length
    ? await db.user.findMany({
        where: { kind: "STAFF", isOwner: false, id: { not: ctx.user.id }, memberships: { some: { companyId: { in: editable } } } },
        select: { id: true, name: true, email: true, memberships: { select: { companyId: true, role: true, modules: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const on = (b: boolean, yes: string, no: string) => <StatusPill label={b ? yes : no} tone={b ? "success" : "neutral"} />;
  return (
    <div className="space-y-3.5">
      <PageHeader title="Settings" subtitle="Your profile, company details and how the system behaves." />
      <UnderlineTabs active={tab} tabs={[{ value: "profile", label: "Profile" }, ...(editable.length ? [{ value: "companies", label: "Companies" }] : []), { value: "users", label: "Users & Roles" }, { value: "integrations", label: "Integrations" }, { value: "export", label: "Data export" }]} />
      {tab === "profile" && <SectionCard title="Profile"><ProfileForm name={me.name} timezone={me.timezone} /></SectionCard>}
      {tab === "companies" && companies.map((c) => {
        const bank = (c.bankDetails ?? {}) as Record<string, string | undefined>;
        return <SectionCard key={c.id} title={c.name}><CompanyForm c={{ id: c.id, name: c.name, address: c.address, gstin: c.gstin, invoicePrefix: c.invoicePrefix, nextInvoiceNumber: c.nextInvoiceNumber, currency: c.currency, bank, settings: parseCompanySettings(c.settings) }} /></SectionCard>;
      })}
      {tab === "users" && (
        <SectionCard title="Users & Roles">
          <p className="text-sm text-ink-2">Invite people, set their company roles and weekly capacity on the <Link href="/team" className="text-brand-text hover:underline">Team</Link> page. Roles: Admin (everything in that company), Manager (run work, approve time, no settings), Member (own tasks and time). Clients get portal access from a project&apos;s Client Access tab.</p>
          {editable.length > 0 && (
            <div className="mt-4 space-y-4 border-t pt-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">Module access</h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Tick the modules someone may open. Leaving all of them ticked keeps their role&apos;s defaults. This narrows a role, it never widens one, and what they see inside a module is still limited to the clients, projects and tasks they are on.
                </p>
              </div>
              {staff.length === 0 && <p className="text-xs text-ink-muted">Nobody to set up yet.</p>}
              {staff.map((u) => (
                <div key={u.id} className="space-y-2">
                  <p className="text-xs font-semibold text-ink">{u.name} <span className="font-normal text-ink-muted">· {u.email}</span></p>
                  {u.memberships.filter((m) => editable.includes(m.companyId)).map((m) => (
                    <ModuleAccess
                      key={m.companyId}
                      userId={u.id}
                      companyId={m.companyId}
                      companyName={companies.find((c) => c.id === m.companyId)?.name ?? m.companyId.toUpperCase()}
                      role={m.role}
                      modules={m.modules}
                      resources={RESOURCES.map((r) => ({ value: r, label: RESOURCE_LABELS[r] }))}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
      {tab === "integrations" && (
        <SectionCard title="Integrations">
          <KeyValue labelWidth={180} rows={[
            ["Email sending", on(Boolean(process.env.RESEND_API_KEY), "Resend connected", "Not set: emails print to the server log")],
            ["File storage", <StatusPill key="s" label={storageDriver === "s3" ? "S3-compatible storage" : "Local disk (.data/files)"} tone={storageDriver === "s3" ? "success" : "warning"} />],
            ["Google sign-in", on(googleEnabled, "Enabled", "Not configured")],
            ["Google Calendar sync", <StatusPill key="g" label="Not built yet (backlog)" tone="neutral" />],
          ]} />
          <p className="mt-3 text-2xs text-ink-muted">These are configured with environment variables; see .env.example.</p>
        </SectionCard>
      )}
      {tab === "export" && (
        <SectionCard title="Data export">
          {/* Plain <a>: these are file downloads, not pages. */}
          {/* eslint-disable @next/next/no-html-link-for-pages */}
          <ul className="space-y-2 text-sm">
            <li><a href="/clients/export" className="text-brand-text hover:underline">Clients (CSV)</a></li>
            <li><a href="/time/export?range=quarter" className="text-brand-text hover:underline">Timesheet, this quarter (CSV)</a></li>
            <li><a href="/reports/export" className="text-brand-text hover:underline">Monthly report (CSV)</a></li>
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
