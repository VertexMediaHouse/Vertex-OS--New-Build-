// Ported from app/(app)/settings/page.tsx.
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "@/lib/nav";
import { CardSkeleton, KeyValue, PageHeader } from "@/components/shared/layout";
import { UnderlineTabs } from "@/components/shared/nav";
import { StatusPill } from "@/components/shared/pills";
import { SectionCard } from "@/components/shared/primitives";
import { CompanyForm, ModuleAccess, ProfileForm } from "@/components/settings/settings-client";
import Link from "@/components/ui/link";
import { RESOURCE_LABELS } from "@/lib/auth/permissions";
import { API_URL, api, query } from "@/web/api";
import { useTitle } from "@/web/title";

export default function SettingsPage() {
  useTitle("Settings");
  const [params] = useSearchParams();
  const tab = params.get("tab") ?? "profile";
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => query(api.api.settings.$get()) });

  if (!data) return <CardSkeleton className="h-96" />;
  if (!data.allowed) return <p className="p-6 text-sm text-ink-2">You don&apos;t have access to settings.</p>;

  const on = (b: boolean, yes: string, no: string) => <StatusPill label={b ? yes : no} tone={b ? "success" : "neutral"} />;
  return (
    <div className="space-y-3.5">
      <PageHeader title="Settings" subtitle="Your profile, company details and how the system behaves." />
      <UnderlineTabs active={tab} tabs={[{ value: "profile", label: "Profile" }, ...(data.editable.length ? [{ value: "companies", label: "Companies" }] : []), { value: "users", label: "Users & Roles" }, { value: "integrations", label: "Integrations" }, { value: "export", label: "Data export" }]} />
      {tab === "profile" && <SectionCard title="Profile"><ProfileForm name={data.me.name} timezone={data.me.timezone} /></SectionCard>}
      {tab === "companies" && data.companies.map((c) => <SectionCard key={c.id} title={c.name}><CompanyForm c={c} /></SectionCard>)}
      {tab === "users" && (
        <SectionCard title="Users & Roles">
          <p className="text-sm text-ink-2">Invite people, set their company roles and weekly capacity on the <Link href="/team" className="text-brand-text hover:underline">Team</Link> page. Roles: Admin (everything in that company), Manager (run work, approve time, no settings), Member (own tasks and time). Clients get portal access from a project&apos;s Client Access tab.</p>
          {data.editable.length > 0 && (
            <div className="mt-4 space-y-4 border-t pt-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">Module access</h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Tick the modules someone may open. Leaving all of them ticked keeps their role&apos;s defaults. This narrows a role, it never widens one, and what they see inside a module is still limited to the clients, projects and tasks they are on.
                </p>
              </div>
              {data.staff.length === 0 && <p className="text-xs text-ink-muted">Nobody to set up yet.</p>}
              {data.staff.map((u) => (
                <div key={u.id} className="space-y-2">
                  <p className="text-xs font-semibold text-ink">{u.name} <span className="font-normal text-ink-muted">· {u.email}</span></p>
                  {u.memberships.filter((m: any) => data.editable.includes(m.companyId)).map((m: any) => (
                    <ModuleAccess
                      key={m.companyId}
                      userId={u.id}
                      companyId={m.companyId}
                      companyName={data.companies.find((c) => c.id === m.companyId)?.name ?? m.companyId.toUpperCase()}
                      role={m.role}
                      modules={m.modules}
                      resources={data.resources.map((r) => ({ value: r, label: RESOURCE_LABELS[r] }))}
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
            ["Email sending", on(data.integrations.email, "Resend connected", "Not set: emails print to the server log")],
            ["File storage", <StatusPill key="s" label={data.integrations.storageDriver === "s3" ? "S3-compatible storage" : "Local disk (.data/files)"} tone={data.integrations.storageDriver === "s3" ? "success" : "warning"} />],
            ["Google sign-in", on(data.integrations.google, "Enabled", "Not configured")],
            ["Google Calendar sync", <StatusPill key="g" label="Not built yet (backlog)" tone="neutral" />],
          ]} />
          <p className="mt-3 text-2xs text-ink-muted">These are configured with environment variables; see .env.example.</p>
        </SectionCard>
      )}
      {tab === "export" && (
        <SectionCard title="Data export">
          {/* Plain <a>: these are file downloads from the API, not pages. */}
          <ul className="space-y-2 text-sm">
            <li><a href={`${API_URL}/api/clients/export`} className="text-brand-text hover:underline">Clients (CSV)</a></li>
            <li><a href={`${API_URL}/api/time/export?range=quarter`} className="text-brand-text hover:underline">Timesheet, this quarter (CSV)</a></li>
            <li><a href={`${API_URL}/api/reports/export`} className="text-brand-text hover:underline">Monthly report (CSV)</a></li>
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
