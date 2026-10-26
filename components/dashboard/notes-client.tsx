"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field as L } from "@/components/shared/layout";
import { api, call } from "@/web/api";

const saveNote = (noteId: string | null, input: { title?: string; body: string; companyId?: string }) => call(api.api.dashboard.notes.$post({ json: { noteId, input } }));
const deleteNote = (noteId: string) => call(api.api.dashboard.notes.delete.$post({ json: { noteId } }));
const pinNote = (noteId: string, pinned: boolean) => call(api.api.dashboard.notes.pin.$post({ json: { noteId, pinned } }));

export type NoteRow = { id: string; title: string | null; body: string; pinned: boolean; companyId: string | null };

/** A note, open for editing. `null` id = a new one. */
function NoteDialog({ note, trigger, companies }: { note?: NoteRow; trigger: React.ReactNode; companies: ("vmh" | "vth")[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      const res = await saveNote(note?.id ?? null, {
        title: String(f.get("title") || ""),
        body: String(f.get("body") || ""),
        companyId: String(f.get("companyId") || "") as "vmh" | "",
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(note ? "Note saved." : "Note added.");
      setOpen(false);
      await refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{note ? "Edit note" : "New note"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 text-sm">
          <L label="Title (optional)"><Input name="title" defaultValue={note?.title ?? ""} placeholder="What is this about?" /></L>
          <L label="Note"><Textarea name="body" rows={7} required defaultValue={note?.body ?? ""} placeholder="Anything you need to remember…" /></L>
          {companies.length > 1 && (
            <L label="Company">
              <select name="companyId" defaultValue={note?.companyId ?? ""} className="h-9 w-full rounded-lg border bg-card px-3">
                <option value="">Both</option>
                <option value="vmh">Vertex Media House</option>
                <option value="vth">Vertex Tech House</option>
              </select>
            </L>
          )}
          <DialogFooter className="gap-2">
            {note && (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                className="mr-auto text-danger-text"
                onClick={() =>
                  start(async () => {
                    const res = await deleteNote(note.id);
                    if (!res.ok) return void toast.error(res.error);
                    toast.success("Note deleted.");
                    setOpen(false);
                    await refresh();
                  })
                }
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save note"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewNoteButton({ companies }: { companies: ("vmh" | "vth")[] }) {
  return (
    <NoteDialog
      companies={companies}
      trigger={
        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-xs font-medium hover:bg-accent">
          <Plus className="size-3.5" /> New note
        </button>
      }
    />
  );
}

/** Sticky notes: click one to edit it, pin the ones that should stay on top. */
export function NoteBoard({ notes, companies }: { notes: NoteRow[]; companies: ("vmh" | "vth")[] }) {
  const [, start] = useTransition();
  const queryClient = useQueryClient();
  if (notes.length === 0) {
    return <p className="py-6 text-center text-xs text-ink-muted">No notes yet. Jot down anything you need to remember.</p>;
  }
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {notes.map((n) => (
        <li key={n.id} className="relative rounded-xl bg-warning-soft p-3 pr-8">
          <NoteDialog
            note={n}
            companies={companies}
            trigger={
              <button type="button" className="block w-full text-left">
                {n.title && <p className="truncate text-xs font-semibold text-ink">{n.title}</p>}
                <p className="mt-0.5 line-clamp-4 text-xs whitespace-pre-wrap text-ink-2">{n.body}</p>
              </button>
            }
          />
          <button
            type="button"
            aria-label={n.pinned ? "Unpin note" : "Pin note"}
            title={n.pinned ? "Unpin" : "Pin to the top"}
            className="absolute top-2 right-2 rounded-md p-1 text-ink-muted hover:bg-black/5 hover:text-ink"
            onClick={() => start(async () => { await pinNote(n.id, !n.pinned); await queryClient.invalidateQueries({ queryKey: ["dashboard"] }); })}
          >
            {n.pinned ? <Pin className="size-3.5 fill-current" /> : <PinOff className="size-3.5" />}
          </button>
        </li>
      ))}
    </ul>
  );
}
