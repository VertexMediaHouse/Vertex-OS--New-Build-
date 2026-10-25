"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createInvoice, recordPayment, sendReminder, setInvoiceState } from "@/app/(app)/invoices/actions";
import { invoiceTotals } from "@/lib/invoices/status";
import { addDays } from "@/lib/clock";
import { dayKey } from "@/lib/period";
import { formatMoney } from "@/lib/format";
import { Field } from "@/components/shared/layout";

export function InvoiceActions({ id, status, balance, currency }: { id: string; status: string; balance: number; currency: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const run = (fn: () => Promise<unknown>, ok: string) => start(async () => {
    const r = (await fn()) as { ok: boolean; error?: string } | undefined;
    if (r && !r.ok) return void toast.error(r.error);
    toast.success(ok);
  });
  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" ? (
        <Button disabled={pending} onClick={() => run(() => setInvoiceState(id, "SEND"), "Invoice sent.")} className="bg-brand-strong hover:bg-brand-strong/90"><Send className="size-4" /> Mark as Sent</Button>
      ) : (
        <Button disabled={pending || status === "PAID" || status === "CANCELLED"} onClick={() => run(() => sendReminder(id), "Reminder sent.")} className="bg-brand-strong hover:bg-brand-strong/90"><Send className="size-4" /> Send Reminder</Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button variant="outline" disabled={status === "PAID" || status === "CANCELLED" || status === "DRAFT"}><CreditCard className="size-4" /> Record Payment</Button></DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
          <form className="space-y-3 text-sm" onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
            start(async () => {
              const r = await recordPayment(id, { amount: Number(f.amount), date: new Date(f.date!), method: f.method as "UPI", reference: f.reference });
              if (!r.ok) return void toast.error(r.error);
              toast.success("Payment recorded."); setOpen(false);
            });
          }}>
            <Field label={<>Amount ({currency}) · balance {formatMoney(balance, currency)}</>} className="space-y-1"><Input name="amount" type="number" step="0.01" min={0.01} max={balance} defaultValue={balance} required /></Field>
            <Field label="Date" className="space-y-1"><Input name="date" type="date" defaultValue={dayKey(new Date())} required /></Field>
            <Field label="Method" className="space-y-1"><select name="method" className="h-9 w-full rounded-lg border bg-card px-2">{[["BANK_TRANSFER", "Bank transfer"], ["UPI", "UPI"], ["CARD", "Card"], ["PAYPAL", "PayPal"], ["WISE", "Wise"], ["CASH", "Cash"], ["OTHER", "Other"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="Reference" className="space-y-1"><Input name="reference" placeholder="UTR / transaction id" /></Field>
            <DialogFooter><Button type="submit" disabled={pending}>Save payment</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {status !== "PAID" && status !== "CANCELLED" && <Button variant="ghost" disabled={pending} onClick={() => confirm("Cancel this invoice?") && run(() => setInvoiceState(id, "CANCEL"), "Invoice cancelled.")}>Cancel invoice</Button>}
    </div>
  );
}

type Line = { description: string; qty: number; rate: number };
type Entry = { id: string; label: string; hours: number; projectId: string | null };

export function InvoiceBuilder({ companies, clients, projects, entries, defaults }: {
  companies: { id: "vmh" | "vth"; name: string; taxRate: number; terms: number; hourlyRate: number }[];
  clients: { id: string; name: string; companyIds: string[] }[];
  projects: { id: string; name: string; clientId: string | null; companyId: string; value: number; billing: string }[];
  entries: (Entry & { companyId: string; clientId: string | null })[];
  defaults: { companyId?: string; projectId?: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const firstProject = projects.find((p) => p.id === defaults.projectId);
  const [companyId, setCompany] = useState<"vmh" | "vth">((firstProject?.companyId as "vmh") ?? (defaults.companyId as "vmh") ?? companies[0]!.id);
  const co = companies.find((c) => c.id === companyId)!;
  const [clientId, setClient] = useState(firstProject?.clientId ?? "");
  const [projectId, setProject] = useState(firstProject?.id ?? "");
  const [issue, setIssue] = useState(() => dayKey(new Date()));
  const [due, setDue] = useState(() => dayKey(addDays(new Date(), co.terms)));
  // shortcut: INR only. Every revenue total sums invoice amounts without converting, so a
  // USD invoice would be counted as rupees. Add a stored exchange rate before billing in USD.
  const currency = "INR";
  const [taxRate, setTax] = useState(co.taxRate);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>(firstProject ? [{ description: firstProject.name, qty: 1, rate: firstProject.value }] : [{ description: "", qty: 1, rate: 0 }]);
  const [picked, setPicked] = useState<string[]>([]);
  const rate = co.hourlyRate;
  const clientEntries = entries.filter((e) => e.companyId === companyId && e.clientId === clientId);
  const totals = useMemo(() => invoiceTotals(lines, taxRate, discount), [lines, taxRate, discount]);
  const patch = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, n) => (n === i ? { ...l, ...p } : l)));
  const addTime = () => {
    const chosen = clientEntries.filter((e) => picked.includes(e.id));
    if (!chosen.length) return;
    const hours = Math.round(chosen.reduce((a, e) => a + e.hours, 0) * 100) / 100;
    setLines((ls) => [...ls.filter((l) => l.description), { description: `Approved billable time (${chosen.length} entries)`, qty: hours, rate }]);
  };
  const submit = (draft: boolean) => start(async () => {
    const r = await createInvoice({ companyId, clientId, projectId, issueDate: new Date(issue), dueDate: new Date(due), currency, taxRate, discount, notes: notes || `Thank you for your business. Payment is due by ${new Date(due).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.`, draft, lines, timeEntryIds: picked });
    if (!r.ok) return void toast.error(r.error);
    toast.success(draft ? "Draft saved." : "Invoice created.");
    router.push(`/invoices?id=${r.id}`);
  });
  const sel = "h-9 w-full rounded-lg border bg-card px-2 text-sm";
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="space-y-4 rounded-xl border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Company"><select className={sel} value={companyId} onChange={(e) => { setCompany(e.target.value as "vmh"); setClient(""); setProject(""); }}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Client"><select className={sel} value={clientId} onChange={(e) => { setClient(e.target.value); setProject(""); }} required><option value="">Choose…</option>{clients.filter((c) => c.companyIds.includes(companyId)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Project"><select className={sel} value={projectId} onChange={(e) => setProject(e.target.value)}><option value="">None</option>{projects.filter((p) => p.clientId === clientId && p.companyId === companyId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Issue date"><Input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} /></Field>
          <Field label="Due date"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          <Field label="Currency"><Input value="INR" readOnly /></Field>
        </div>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-ink-2">{["Description", "Qty", "Rate", "Amount", ""].map((h) => <th key={h} className="bg-surface-muted px-2 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b">
                <td className="px-1 py-1"><Input value={l.description} onChange={(e) => patch(i, { description: e.target.value })} aria-label="Description" /></td>
                <td className="w-20 px-1 py-1"><Input type="number" min={0} step="0.25" value={l.qty} onChange={(e) => patch(i, { qty: Number(e.target.value) })} aria-label="Quantity" /></td>
                <td className="w-32 px-1 py-1"><Input type="number" min={0} value={l.rate} onChange={(e) => patch(i, { rate: Number(e.target.value) })} aria-label="Rate" /></td>
                <td className="w-28 px-2 py-1 text-right tabular">{formatMoney(l.qty * l.rate, currency)}</td>
                <td className="w-8"><button type="button" onClick={() => setLines((ls) => ls.filter((_, n) => n !== i))} aria-label="Remove line" className="p-1 text-ink-muted hover:text-danger-text"><Trash2 className="size-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { description: "", qty: 1, rate: 0 }])}><Plus className="size-4" /> Add line</Button>
        {clientEntries.length > 0 && (
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-sm font-semibold text-ink">Approved billable time not yet invoiced</p>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {clientEntries.map((e) => <label key={e.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={picked.includes(e.id)} onChange={(ev) => setPicked((p) => (ev.target.checked ? [...p, e.id] : p.filter((x) => x !== e.id)))} />{e.label} · {e.hours}h</label>)}
            </div>
            <Button size="sm" className="mt-2" variant="outline" onClick={addTime} disabled={!picked.length}>Add selected time as a line (₹{rate}/h)</Button>
          </div>
        )}
        <Field label="Notes"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Thank you for your business…" /></Field>
      </div>
      <div className="h-fit space-y-3 rounded-xl border bg-card p-5 text-sm">
        <Field label="GST / tax %"><Input type="number" min={0} max={100} value={taxRate} onChange={(e) => setTax(Number(e.target.value))} /></Field>
        <p className="text-2xs text-ink-muted">Intra-state supplies split this into CGST + SGST; inter-state is IGST. GSTIN comes from company settings.</p>
        <Field label="Discount"><Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></Field>
        <div className="space-y-1 border-t pt-3">
          <Row k="Subtotal" v={formatMoney(totals.subtotal, currency)} />
          {discount > 0 && <Row k="Discount" v={`- ${formatMoney(discount, currency)}`} />}
          <Row k={`Tax (${taxRate}%)`} v={formatMoney(totals.taxAmount, currency)} />
          <Row k="Total" v={formatMoney(totals.total, currency)} bold />
        </div>
        <Button className="w-full bg-brand-strong hover:bg-brand-strong/90" disabled={pending || !clientId} onClick={() => submit(false)}>Create Invoice</Button>
        <Button className="w-full" variant="outline" disabled={pending || !clientId} onClick={() => submit(true)}>Save as Draft</Button>
      </div>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className={`flex justify-between ${bold ? "font-bold text-ink" : "text-ink-2"}`}><span>{k}</span><span className="tabular">{v}</span></div>;
}
