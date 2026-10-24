"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EnumPill, StatusPill } from "@/components/shared/pills";
import { PROJECT_STATUS } from "@/lib/status";
import { addProjectNote, createProject, inviteContact, requestApproval, revokeContact, setMilestoneStatus, setProjectStatus, updateDeliverable, updateProject } from "@/app/(app)/projects/actions";
import type { ActionResult } from "@/lib/validation/result";
import { Field as L } from "@/components/shared/layout";

function useAction() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, ok?: string) =>
    start(async () => {
      try {
        const res = (await fn()) as ActionResult | undefined;
        if (res && "ok" in res && !res.ok) return void toast.error(res.error);
        if (ok) toast.success(ok);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  return { pending, run };
}

export function ProjectStatusSelect({ projectId, status, statuses }: { projectId: string; status: string; statuses: readonly string[] }) {
  const { pending, run } = useAction();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={pending} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40" aria-label="Change status">
        <EnumPill map={PROJECT_STATUS} value={status} chevron className="h-7 px-3 text-xs" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {statuses.map((s) => (
          <DropdownMenuItem key={s} onSelect={() => run(() => setProjectStatus(projectId, s), "Status updated.")}>
            <EnumPill map={PROJECT_STATUS} value={s} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** VMH deliverable counter (8 / 12) with − / + buttons. */
export function DeliverableStepper({ id, value, max }: { id: string; value: number; max: number }) {
  const { pending, run } = useAction();
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" disabled={pending || value <= 0} onClick={() => run(() => updateDeliverable(id, value - 1))} className="rounded p-0.5 text-ink-muted hover:bg-accent disabled:opacity-30" aria-label="One less"><Minus className="size-3" /></button>
      <button type="button" disabled={pending || value >= max} onClick={() => run(() => updateDeliverable(id, value + 1))} className="rounded p-0.5 text-ink-muted hover:bg-accent disabled:opacity-30" aria-label="One more"><Plus className="size-3" /></button>
    </span>
  );
}

export function PercentInput({ id, value }: { id: string; value: number }) {
  const { pending, run } = useAction();
  return (
    <select aria-label="Percent complete" disabled={pending} defaultValue={value} onChange={(e) => run(() => updateDeliverable(id, Number(e.target.value)))} className="h-6 rounded border bg-card px-1 text-2xs">
      {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => <option key={v} value={v}>{v}%</option>)}
    </select>
  );
}

export function MilestoneToggle({ id, status }: { id: string; status: string }) {
  const { pending, run } = useAction();
  const next = status === "COMPLETED" ? "PENDING" : status === "PENDING" ? "IN_PROGRESS" : "COMPLETED";
  return (
    <button type="button" disabled={pending} onClick={() => run(() => setMilestoneStatus(id, next))} className="text-2xs text-blue hover:underline">
      {status === "COMPLETED" ? "Reopen" : status === "PENDING" ? "Start" : "Complete"}
    </button>
  );
}

export function NoteForm({ projectId }: { projectId: string }) {
  const { pending, run } = useAction();
  const [text, setText] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(async () => { await addProjectNote(projectId, text); setText(""); }, "Note added."); }} className="mt-3 flex gap-2">
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note… use @name to mention" aria-label="New note" />
      <Button type="submit" disabled={pending || !text.trim()}>Post</Button>
    </form>
  );
}

export function RequestApproval({ projectId, files }: { projectId: string; files: { id: string; name: string }[] }) {
  const { pending, run } = useAction();
  const [title, setTitle] = useState("");
  const [fileId, setFileId] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(async () => { await requestApproval(projectId, title, fileId); setTitle(""); }, "Sent for approval."); }} className="flex flex-wrap gap-2">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Deliverable, e.g. Short #4" className="w-56" aria-label="Deliverable" />
      <select value={fileId} onChange={(e) => setFileId(e.target.value)} className="h-9 rounded-lg border bg-card px-2 text-xs" aria-label="File">
        <option value="">No file</option>
        {files.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
      <Button type="submit" disabled={pending || !title.trim()}>Request approval</Button>
    </form>
  );
}

export function PortalAccessButton({ contactId, active }: { contactId: string; active: boolean }) {
  const { pending, run } = useAction();
  return active ? (
    <div className="flex items-center gap-2">
      <StatusPill label="Portal access" tone="success" />
      <button type="button" disabled={pending} onClick={() => run(() => revokeContact(contactId), "Access removed.")} className="text-2xs text-danger-text hover:underline">Revoke</button>
    </div>
  ) : (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => inviteContact(contactId), "Invite sent.")}>Invite to portal</Button>
  );
}

