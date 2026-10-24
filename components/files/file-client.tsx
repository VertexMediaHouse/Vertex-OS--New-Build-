"use client";

import { useRef, useState, useTransition } from "react";
import { FolderPlus, Star, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { completeUpload, createFolder, requestUpload, shareFile, toggleStar, trashFile, updateFile } from "@/app/(app)/files/actions";

/** PUT with progress (fetch has no upload progress). */
function put(url: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(file);
  });
}

/** Drag & drop / pick multiple files; each goes straight to storage, then is recorded. */
export function UploadButton({ folderId, fileId, label = "Upload File", projectId, taskId }: { folderId?: string | null; fileId?: string; label?: string; projectId?: string; taskId?: string }) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const upload = async (files: FileList | File[]) => {
    setBusy(true);
    for (const file of Array.from(files)) {
      try {
        const m = { name: file.name, size: file.size, mime: file.type };
        const { key, keySig, url } = await requestUpload(m);
        await put(url, file, (p) => setProgress((x) => ({ ...x, [file.name]: p })));
        const r = await completeUpload({ ...m, key, keySig, folderId, fileId, projectId, taskId });
        if (!r.ok) throw new Error(r.error);
        toast.success(`${file.name} uploaded.`);
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }
    setBusy(false);
    setProgress({});
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-10 px-4 text-md font-semibold"><Upload className="size-4" /> {label}</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{fileId ? "Upload a new version" : "Upload files"}</DialogTitle></DialogHeader>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files); }}
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center text-sm text-ink-2"
        >
          <Upload className="size-6 text-blue" />
          <p>Drag files here, or</p>
          <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>Choose files</Button>
          <input ref={input} type="file" multiple={!fileId} className="hidden" onChange={(e) => e.target.files && void upload(e.target.files)} />
          <p className="text-2xs text-ink-muted">Large videos upload directly to storage (up to 2 GB each).</p>
        </div>
        {Object.entries(progress).map(([name, p]) => (
          <div key={name} className="text-xs"><p className="truncate">{name}</p><div className="h-1.5 rounded bg-track"><div className="h-full rounded bg-blue" style={{ width: `${Math.round(p * 100)}%` }} /></div></div>
        ))}
      </DialogContent>
    </Dialog>
  );
}

export function NewFolderButton({ parentId }: { parentId: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="h-10 px-4 text-md"><FolderPlus className="size-4" /> New Folder</Button></DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>New folder</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); const name = String(new FormData(e.currentTarget).get("name")); start(async () => { const r = await createFolder(name, parentId); if (r.ok) { toast.success("Folder created."); setOpen(false); } }); }} className="space-y-3">
          <Input name="name" required placeholder="Folder name" />
          <DialogFooter><Button type="submit" disabled={pending}>Create</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StarButton({ id, starred }: { id: string; starred: boolean }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => start(() => toggleStar(id))} aria-label={starred ? "Unstar" : "Star"} className="rounded p-1 hover:bg-accent"><Star className={`size-4 ${starred ? "fill-warning text-warning" : "text-ink-muted"}`} /></button>;
}

export function FileMenuActions({ id, trashed, status, portal, people, shared }: { id: string; trashed: boolean; status: string | null; portal: boolean; people: { id: string; name: string }[]; shared: string[] }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<void>, ok: string) => start(async () => { try { await fn(); toast.success(ok); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed."); } });
  const [picked, setPicked] = useState(shared);
  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap gap-2">
        {(["DRAFT", "REVIEW", "FINAL"] as const).map((s) => <Button key={s} size="sm" variant={status === s ? "default" : "outline"} disabled={pending} onClick={() => run(() => updateFile(id, { status: status === s ? null : s }), "Status updated.")}>{s[0] + s.slice(1).toLowerCase()}</Button>)}
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={portal} disabled={pending} onChange={(e) => run(() => updateFile(id, { sharedWithPortal: e.target.checked }), e.target.checked ? "Visible in client portal." : "Hidden from portal.")} /> Share with the client portal</label>
      <details>
        <summary className="cursor-pointer font-medium text-blue">Share with team…</summary>
        <div className="mt-2 flex flex-wrap gap-3">{people.map((p) => <label key={p.id} className="flex items-center gap-1.5"><input type="checkbox" checked={picked.includes(p.id)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, p.id] : x.filter((y) => y !== p.id)))} />{p.name}</label>)}</div>
        <Button size="sm" className="mt-2" disabled={pending} onClick={() => run(() => shareFile(id, picked), "Sharing updated.")}>Save</Button>
      </details>
      <Button size="sm" variant={trashed ? "outline" : "destructive"} disabled={pending} onClick={() => run(() => trashFile(id, trashed), trashed ? "Restored." : "Moved to Trash.")}>{trashed ? "Restore" : "Move to Trash"}</Button>
    </div>
  );
}
