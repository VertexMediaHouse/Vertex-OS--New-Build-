"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { toast } from "sonner";
import { KanbanBoard, KanbanCard } from "@/components/shared/kanban";
import { CompanyBadge, PriorityPill, type CompanyBadgeCode } from "@/components/shared/pills";
import { Avatar, ProgressBar } from "@/components/shared/primitives";
import { useHrefWith } from "@/components/shared/nav";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addChecklistItem, addTaskComment, createTask, moveTask, toggleChecklist, updateTask } from "@/app/(app)/tasks/actions";
import { Field as F } from "@/components/shared/layout";

export type BoardTask = { id: string; title: string; co: CompanyBadgeCode; client: string | null; priority: string; due: string | null; progress: number; assignee: string | null };

const COLS = [
  { id: "TODO", title: "To Do", headerClass: "bg-surface-muted", bodyClass: "bg-surface-muted", accentClass: "text-ink", dot: null },
  { id: "IN_PROGRESS", title: "In Progress", headerClass: "bg-info-soft", bodyClass: "bg-info-soft", accentClass: "text-info-text", dot: "bg-brand-strong" },
  { id: "IN_REVIEW", title: "In Review", headerClass: "bg-review-soft", bodyClass: "bg-review-soft", accentClass: "text-review-text", dot: "bg-review" },
  { id: "CLIENT_REVIEW", title: "Client Review", headerClass: "bg-warning-soft", bodyClass: "bg-warning-soft", accentClass: "text-warning-text", dot: "bg-warning-text rounded-[2px]" },
  { id: "COMPLETED", title: "Completed", headerClass: "bg-success-soft", bodyClass: "bg-success-soft", accentClass: "text-success-text", dot: "bg-success" },
];

export function TaskBoard({ items, addHref }: { items: Record<string, BoardTask[]>; addHref: string }) {
  const hrefWith = useHrefWith();
  return (
    <KanbanBoard
      countStyle="chip"
      limit={5}
      moreLabel={(n) => `+ ${n} more tasks`}
      onMove={moveTask}
      items={items}
      columns={COLS.map((c) => ({
        ...c,
        icon: c.dot ? <span className={`size-2.5 rounded-full ${c.dot}`} aria-hidden /> : undefined,
        headerAction: <Link href={`${addHref}&status=${c.id}`} aria-label={`Add task to ${c.title}`} className={c.accentClass}><Plus className="size-4" /></Link>,
        topAction: <Link href={`${addHref}&status=${c.id}`} className="mb-2 block text-center text-xs font-medium text-brand-text hover:underline">+ Add Task</Link>,
      }))}
      renderCard={(t) => (
        <KanbanCard className="relative">
          <Link href={hrefWith({ id: t.id })} scroll={false} className="absolute inset-0 rounded-lg" aria-label={`Open ${t.title}`} />
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-ink">{t.title}</p>
            <CompanyBadge code={t.co} />
          </div>
          <p className="text-2xs text-ink-muted">{t.client}</p>
          <div className="mt-2 flex items-center gap-2">
            <PriorityPill priority={t.priority} size="xs" />
            {t.due && <span className="inline-flex items-center gap-1 text-[10.5px] text-ink-muted"><CalendarDays className="size-3" />{t.due}</span>}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {t.progress > 0 && <><ProgressBar value={t.progress} className="flex-1" /><span className="text-[10.5px] text-ink-2">{t.progress}%</span></>}
            {t.progress === 0 && <span className="flex-1" />}
            {t.assignee && <Avatar person={{ name: t.assignee }} size={24} />}
          </div>
        </KanbanCard>
      )}
    />
  );
}

