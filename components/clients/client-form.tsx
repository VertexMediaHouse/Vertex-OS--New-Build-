"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient, updateClient } from "@/app/(app)/clients/actions";
import { Field as L } from "@/components/shared/layout";

export type ClientFormValues = {
  id: string; name: string; domain: string; type: string; status: "ACTIVE"; companies: ("vmh" | "vth")[];
  ownerId: string; tags: string[]; notes: string; address: string;
};

/** Add a client, or edit one when `client` is given. */
export function ClientFormDialog({ companies, owners, client }: { companies: ("vmh" | "vth")[]; owners: { id: string; name: string }[]; client?: ClientFormValues }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input = {
      name: String(f.get("name")), domain: String(f.get("domain") || ""), type: String(f.get("type") || ""),
      companies: f.getAll("companies").map(String) as ("vmh" | "vth")[], ownerId: String(f.get("ownerId") || ""),
      contactName: String(f.get("contactName") || ""), contactEmail: String(f.get("contactEmail") || ""), address: String(f.get("address") || ""),
      tags: String(f.get("tags") || "").split(",").map((t) => t.trim()).filter(Boolean), notes: String(f.get("notes") || ""),
      ...(client && { status: client.status }),
    };
    start(async () => {
      const res = client ? await updateClient(client.id, input) : await createClient(input);
      if (!res.ok) return void toast.error(res.error);
      toast.success(client ? "Client updated." : "Client added.");
      setOpen(false);
      if (!client) router.push(`/clients/${res.id}`);
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {client
          ? <Button variant="outline">Edit client</Button>
          : <Button className="h-10 px-4 text-md font-semibold"><Plus className="size-4" /> Add Client</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{client ? `Edit ${client.name}` : "Add client"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 text-sm">
          <L label="Name" className="col-span-2"><Input name="name" required defaultValue={client?.name} /></L>
          <L label="Website / domain"><Input name="domain" placeholder="brightlabs.co" defaultValue={client?.domain} /></L>
          <L label="Type"><Input name="type" placeholder="YouTube Editing" defaultValue={client?.type} /></L>
          <fieldset className="col-span-2 flex gap-4">
            <legend className="mb-1 text-xs font-medium">Company</legend>
            {companies.map((c, i) => (
              <label key={c} className="flex items-center gap-2 text-sm"><input type="checkbox" name="companies" value={c} defaultChecked={client ? client.companies.includes(c) : i === 0} /> {c === "vmh" ? "Vertex Media House" : "Vertex Tech House"}</label>
            ))}
          </fieldset>
          <L label="Owner">
            <select name="ownerId" defaultValue={client?.ownerId} className="h-9 w-full rounded-lg border border-input bg-card px-3">
              <option value="">Me</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </L>
          <L label="Tags (comma-separated)"><Input name="tags" defaultValue={client?.tags.join(", ")} /></L>
          <L label="Primary contact"><Input name="contactName" /></L>
          <L label="Contact email"><Input name="contactEmail" type="email" /></L>
          <L label="Billing address" className="col-span-2"><Input name="address" defaultValue={client?.address} /></L>
          <L label="Notes" className="col-span-2"><Textarea name="notes" rows={3} defaultValue={client?.notes} /></L>
          <DialogFooter className="col-span-2"><Button type="submit" disabled={pending}>{pending ? "Saving…" : client ? "Save changes" : "Add Client"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