/** Dates are yyyy-mm-dd, the value an <input type="date"> takes. */
export type ProjectFormValues = { id: string; companyId: "vmh" | "vth"; clientId: string; name: string; typeLabel: string; category: string; billingType: string; value: number; retainerHours: number | null; startDate: string; dueDate: string; priority: string; summary: string; description: string };

export function NewProjectDialog({ companies, clients, brandGreen, project, trigger }: { companies: ("vmh" | "vth")[]; clients: { id: string; name: string }[]; brandGreen?: boolean; project?: ProjectFormValues; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useAction();
  const router = useRouter();
  const [co, setCo] = useState(project?.companyId ?? companies[0]!);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const values = { companyId: co, clientId: f.clientId!, name: f.name!, typeLabel: f.typeLabel!, category: f.category as "OTHER", billingType: f.billingType as "FIXED_SCOPE", value: Number(f.value || 0), retainerHours: f.retainerHours ? Number(f.retainerHours) : undefined, startDate: new Date(f.startDate!), dueDate: f.dueDate ? new Date(f.dueDate) : undefined, priority: f.priority as "MEDIUM", summary: f.summary, description: f.description };
    run(async () => {
      const res = project ? await updateProject(project.id, values) : await createProject(values);
      if (res.ok) { setOpen(false); if (!project) router.push(`/projects?id=${res.id}`); }
      return res;
    }, project ? "Project updated." : "Project created.");
  };
  const vmh = co === "vmh";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button className={`h-10 px-4 text-md font-semibold ${brandGreen ? "" : "bg-blue hover:bg-blue/90"}`}><Plus className="size-4" /> New Project</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 text-sm">
          {companies.length > 1 && !project && (
            <div className="col-span-2 flex gap-4">
              {companies.map((c) => <label key={c} className="flex items-center gap-2"><input type="radio" checked={co === c} onChange={() => setCo(c)} /> {c === "vmh" ? "Vertex Media House" : "Vertex Tech House"}</label>)}
            </div>
          )}
          <L label="Client" className="col-span-2">
            <select name="clientId" required defaultValue={project?.clientId} className="h-9 w-full rounded-lg border bg-card px-3">{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </L>
          <L label="Project name" className="col-span-2"><Input name="name" required defaultValue={project?.name} /></L>
          <L label="Project type"><Input name="typeLabel" required defaultValue={project?.typeLabel ?? (vmh ? "Short-form Video Editing" : "Website Development")} /></L>
          <L label="Category">
            <select name="category" className="h-9 w-full rounded-lg border bg-card px-3" defaultValue={project?.category ?? (vmh ? "VIDEO_EDITING" : "WEBSITE_DEVELOPMENT")}>
              {["VIDEO_EDITING", "DESIGN", "WEBSITE_DEVELOPMENT", "CRM_ERP", "AUTOMATION", "OTHER"].map((c) => <option key={c} value={c}>{c.replace("_", " ").toLowerCase()}</option>)}
            </select>
          </L>
          <L label="Billing">
            <select name="billingType" defaultValue={project?.billingType} className="h-9 w-full rounded-lg border bg-card px-3">
              {(vmh ? [["MONTHLY_RETAINER", "Monthly Retainer"], ["FIXED_SCOPE", "Fixed Scope"]] : [["FIXED_SCOPE", "Fixed Scope"], ["RETAINER_HOURS", "Retainer (hours)"], ["TIME_AND_MATERIALS", "Time & Materials"]]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </L>
          <L label="Value (₹)"><Input name="value" type="number" min={0} defaultValue={project?.value ?? 0} /></L>
          {!vmh && <L label="Retainer hours / month"><Input name="retainerHours" type="number" min={0} defaultValue={project?.retainerHours ?? undefined} /></L>}
          <L label="Start"><Input name="startDate" type="date" required defaultValue={project?.startDate} /></L>
          <L label="Due"><Input name="dueDate" type="date" defaultValue={project?.dueDate} /></L>
          <L label="Priority"><select name="priority" defaultValue={project?.priority ?? "MEDIUM"} className="h-9 w-full rounded-lg border bg-card px-3"><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></L>
          <L label="One-line summary" className="col-span-2"><Input name="summary" defaultValue={project?.summary} /></L>
          <L label="Description" className="col-span-2"><Textarea name="description" rows={3} defaultValue={project?.description} /></L>
          <DialogFooter className="col-span-2"><Button type="submit" disabled={pending}>{pending ? "Saving…" : project ? "Save changes" : "Create project"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