export function NewTaskDialog({ companies, projects, people, open: initialOpen, status }: { companies: ("vmh" | "vth")[]; projects: { id: string; name: string; companyId: string }[]; people: { id: string; name: string }[]; open?: boolean; status?: string }) {
  const [open, setOpen] = useState(Boolean(initialOpen));
  const [pending, start] = useTransition();
  const [co, setCo] = useState(companies[0]!);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-10 px-4 text-md font-semibold"><Plus className="size-4" /> Add Task</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add task</DialogTitle></DialogHeader>
        <form
          className="grid grid-cols-2 gap-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
            start(async () => {
              const res = await createTask({ title: f.title!, companyId: co, projectId: f.projectId, assigneeId: f.assigneeId, priority: f.priority as "MEDIUM", status: (status ?? "TODO") as "TODO", dueDate: f.dueDate ? new Date(f.dueDate) : undefined, estimatedMinutes: f.estimate ? Math.round(Number(f.estimate) * 60) : undefined, description: f.description });
              if (!res.ok) return void toast.error(res.error);
              toast.success("Task added.");
              setOpen(false);
            });
          }}
        >
          <F label="Title" className="col-span-2"><Input name="title" required /></F>
          {companies.length > 1 && (
            <F label="Company"><select value={co} onChange={(e) => setCo(e.target.value as "vmh")} className="h-9 w-full rounded-lg border bg-card px-2">{companies.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select></F>
          )}
          <F label="Project"><select name="projectId" className="h-9 w-full rounded-lg border bg-card px-2"><option value="">No project</option>{projects.filter((p) => p.companyId === co).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></F>
          <F label="Assignee"><select name="assigneeId" className="h-9 w-full rounded-lg border bg-card px-2"><option value="">Unassigned</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></F>
          <F label="Priority"><select name="priority" defaultValue="MEDIUM" className="h-9 w-full rounded-lg border bg-card px-2"><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></F>
          <F label="Due date"><Input name="dueDate" type="date" /></F>
          <F label="Estimate (hours)"><Input name="estimate" type="number" min={0} step={0.5} /></F>
          <F label="Description" className="col-span-2"><Textarea name="description" rows={3} /></F>
          <DialogFooter className="col-span-2"><Button type="submit" disabled={pending}>Add Task</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


export function ChecklistControls({ taskId, items }: { taskId: string; items: { id: string; text: string; done: boolean; assignee: string | null }[] }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  return (
    <div>
      <ul>
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-2.5 py-1.5 text-xs">
            <input type="checkbox" checked={i.done} disabled={pending} onChange={(e) => start(() => toggleChecklist(i.id, e.target.checked))} className="size-4 accent-blue" aria-label={i.text} />
            <span className={`flex-1 ${i.done ? "text-ink-muted line-through" : "text-ink"}`}>{i.text}</span>
            {i.assignee && <Avatar person={{ name: i.assignee }} size={22} />}
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); start(async () => { await addChecklistItem(taskId, text); setText(""); }); }} className="mt-1 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add item" className="h-8 text-xs" aria-label="New checklist item" />
        <Button size="sm" type="submit" disabled={pending || !text.trim()}>Add</Button>
      </form>
    </div>
  );
}

export function CommentBox({ taskId }: { taskId: string }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(async () => { await addTaskComment(taskId, text); setText(""); }); }} className="mt-2 flex gap-2">
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Comment… @name to mention" className="h-8 text-xs" aria-label="New comment" />
      <Button size="sm" type="submit" disabled={pending || !text.trim()}>Send</Button>
    </form>
  );
}

export function TaskFieldSelect({ taskId, field, value, options }: { taskId: string; field: "priority" | "assigneeId"; value: string; options: { value: string; label: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <select aria-label={field} disabled={pending} defaultValue={value} onChange={(e) => start(() => updateTask(taskId, { [field]: e.target.value || null }))} className="h-8 rounded-lg border bg-card px-2 text-xs">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function TaskStatusSelect({ taskId, value }: { taskId: string; value: string }) {
  const [pending, start] = useTransition();
  return (
    <select aria-label="Status" disabled={pending} defaultValue={value} onChange={(e) => start(() => moveTask(taskId, e.target.value, null))} className="h-7 rounded-full bg-info-soft px-2 text-xs font-medium text-info-text">
      {COLS.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
    </select>
  );
}
