"use client";

import { useState, useTransition } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { toast } from "sonner";
import { KanbanBoard, KanbanCard, type KanbanColumn } from "@/components/shared/kanban";
import { CompanyBadge, type CompanyBadgeCode } from "@/components/shared/pills";
import { Avatar } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field as F } from "@/components/shared/layout";
import { deleteContent, moveContent, saveContent } from "@/app/(app)/content/actions";
import { CHANNELS } from "@/lib/content";

export type ContentCard = {
  id: string; title: string; co: CompanyBadgeCode; channel: string; stage: string; hook: string | null;
  owner: { name: string; image: string | null } | null; ownerId: string | null;
  shootDate: string | null; publishDate: string | null; shootLabel: string | null; publishLabel: string | null;
  notes: string | null; link: string | null; companyId: string;
};

const COLUMNS: KanbanColumn[] = [
  { id: "IDEA", title: "Ideas", headerClass: "bg-surface-muted", bodyClass: "bg-surface-muted", accentClass: "text-ink" },
  { id: "SCRIPTING", title: "Scripting", headerClass: "bg-review-soft", bodyClass: "bg-review-soft", accentClass: "text-review-text" },
  { id: "FILMING", title: "Filming", headerClass: "bg-warning-soft", bodyClass: "bg-warning-soft", accentClass: "text-warning-text" },
  { id: "EDITING", title: "Editing", headerClass: "bg-info-soft", bodyClass: "bg-info-soft", accentClass: "text-info-text" },
  { id: "SCHEDULED", title: "Scheduled", headerClass: "bg-brand-soft", bodyClass: "bg-brand-soft", accentClass: "text-brand-text" },
  { id: "PUBLISHED", title: "Published", headerClass: "bg-success-soft", bodyClass: "bg-success-soft", accentClass: "text-success-text" },
];

/** New piece, or an existing one opened for editing. */
export function ContentDialog({
  companies, people, item, trigger, defaultStage,
}: {
  companies: ("vmh" | "vth")[];
  people: { id: string; name: string }[];
  item?: ContentCard;
  trigger?: React.ReactNode;
  defaultStage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [co, setCo] = useState<"vmh" | "vth">((item?.companyId as "vmh") ?? companies[0] ?? "vmh");
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      const res = await saveContent(item?.id ?? null, {
        title: String(f.get("title") || ""),
        companyId: co,
        channel: String(f.get("channel") || "YOUTUBE") as "YOUTUBE",
        stage: String(f.get("stage") || defaultStage || "IDEA") as "IDEA",
        ownerId: String(f.get("ownerId") || ""),
        hook: String(f.get("hook") || ""),
        notes: String(f.get("notes") || ""),
        shootDate: String(f.get("shootDate") || ""),
        publishDate: String(f.get("publishDate") || ""),
        link: String(f.get("link") || ""),
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(item ? "Content updated." : "Added to the board.");
      setOpen(false);
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="h-10 px-4 text-md font-semibold"><Plus className="size-4" /> New content</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{item ? "Edit content" : "New content"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 text-sm">
          {companies.length > 1 && !item && (
            <div className="col-span-2 flex gap-4 text-xs">
              {companies.map((c) => (
                <label key={c} className="flex items-center gap-2">
                  <input type="radio" checked={co === c} onChange={() => setCo(c)} /> {c === "vmh" ? "Vertex Media House" : "Vertex Tech House"}
                </label>
              ))}
            </div>
          )}
          <F label="Title" className="col-span-2"><Input name="title" required defaultValue={item?.title ?? ""} placeholder="What are we making?" /></F>
          <F label="The hook" className="col-span-2"><Input name="hook" defaultValue={item?.hook ?? ""} placeholder="The one line that makes someone watch" /></F>
          <F label="Channel">
            <select name="channel" defaultValue={item?.channel ?? "YOUTUBE"} className="h-9 w-full rounded-lg border bg-card px-3">
              {CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </F>
          <F label="Stage">
            <select name="stage" defaultValue={item?.stage ?? defaultStage ?? "IDEA"} className="h-9 w-full rounded-lg border bg-card px-3">
              {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </F>
          <F label="Owner">
            <select name="ownerId" defaultValue={item?.ownerId ?? ""} className="h-9 w-full rounded-lg border bg-card px-3">
              <option value="">Nobody yet</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </F>
          <F label="Shoot date"><Input name="shootDate" type="date" defaultValue={item?.shootDate ?? ""} /></F>
          <F label="Publish date"><Input name="publishDate" type="date" defaultValue={item?.publishDate ?? ""} /></F>
          <F label="Link (once it is up)"><Input name="link" defaultValue={item?.link ?? ""} placeholder="https://" /></F>
          <F label="Notes" className="col-span-2"><Textarea name="notes" rows={3} defaultValue={item?.notes ?? ""} placeholder="Angles, references, what to say…" /></F>
          <DialogFooter className="col-span-2 gap-2">
            {item && (
              <Button
                type="button"
                variant="outline"
                className="mr-auto text-danger-text"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deleteContent(item.id);
                    if (!res.ok) return void toast.error(res.error);
                    toast.success("Deleted.");
                    setOpen(false);
                  })
                }
              >
                Delete
              </Button>
            )}
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : item ? "Save" : "Add to board"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ContentBoard({
  items, companies, people,
}: {
  items: Record<string, ContentCard[]>;
  companies: ("vmh" | "vth")[];
  people: { id: string; name: string }[];
}) {
  return (
    <KanbanBoard
      columns={COLUMNS}
      items={items}
      onMove={moveContent}
      limit={4}
      moreLabel={(n) => `+ ${n} more`}
      renderCard={(c) => (
        <ContentDialog
          companies={companies}
          people={people}
          item={c}
          trigger={
            <KanbanCard className="cursor-pointer text-left hover:border-brand/40">
              <p className="text-sm font-semibold text-ink">{c.title}</p>
              {c.hook && <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{c.hook}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs text-ink-2">
                <CompanyBadge code={c.co} />
                <span className="rounded bg-surface-muted px-1.5 py-0.5">{CHANNELS.find(([v]) => v === c.channel)?.[1] ?? c.channel}</span>
                {c.publishLabel && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{c.publishLabel}</span>}
                {c.owner && <span className="ml-auto"><Avatar person={c.owner} size={20} /></span>}
              </div>
            </KanbanCard>
          }
        />
      )}
    />
  );
}
