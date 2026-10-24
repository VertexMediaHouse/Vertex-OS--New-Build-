"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/app/(app)/clients/actions";

export function ClientFormDialog({ companies, owners }: { companies: ("vmh" | "vth")[]; owners: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      const res = await createClient({
        name: String(f.get("name")), domain: String(f.get("domain") || ""), type: String(f.get("type") || ""),
        companies: f.getAll("companies").map(String) as ("vmh" | "vth")[], ownerId: String(f.get("ownerId") || ""),
        contactName: String(f.get("contactName") || ""), contactEmail: String(f.get("contactEmail") || ""), address: String(f.get("address") || ""),
        tags: String(f.get("tags") || "").split(",").map((t) => t.trim()).filter(Boolean), notes: String(f.get("notes") || ""),
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Client added.");
      setOpen(false);
      router.push(`/clients/${res.id}`);
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 px-4 text-md font-semibold"><Plus className="size-4" /> Add Client</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Add client</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 text-sm">
          <L label="Name" className="col-span-2"><Input name="name" required /></L>
          <L label="Website / domain"><Input name="domain" placeholder="brightlabs.co" /></L>
          <L label="Type"><Input name="type" placeholder="YouTube Editing" /></L>
          <fieldset className="col-span-2 flex gap-4">
            <legend className="mb-1 text-xs font-medium">Company</legend>
            {companies.map((c, i) => (
              <label key={c} className="flex items-center gap-2 text-sm"><input type="checkbox" name="companies" value={c} defaultChecked={i === 0} /> {c === "vmh" ? "Vertex Media House" : "Vertex Tech House"}</label>
            ))}
          </fieldset>
          <L label="Owner">
            <select name="ownerId" className="h-9 w-full rounded-lg border border-input bg-card px-3">
              <option value="">Me</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </L>
          <L label="Tags (comma-separated)"><Input name="tags" /></L>
          <L label="Primary contact"><Input name="contactName" /></L>
          <L label="Contact email"><Input name="contactEmail" type="email" /></L>
          <L label="Billing address" className="col-span-2"><Input name="address" /></L>
          <L label="Notes" className="col-span-2"><Textarea name="notes" rows={3} /></L>
          <DialogFooter className="col-span-2"><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add Client"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function L({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={`space-y-1 ${className ?? ""}`}><Label className="text-xs">{label}</Label>{children}</div>;
}
