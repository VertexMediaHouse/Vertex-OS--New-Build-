"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/layout";
import { useQueryClient } from "@tanstack/react-query";
import { leadSchema, SOURCES, type LeadInput } from "@/lib/validation/lead";
import { api, call } from "@/web/api";

const createLead = (json: LeadInput) => call(api.api.leads.$post({ json }));
const updateLead = (id: string, input: LeadInput) => call(api.api.leads.update.$post({ json: { id, input } }));

const SOURCE_LABEL: Record<string, string> = { FIVERR: "Fiverr", WEBSITE: "Website", REFERRAL: "Referral", LINKEDIN: "LinkedIn", EMAIL: "Email", INSTAGRAM: "Instagram", OTHER: "Other" };
const field = "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm";

export function LeadFormDialog({ owners, companies, lead, trigger }: { owners: { id: string; name: string }[]; companies: ("vmh" | "vth")[]; lead?: LeadInput & { id: string }; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const queryClient = useQueryClient();
  const form = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
    defaultValues: lead ?? { name: "", service: "", value: 0, companyId: companies[0], source: "WEBSITE", ownerId: "", contactName: "", email: "", phone: "", notes: "" },
  });
  const err = form.formState.errors;
  const submit = form.handleSubmit((values) =>
    start(async () => {
      const res = lead ? await updateLead(lead.id, values) : await createLead(values);
      if (!res.ok) return void toast.error(res.error);
      toast.success(lead ? "Lead updated." : "Lead added.");
      setOpen(false);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    }),
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="h-10 px-4 text-md font-semibold">
            <Plus className="size-4" /> Add Lead
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{lead ? "Edit lead" : "Add lead"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <F label="Lead / company name" error={err.name?.message} className="col-span-2"><Input {...form.register("name")} /></F>
          <F label="Service" error={err.service?.message}><Input {...form.register("service")} placeholder="YouTube Editing" /></F>
          <F label="Value (₹)" error={err.value?.message}><Input type="number" min={0} {...form.register("value")} /></F>
          <F label="Company">
            <select className={field} {...form.register("companyId")}>
              {companies.map((c) => <option key={c} value={c}>{c === "vmh" ? "Vertex Media House" : "Vertex Tech House"}</option>)}
            </select>
          </F>
          <F label="Source">
            <select className={field} {...form.register("source")}>
              {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
            </select>
          </F>
          <F label="Owner" className="col-span-2">
            <select className={field} {...form.register("ownerId")}>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </F>
          <F label="Contact name"><Input {...form.register("contactName")} /></F>
          <F label="Email" error={err.email?.message}><Input type="email" {...form.register("email")} /></F>
          <F label="Phone"><Input {...form.register("phone")} /></F>
          <F label="Notes" className="col-span-2"><Textarea rows={3} {...form.register("notes")} /></F>
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : lead ? "Save" : "Add Lead"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <Field label={label} className={`space-y-1 ${className ?? ""}`}>
      {children}
      {error && <span className="block text-2xs text-danger-text">{error}</span>}
    </Field>
  );
}

export { SOURCE_LABEL };
