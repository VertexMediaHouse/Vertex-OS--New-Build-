"use client";

import { useEffect, useState, useTransition } from "react";
import { MoreVertical, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/layout";
import { api, call } from "@/web/api";

/** The call sites below either branch on `ok` or catch a throw, so both shapes stay. */
async function must(p: Promise<Response>) {
  const r = await call(p);
  if (!r.ok) throw new Error(r.error);
}

const startTimer = (json: { projectId: string; taskId?: string; note?: string }) => call(api.api.time.start.$post({ json }));
const stopTimer = () => call(api.api.time.stop.$post());
const addManualEntry = (json: { projectId: string; taskId?: string; date: string; start: string; end: string; note: string; billable: boolean }) => call(api.api.time.entries.$post({ json }));
const setBillable = (entryId: string, billable: boolean) => must(api.api.time.billable.$post({ json: { entryId, billable } }));
const reviewEntries = (ids: string[], decision: "APPROVED" | "REJECTED") => must(api.api.time.review.$post({ json: { ids, decision } }));
const deleteEntry = (entryId: string) => must(api.api.time.delete.$post({ json: { entryId } }));

type Project = { id: string; label: string; tasks: { id: string; title: string }[] };

export function StartTimerPanel({ projects }: { projects: Project[] }) {
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const tasks = projects.find((p) => p.id === projectId)?.tasks ?? [];
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <div className="flex items-center justify-between bg-brand-strong px-4 py-2.5 text-white">
        <span className="flex items-center gap-2 text-base font-semibold"><Play className="size-4 fill-white" /> Start Timer</span>
        <ManualEntryDialog projects={projects} />
      </div>
      <div className="space-y-3 p-4 text-xs">
        <Field label="Select Project" className="space-y-1">
          <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setTaskId(""); }} className="h-9 w-full rounded-lg border bg-card px-2"><option value="">Choose a project...</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        </Field>
        <Field label="Select Task (Optional)" className="space-y-1">
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)} disabled={!tasks.length} className="h-9 w-full rounded-lg border bg-card px-2"><option value="">Choose a task...</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
        </Field>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Add a note (what are you working on?)" aria-label="Note" />
        <Button className="w-full bg-brand-strong hover:bg-brand-strong/90" disabled={!projectId || pending} onClick={() => start(async () => { const r = await startTimer({ projectId, taskId, note }); if (r.ok) { toast.success("Timer started."); setNote(""); } })}>
          <Play className="size-4" /> Start Tracking
        </Button>
      </div>
    </div>
  );
}

function ManualEntryDialog({ projects }: { projects: Project[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [projectId, setProjectId] = useState("");
  const [billable, setBill] = useState(true);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><button className="rounded-md bg-white/15 px-2.5 py-1 text-2xs font-medium hover:bg-white/25">▷ Manual Entry</button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Manual time entry</DialogTitle></DialogHeader>
        <form className="grid grid-cols-3 gap-3 text-sm" onSubmit={(e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          start(async () => {
            const r = await addManualEntry({ projectId, taskId: f.taskId, date: f.date!, start: f.start!, end: f.end!, note: f.note!, billable });
            if (!r.ok) return void toast.error(r.error);
            toast.success("Entry added for approval."); setOpen(false);
          });
        }}>
          <Field label="Project" className="col-span-3 space-y-1"><select required value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-9 w-full rounded-lg border bg-card px-2"><option value="">Choose…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
          <Field label="Task" className="col-span-3 space-y-1"><select name="taskId" className="h-9 w-full rounded-lg border bg-card px-2"><option value="">None</option>{(projects.find((p) => p.id === projectId)?.tasks ?? []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></Field>
          <Field label="Date" className="space-y-1"><Input name="date" type="date" required /></Field>
          <Field label="Start" className="space-y-1"><Input name="start" type="time" required /></Field>
          <Field label="End" className="space-y-1"><Input name="end" type="time" required /></Field>
          <Field label="What did you work on?" className="col-span-3 space-y-1"><Input name="note" required /></Field>
          <label className="col-span-3 flex items-center gap-2 text-xs"><Switch checked={billable} onCheckedChange={setBill} /> Billable</label>
          <DialogFooter className="col-span-3"><Button type="submit" disabled={pending}>Add entry</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BillableToggle({ id, billable, disabled }: { id: string; billable: boolean; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [on, setOn] = useState(billable);
  return <Switch checked={on} disabled={disabled || pending} aria-label="Billable" onCheckedChange={(v) => { setOn(v); start(async () => { try { await setBillable(id, v); } catch (e) { setOn(!v); toast.error(e instanceof Error ? e.message : "Couldn't update."); } }); }} />;
}

export function EntryActions({ id, canApprove }: { id: string; canApprove: boolean }) {
  const [, start] = useTransition();
  const run = (fn: () => Promise<void>, ok: string) => start(async () => { try { await fn(); toast.success(ok); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed."); } });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-md p-1 hover:bg-accent" aria-label="Actions"><MoreVertical className="size-4" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canApprove && <DropdownMenuItem onSelect={() => run(() => reviewEntries([id], "APPROVED"), "Approved.")}>Approve</DropdownMenuItem>}
        {canApprove && <DropdownMenuItem onSelect={() => run(() => reviewEntries([id], "REJECTED"), "Rejected.")}>Reject</DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => run(() => deleteEntry(id), "Deleted.")}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Topbar mini timer: ticks every second while a timer runs. */
export function MiniTimer({ startedAt, label }: { startedAt: string; label: string }) {
  const [nowMs, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((nowMs - new Date(startedAt).getTime()) / 1000));
  const hms = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
  return (
    <div className="hidden items-center gap-2 rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs text-danger-text md:flex" title={label}>
      <span className="size-2 animate-pulse rounded-full bg-danger" aria-hidden />
      <span className="max-w-32 truncate">{label}</span>
      <span className="font-semibold tabular">{hms}</span>
      <button type="button" disabled={pending} onClick={() => start(async () => { await stopTimer(); })} aria-label="Stop timer" className="rounded p-0.5 hover:bg-white/60"><Square className="size-3.5 fill-current" /></button>
    </div>
  );
}
