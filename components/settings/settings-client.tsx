"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, call } from "@/web/api";
import type { CompanySettings } from "@/lib/settings";
import { Field as F } from "@/components/shared/layout";

const updateProfile = (json: { name: string; timezone: string }) => call(api.api.settings.profile.$post({ json }));
const updateCompany = (companyId: string, input: Record<string, unknown>) => call(api.api.settings.company.$post({ json: { companyId, input } }));
const setMemberModules = (userId: string, companyId: string, modules: string[]) => call(api.api.settings.modules.$post({ json: { userId, companyId, modules } }));


export function ProfileForm({ name, timezone }: { name: string; timezone: string }) {
  const [pending, start] = useTransition();
  const queryClient = useQueryClient();
  return (
    <form className="grid max-w-md gap-3" onSubmit={(e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; start(async () => { const r = await updateProfile({ name: f.name!, timezone: f.timezone! }); if (!r.ok) return void toast.error(r.error); toast.success("Profile saved."); await queryClient.invalidateQueries(); }); }}>
      <F label="Name"><Input name="name" defaultValue={name} required /></F>
      <F label="Timezone"><Input name="timezone" defaultValue={timezone} /></F>
      <Button type="submit" disabled={pending} className="w-fit">Save profile</Button>
    </form>
  );
}

export function CompanyForm({ c }: { c: { id: string; name: string; address: string | null; gstin: string | null; invoicePrefix: string; nextInvoiceNumber: number; currency: string; bank: Record<string, string | undefined>; settings: CompanySettings } }) {
  const [pending, start] = useTransition();
  const queryClient = useQueryClient();
  const s = c.settings;
  return (
    <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      const n = (k: string) => Number(f[k]);
      start(async () => {
        const r = await updateCompany(c.id, {
          name: f.name!, address: f.address, gstin: f.gstin, invoicePrefix: f.invoicePrefix!, nextInvoiceNumber: n("nextInvoiceNumber"), currency: f.currency as "INR", upi: f.upi, accountName: f.accountName, accountNumber: f.accountNumber, ifsc: f.ifsc,
          settings: { goalThresholds: { onTrack: n("onTrack") / 100, atRisk: n("atRisk") / 100 }, turnaroundTargetHours: { min: n("tMin"), max: n("tMax") }, revenueBasis: f.revenueBasis as "INVOICED", defaultTaxRate: n("tax"), defaultHourlyRate: n("rate"), paymentTermsDays: n("terms"), defaultWeeklyCapacityHours: n("capacity") },
        });
        if (!r.ok) return void toast.error(r.error);
        toast.success("Company settings saved.");
        await queryClient.invalidateQueries({ queryKey: ["settings"] });
      });
    }}>
      <F label="Name"><Input name="name" defaultValue={c.name} /></F>
      <F label="GSTIN"><Input name="gstin" defaultValue={c.gstin ?? ""} /></F>
      <F label="Default currency"><select name="currency" defaultValue={c.currency} className="h-9 w-full rounded-lg border bg-card px-2 text-sm"><option>INR</option></select></F>
      <F label="Address" className="md:col-span-3"><Input name="address" defaultValue={c.address ?? ""} /></F>
      <F label="Invoice prefix"><Input name="invoicePrefix" defaultValue={c.invoicePrefix} /></F>
      <F label="Next invoice number"><Input name="nextInvoiceNumber" type="number" defaultValue={c.nextInvoiceNumber} /></F>
      <F label="Payment terms (days)"><Input name="terms" type="number" defaultValue={s.paymentTermsDays} /></F>
      <F label="Default GST %"><Input name="tax" type="number" defaultValue={s.defaultTaxRate} /></F>
      <F label="Hourly rate for invoiced time (₹)"><Input name="rate" type="number" defaultValue={s.defaultHourlyRate} /></F>
      <F label="Revenue on dashboard"><select name="revenueBasis" defaultValue={s.revenueBasis} className="h-9 w-full rounded-lg border bg-card px-2 text-sm"><option value="INVOICED">Invoiced in period</option><option value="COLLECTED">Collected in period</option></select></F>
      <F label="UPI ID"><Input name="upi" defaultValue={c.bank.upi ?? ""} /></F>
      <F label="Account name"><Input name="accountName" defaultValue={c.bank.accountName ?? ""} /></F>
      <F label="Account no. / IFSC"><div className="flex gap-2"><Input name="accountNumber" defaultValue={c.bank.accountNumber ?? ""} /><Input name="ifsc" aria-label="IFSC" defaultValue={c.bank.ifsc ?? ""} className="w-28" /></div></F>
      <F label="Goal on track at ≥ % of expected"><Input name="onTrack" type="number" defaultValue={Math.round(s.goalThresholds.onTrack * 100)} /></F>
      <F label="Goal at risk at ≥ % of expected"><Input name="atRisk" type="number" defaultValue={Math.round(s.goalThresholds.atRisk * 100)} /></F>
      <F label="Default weekly capacity (h)"><Input name="capacity" type="number" defaultValue={s.defaultWeeklyCapacityHours} /></F>
      <F label="Turnaround target min (h)"><Input name="tMin" type="number" defaultValue={s.turnaroundTargetHours.min} /></F>
      <F label="Turnaround target max (h)"><Input name="tMax" type="number" defaultValue={s.turnaroundTargetHours.max} /></F>
      <div className="flex items-end"><Button type="submit" disabled={pending}>Save {c.name}</Button></div>
    </form>
  );
}

/**
 * Module access for one person in one company. Nothing ticked means their role decides;
 * ticking some narrows them to those. It cannot give anyone more than their role allows.
 */
export function ModuleAccess({
  userId, companyId, companyName, role, modules, resources,
}: {
  userId: string;
  companyId: string;
  companyName: string;
  role: string;
  modules: string[];
  resources: { value: string; label: string }[];
}) {
  const [pending, start] = useTransition();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string[]>(modules);
  const all = picked.length === 0;
  const toggle = (value: string) =>
    setPicked((p) => (p.includes(value) ? p.filter((x) => x !== value) : [...p, value]));
  return (
    <form
      className="rounded-xl border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setMemberModules(userId, companyId, picked);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Access updated.");
          await queryClient.invalidateQueries({ queryKey: ["settings"] });
        });
      }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs font-semibold text-ink">
          {companyName} <span className="font-normal text-ink-muted">· {role.toLowerCase()}</span>
        </p>
        <p className="text-2xs text-ink-muted">{all ? "Everything their role allows" : `${picked.length} of ${resources.length} modules`}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {resources.map((r) => (
          <label key={r.value} className="flex items-center gap-2 text-xs text-ink-2">
            <input type="checkbox" checked={all || picked.includes(r.value)} onChange={() => toggle(r.value)} />
            {r.label}
          </label>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save access"}</Button>
        {!all && (
          <button type="button" className="text-2xs text-ink-muted hover:underline" onClick={() => setPicked([])}>
            Reset to role defaults
          </button>
        )}
      </div>
    </form>
  );
}
