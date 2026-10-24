"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createEvent } from "./actions";

export function EventForm({ clients, companies }: { clients: { id: string; name: string }[]; companies: string[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const sel = "h-9 w-full rounded-lg border bg-card px-2 text-sm";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-10 px-4 text-md font-semibold"><Plus className="size-4" /> Add Event</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add event</DialogTitle></DialogHeader>
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; start(async () => { const r = await createEvent({ title: f.title!, type: f.type!, companyId: f.companyId!, date: f.date!, start: f.start!, minutes: Number(f.minutes), clientId: f.clientId }); if (!r.ok) return void toast.error(r.error); toast.success("Event added."); setOpen(false); }); }}>
          <label className="col-span-2 space-y-1 block"><span className="block text-xs leading-none font-medium">Title</span><Input name="title" required placeholder="Client Call - Bright Labs" /></label>
          <label className="space-y-1 block"><span className="block text-xs leading-none font-medium">Type</span><select name="type" className={sel}><option value="CALL">Call</option><option value="REVIEW">Review</option><option value="FOLLOW_UP">Follow-up</option><option value="MEETING">Meeting</option></select></label>
          <label className="space-y-1 block"><span className="block text-xs leading-none font-medium">Company</span><select name="companyId" className={sel}><option value="">Both</option>{companies.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select></label>
          <label className="space-y-1 block"><span className="block text-xs leading-none font-medium">Date</span><Input name="date" type="date" required /></label>
          <label className="space-y-1 block"><span className="block text-xs leading-none font-medium">Start</span><Input name="start" type="time" required /></label>
          <label className="space-y-1 block"><span className="block text-xs leading-none font-medium">Duration (min)</span><Input name="minutes" type="number" min={5} defaultValue={30} /></label>
          <label className="space-y-1 block"><span className="block text-xs leading-none font-medium">Client</span><select name="clientId" className={sel}><option value="">None</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <DialogFooter className="col-span-2"><Button type="submit" disabled={pending}>Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
