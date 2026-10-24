"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { inviteMember, updateMember } from "@/app/(app)/team/actions";

type Membership = { companyId: string; role: string };

function MembershipPicker({ companies, value, onChange }: { companies: string[]; value: Membership[]; onChange: (m: Membership[]) => void }) {
  return (
    <div className="space-y-2">
      {companies.map((c) => {
        const m = value.find((x) => x.companyId === c);
        return (
          <div key={c} className="flex items-center gap-3 text-sm">
            <label className="flex w-48 items-center gap-2"><input type="checkbox" checked={Boolean(m)} onChange={(e) => onChange(e.target.checked ? [...value, { companyId: c, role: "MEMBER" }] : value.filter((x) => x.companyId !== c))} />{c === "vmh" ? "Vertex Media House" : "Vertex Tech House"}</label>
            {m && <select value={m.role} onChange={(e) => onChange(value.map((x) => (x.companyId === c ? { ...x, role: e.target.value } : x)))} className="h-8 rounded-lg border bg-card px-2 text-xs"><option value="ADMIN">Admin</option><option value="MANAGER">Manager</option><option value="MEMBER">Member</option></select>}
          </div>
        );
      })}
    </div>
  );
}

export function InviteDialog({ companies }: { companies: string[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [ms, setMs] = useState<Membership[]>([{ companyId: companies[0]!, role: "MEMBER" }]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-10 px-4 text-md font-semibold"><UserPlus className="size-4" /> Invite Member</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Invite team member</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; start(async () => { const r = await inviteMember({ name: f.name!, email: f.email!, title: f.title, capacity: Number(f.capacity || 40), memberships: ms }); if (!r.ok) return void toast.error(r.error); toast.success("Invite sent."); setOpen(false); }); }}>
          <label className="space-y-1 block"><span className="block text-xs leading-none font-medium">Name</span><Input name="name" required /></label>
          <label className="space-y-1 block"><span className="block text-xs leading-none font-medium">Email</span><Input name="email" type="email" required /></label>
          <div className="grid grid-cols-2 gap-3"><label className="space-y-1 block"><span className="block text-xs leading-none font-medium">Title</span><Input name="title" placeholder="Video Editor" /></label><label className="space-y-1 block"><span className="block text-xs leading-none font-medium">Weekly capacity (h)</span><Input name="capacity" type="number" min={1} max={80} defaultValue={40} /></label></div>
          <MembershipPicker companies={companies} value={ms} onChange={setMs} />
          <DialogFooter><Button type="submit" disabled={pending}>Send invite</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditMember({ userId, title, capacity, active, memberships, companies }: { userId: string; title: string; capacity: number; active: boolean; memberships: Membership[]; companies: string[] }) {
  const [pending, start] = useTransition();
  const [ms, setMs] = useState(memberships);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; start(async () => { try { await updateMember(userId, { title: f.title, capacity: Number(f.capacity), active: f.active === "on", memberships: ms }); toast.success("Saved."); } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); } }); }}>
      <div className="grid grid-cols-2 gap-3"><label className="space-y-1 block"><span className="block text-xs leading-none font-medium">Title</span><Input name="title" defaultValue={title} /></label><label className="space-y-1 block"><span className="block text-xs leading-none font-medium">Weekly capacity (h)</span><Input name="capacity" type="number" min={1} max={80} defaultValue={capacity} /></label></div>
      <MembershipPicker companies={companies} value={ms} onChange={setMs} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={active} /> Active (can log in)</label>
      <Button type="submit" disabled={pending}>Save</Button>
    </form>
  );
}
