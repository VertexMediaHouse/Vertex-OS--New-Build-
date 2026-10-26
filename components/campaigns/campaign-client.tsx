"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/nav";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/layout";
import { api, call } from "@/web/api";

type Step = { subject: string; body: string; delayDays: number };

const createCampaign = (json: Record<string, unknown>) => call(api.api.campaigns.$post({ json }));
const setCampaignStatus = (campaignId: string, status: "ACTIVE" | "PAUSED" | "COMPLETED") => call(api.api.campaigns.status.$post({ json: { campaignId, status } }));
const markRecipient = (recipientId: string, what: "replied" | "meeting") => call(api.api.campaigns.recipient.$post({ json: { recipientId, what } }));

export function CampaignBuilder({ companies }: { companies: ("vmh" | "vth")[] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [companyId, setCompany] = useState<string>(companies.length > 1 ? "" : companies[0]!);
  const [source, setSource] = useState<"leads" | "clients">("leads");
  const [stages, setStages] = useState<string[]>(["NEW", "CONTACTED"]);
  const [tags, setTags] = useState("");
  const [scheduledAt, setScheduled] = useState("");
  const [steps, setSteps] = useState<Step[]>([{ subject: "", body: "Hi {{firstName}},\n\n", delayDays: 0 }, { subject: "Re: following up", body: "Hi {{firstName}}, just checking in.", delayDays: 3 }]);
  const patch = (i: number, p: Partial<Step>) => setSteps((s) => s.map((x, n) => (n === i ? { ...x, ...p } : x)));
  const submit = (activate: boolean) => start(async () => {
    const r = await createCampaign({ name, companyId, audience: { source, companies: companyId ? [companyId.toUpperCase() as "VMH"] : [], stages: source === "leads" ? stages : [], tags: tags.split(",").map((t) => t.trim()).filter(Boolean) }, steps, scheduledAt: scheduledAt || undefined, activate });
    if (!r.ok) return void toast.error(r.error);
    toast.success(activate ? "Campaign started." : "Draft saved.");
    await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    navigate(`/campaigns?id=${r.id}`);
  });
  const sel = "h-9 w-full rounded-lg border bg-card px-2 text-sm";
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="space-y-4 rounded-xl border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Campaign name" className="space-y-1"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Company" className="space-y-1"><select className={sel} value={companyId} onChange={(e) => setCompany(e.target.value)}>{companies.length > 1 && <option value="">Both companies</option>}{companies.map((c) => <option key={c} value={c}>{c === "vmh" ? "Vertex Media House" : "Vertex Tech House"}</option>)}</select></Field>
        </div>
        <h3 className="text-sm font-semibold text-ink">Sequence</h3>
        {steps.map((s, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold">Email {i + 1}</span>
              {i > 0 && <>· send <Input type="number" min={0} value={s.delayDays} onChange={(e) => patch(i, { delayDays: Number(e.target.value) })} className="h-7 w-16" aria-label="Delay days" /> days after the previous one, unless they reply</>}
              {i > 0 && <button type="button" onClick={() => setSteps((x) => x.filter((_, n) => n !== i))} className="ml-auto text-ink-muted hover:text-danger-text" aria-label="Remove step"><Trash2 className="size-4" /></button>}
            </div>
            <Input value={s.subject} onChange={(e) => patch(i, { subject: e.target.value })} placeholder="Subject" aria-label="Subject" />
            <Textarea rows={4} value={s.body} onChange={(e) => patch(i, { body: e.target.value })} aria-label="Body" />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setSteps((x) => [...x, { subject: "", body: "", delayDays: 3 }])}><Plus className="size-4" /> Add follow-up</Button>
        <p className="text-2xs text-ink-muted">Merge fields: {"{{firstName}}"}, {"{{name}}"}, {"{{company}}"}.</p>
      </div>
      <div className="h-fit space-y-3 rounded-xl border bg-card p-5 text-sm">
        <h3 className="font-semibold text-ink">Audience</h3>
        <select className={sel} value={source} onChange={(e) => setSource(e.target.value as "leads")}><option value="leads">Leads</option><option value="clients">Clients (primary contacts)</option></select>
        {source === "leads" ? (
          <div className="flex flex-wrap gap-2 text-xs">{["NEW", "CONTACTED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"].map((s) => <label key={s} className="flex items-center gap-1"><input type="checkbox" checked={stages.includes(s)} onChange={(e) => setStages((x) => (e.target.checked ? [...x, s] : x.filter((y) => y !== s)))} />{s[0] + s.slice(1).toLowerCase()}</label>)}</div>
        ) : (
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-separated, optional)" />
        )}
        <Field label="Start sending at (optional)" className="space-y-1"><Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduled(e.target.value)} /></Field>
        <Button className="w-full" disabled={pending || !name || !steps[0]?.subject} onClick={() => submit(true)}>Start campaign</Button>
        <Button className="w-full" variant="outline" disabled={pending || !name} onClick={() => submit(false)}>Save draft</Button>
      </div>
    </div>
  );
}

export function CampaignStatusButtons({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const queryClient = useQueryClient();
  const go = (s: "ACTIVE" | "PAUSED" | "COMPLETED") => start(async () => { await setCampaignStatus(id, s); toast.success("Updated."); await queryClient.invalidateQueries({ queryKey: ["campaigns"] }); });
  return (
    <div className="flex gap-2">
      {status !== "ACTIVE" && status !== "COMPLETED" && <Button size="sm" disabled={pending} onClick={() => go("ACTIVE")}>Start</Button>}
      {status === "ACTIVE" && <Button size="sm" variant="outline" disabled={pending} onClick={() => go("PAUSED")}>Pause</Button>}
      {status !== "COMPLETED" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => go("COMPLETED")}>Finish</Button>}
    </div>
  );
}

export function RecipientButtons({ id, replied, meeting }: { id: string; replied: boolean; meeting: boolean }) {
  const [pending, start] = useTransition();
  const queryClient = useQueryClient();
  const mark = (what: "replied" | "meeting") => start(async () => { await markRecipient(id, what); await queryClient.invalidateQueries({ queryKey: ["campaigns"] }); });
  return (
    <span className="flex gap-2 text-2xs">
      {!replied && <button disabled={pending} onClick={() => mark("replied")} className="text-brand-text hover:underline">Mark replied</button>}
      {!meeting && <button disabled={pending} onClick={() => mark("meeting")} className="text-brand-text hover:underline">Meeting booked</button>}
    </span>
  );
}
