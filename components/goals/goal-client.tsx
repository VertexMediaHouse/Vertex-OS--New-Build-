"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GOAL_CATEGORY_LABELS } from "@/lib/chart-colors";
import { api, call } from "@/web/api";
import { Field as F } from "@/components/shared/layout";

/** The two milestone call sites await a void promise, so those throw on failure. */
async function must(p: Promise<Response>) {
  const r = await call(p);
  if (!r.ok) throw new Error(r.error);
}

const createGoal = (json: Record<string, unknown>) => call(api.api.goals.$post({ json: json as never }));
const updateGoalProgress = (id: string, value: number) => call(api.api.goals[":id"].progress.$post({ param: { id }, json: { value } } as never));
const addGoalMilestone = (id: string, title: string, date: string) => must(api.api.goals[":id"].milestones.$post({ param: { id }, json: { title, date } } as never));
const toggleGoalMilestone = (milestoneId: string, done: boolean) => must(api.api.goals.milestones[":milestoneId"].toggle.$post({ param: { milestoneId }, json: { done } } as never));

const METRICS = [["MANUAL", "Manual (I update it)"], ["REVENUE", "Revenue collected"], ["NEW_CLIENTS", "New clients"], ["PROJECTS_COMPLETED", "Projects completed"], ["VIDEOS_DELIVERED", "Videos delivered"], ["LEADS_WON", "Leads won"], ["BILLABLE_HOURS", "Billable hours"]];
const UNIT_FOR: Record<string, string> = { REVENUE: "CURRENCY", BILLABLE_HOURS: "HOURS" };

export function GoalDialog({ label, companies, people }: { label: string; companies: ("vmh" | "vth")[]; people: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [metric, setMetric] = useState("MANUAL");
  const queryClient = useQueryClient();
  const sel = "h-9 w-full rounded-lg border bg-card px-2 text-sm";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-10 px-4 text-md font-semibold"><Plus className="size-4" /> {label}</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
        <form className="grid grid-cols-2 gap-3 text-sm" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const f = Object.fromEntries(fd) as Record<string, string>;
          start(async () => {
            const r = await createGoal({ title: f.title!, subtitle: f.subtitle, description: f.description, companyId: f.companyId as "", scope: f.scope as "TEAM", category: f.category as "REVENUE_SALES", metricType: metric as "MANUAL", unit: (UNIT_FOR[metric] ?? f.unit) as "COUNT", targetValue: Number(f.target), startDate: new Date(f.start!), endDate: new Date(f.end!), memberIds: fd.getAll("members").map(String) });
            if (!r.ok) return void toast.error(r.error);
            toast.success("Goal created."); setOpen(false);
            await queryClient.invalidateQueries({ queryKey: ["goals"] });
          });
        }}>
          <F label="Title" className="col-span-2"><Input name="title" required /></F>
          <F label="Subtitle" className="col-span-2"><Input name="subtitle" /></F>
          <F label="Company"><select name="companyId" className={sel}><option value="">Both companies</option>{companies.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select></F>
          <F label="Type"><select name="scope" className={sel} defaultValue="TEAM"><option value="COMPANY">Company goal</option><option value="TEAM">Team goal</option><option value="PERSONAL">Personal goal</option></select></F>
          <F label="Category"><select name="category" className={sel}>{Object.entries(GOAL_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></F>
          <F label="Tracking"><select value={metric} onChange={(e) => setMetric(e.target.value)} className={sel}>{METRICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></F>
          <F label="Target"><Input name="target" type="number" min={0} step="any" required /></F>
          {!UNIT_FOR[metric] && <F label="Unit"><select name="unit" className={sel}><option value="COUNT">Count</option><option value="PERCENT">Percent</option><option value="CURRENCY">₹</option><option value="HOURS">Hours</option></select></F>}
          <F label="Start"><Input name="start" type="date" required /></F>
          <F label="End"><Input name="end" type="date" required /></F>
          <fieldset className="col-span-2"><legend className="mb-1 text-xs font-medium">Team members</legend><div className="flex flex-wrap gap-3">{people.map((p) => <label key={p.id} className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="members" value={p.id} />{p.name}</label>)}</div></fieldset>
          <F label="Description" className="col-span-2"><Textarea name="description" rows={2} /></F>
          <DialogFooter className="col-span-2"><Button type="submit" disabled={pending}>Create goal</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


export function ProgressEditor({ goalId, value }: { goalId: string; value: number }) {
  const [pending, start] = useTransition();
  const [v, setV] = useState(String(value));
  const queryClient = useQueryClient();
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await updateGoalProgress(goalId, Number(v)); if (!r.ok) toast.error(r.error); else { toast.success("Progress updated."); await queryClient.invalidateQueries({ queryKey: ["goals"] }); } }); }}>
      <Input type="number" min={0} step="any" value={v} onChange={(e) => setV(e.target.value)} className="h-8 w-32 text-xs" aria-label="Current value" />
      <Button size="sm" type="submit" disabled={pending}>Update</Button>
    </form>
  );
}

export function MilestoneCheck({ id, done, label }: { id: string; done: boolean; label: string }) {
  const [pending, start] = useTransition();
  const queryClient = useQueryClient();
  return <input type="checkbox" checked={done} disabled={pending} aria-label={label} onChange={(e) => start(async () => { await toggleGoalMilestone(id, e.target.checked); await queryClient.invalidateQueries({ queryKey: ["goals"] }); })} className="size-4 accent-success" />;
}

export function AddMilestone({ goalId }: { goalId: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-brand-text">+ Add Milestone</button>;
  return (
    <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); start(async () => { await addGoalMilestone(goalId, String(f.get("title")), String(f.get("date"))); setOpen(false); await queryClient.invalidateQueries({ queryKey: ["goals"] }); }); }}>
      <Input name="title" required placeholder="Milestone" className="h-8 text-xs" />
      <Input name="date" type="date" required className="h-8 w-36 text-xs" />
      <Button size="sm" type="submit" disabled={pending}>Add</Button>
    </form>
  );
}
