// Ported from app/(app)/calendar/event-form.tsx. The action import became an API call;
// a success invalidates the calendar query in place of refresh().
import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/shared/layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, call } from "@/web/api";

export function EventForm({ clients, companies }: { clients: { id: string; name: string }[]; companies: string[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const queryClient = useQueryClient();
  const sel = "h-9 w-full rounded-lg border bg-card px-2 text-sm";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-10 px-4 text-md font-semibold"><Plus className="size-4" /> Add Event</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add event</DialogTitle></DialogHeader>
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; start(async () => { const r = await call(api.api.calendar.events.$post({ json: { title: f.title!, type: f.type!, companyId: f.companyId!, date: f.date!, start: f.start!, minutes: Number(f.minutes), clientId: f.clientId } })); if (!r.ok) return void toast.error(r.error); toast.success("Event added."); setOpen(false); await queryClient.invalidateQueries({ queryKey: ["calendar"] }); }); }}>
          <Field label="Title" className="col-span-2 space-y-1"><Input name="title" required placeholder="Client Call - Bright Labs" /></Field>
          <Field label="Type" className="space-y-1"><select name="type" className={sel}><option value="CALL">Call</option><option value="REVIEW">Review</option><option value="FOLLOW_UP">Follow-up</option><option value="MEETING">Meeting</option></select></Field>
          <Field label="Company" className="space-y-1"><select name="companyId" className={sel}><option value="">Both</option>{companies.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select></Field>
          <Field label="Date" className="space-y-1"><Input name="date" type="date" required /></Field>
          <Field label="Start" className="space-y-1"><Input name="start" type="time" required /></Field>
          <Field label="Duration (min)" className="space-y-1"><Input name="minutes" type="number" min={5} defaultValue={30} /></Field>
          <Field label="Client" className="space-y-1"><select name="clientId" className={sel}><option value="">None</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <DialogFooter className="col-span-2"><Button type="submit" disabled={pending}>Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
