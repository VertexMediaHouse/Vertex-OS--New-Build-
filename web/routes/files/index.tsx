// Ported from app/(app)/files/page.tsx: the Prisma work moved to server/routes/files.ts.
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Clock, Download, Folder, LayoutGrid, List, Share2, Star, Trash2, Users } from "lucide-react";
import { ActivityRow, FileIcon } from "@/components/shared/display";
import { FilterSelect, SearchInput } from "@/components/shared/filters";
import { CardSkeleton, EmptyState, KeyValue, PageHeader, SidePanel } from "@/components/shared/layout";
import { UnderlineTabs } from "@/components/shared/nav";
import { Avatar, AvatarStack, Card } from "@/components/shared/primitives";
import { FileMenuActions, NewFolderButton, StarButton, UploadButton } from "@/components/files/file-client";
import Link from "@/components/ui/link";
import { formatDate, formatFileSize, formatFullDateTime } from "@/lib/format";
import { useSearchParams } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { API_URL, api, query } from "@/web/api";
import { useTitle } from "@/web/title";

const CATS = [["CLIENT_FILES", "Client Files", "#308CFC", "#E6F0FD"], ["PROJECT_FILES", "Project Files", "#902EFC", "#F1E6FD"], ["DESIGN_ASSETS", "Design Assets", "#FC6C78", "#FDE6E9"], ["VIDEO_ASSETS", "Video Assets", "#FC9C0E", "#FDF0DD"], ["DOCUMENTS", "Documents", "#04CC88", "#DDF7EC"]] as const;

export default function FilesPage() {
  useTitle("Files");
  const [params] = useSearchParams();
  const sp = Object.fromEntries(params);
  const { data } = useQuery({ queryKey: ["files", sp], queryFn: () => query(api.api.files.$get({ query: sp })) });

  if (!data) return <CardSkeleton className="h-96" />;
  if (data.denied) return <p className="p-6 text-sm text-ink-2">You don&apos;t have access to files.</p>;

  const { folders, catCounts, files, subfolders, types, clients, projects, people, scope, canCreate } = data;
  const view = sp.view ?? "all"; // all | recent | starred | shared | trash
  const folderId = sp.folder;
  const openId = sp.id;
  const byParent = (pid: string | null) => folders.filter((f) => f.parentId === pid);
  const root = (cat: string) => folders.find((f) => f.parentId === null && f.category === cat);
  const filesIn = (cat: string) => { const ids = new Set(folders.filter((f) => f.category === cat).map((f) => f.id)); return catCounts.filter((x) => x.folderId && ids.has(x.folderId)).reduce((a, x) => a + x._count, 0); };
  const href = (patch: Record<string, string | null>) => { const n = { ...sp, ...patch }; return `?${new URLSearchParams(Object.entries(n).filter((e): e is [string, string] => e[1] !== null && e[1] !== ""))}`; };
  const crumbs: { id: string; name: string }[] = [];
  for (let f = folders.find((x) => x.id === folderId); f; f = folders.find((x) => x.id === f!.parentId)) crumbs.unshift(f);

  return (
    <div className="space-y-3.5">
      <PageHeader title="Files" subtitle="Store, organize and access all your files across clients and projects." actions={canCreate && <><UploadButton folderId={folderId} /><NewFolderButton parentId={folderId ?? null} /></>} />
      <div className="grid gap-3.5 md:grid-cols-3 xl:grid-cols-5">
        {CATS.map(([cat, label, color, bg]) => {
          const r = root(cat);
          return (
            <Link key={cat} href={href({ view: null, folder: r?.id ?? null, id: null })} className="flex items-center gap-3.5 rounded-xl border bg-card p-4 shadow-card hover:bg-accent">
              <span className="inline-flex size-12 items-center justify-center rounded-xl" style={{ background: bg }}><Folder className="size-6" style={{ color, fill: color }} /></span>
              <span><span className="block text-md font-bold text-ink">{label}</span><span className="text-sm text-ink-muted">{folders.filter((f) => f.category === cat && f.parentId).length} folders · {filesIn(cat)} files</span></span>
            </Link>
          );
        })}
      </div>
      <div className={cn("grid gap-3.5", openId ? "xl:grid-cols-[225px_1fr_285px]" : "xl:grid-cols-[225px_1fr]")}>
        <Card className="h-fit p-4 text-sm">
          <h2 className="mb-3 text-lg font-bold text-ink">Folders</h2>
          {([["all", "All Files", Folder], ["recent", "Recent", Clock], ["starred", "Starred", Star], ["shared", "Shared with Me", Users], ["trash", "Trash", Trash2]] as const).map(([v, label, Icon]) => (
            <Link key={v} href={href({ view: v === "all" ? null : v, folder: null, id: null })} className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5", view === v && !folderId ? "bg-brand-soft text-brand-text" : "text-ink-2 hover:bg-accent")}><Icon className="size-4" />{label}</Link>
          ))}
          <div className="my-3 border-t" />
          {CATS.concat([["TEAM_RESOURCES", "Team Resources", "#64748B", ""]] as never).map(([cat, label, color]) => {
            const r = root(cat);
            if (!r) return null;
            const kids = byParent(r.id);
            const open = folderId === r.id || kids.some((k) => k.id === folderId);
            return (
              <div key={cat}>
                <Link href={href({ view: null, folder: r.id, id: null })} className={cn("flex items-center gap-1.5 rounded-lg px-1 py-1.5", folderId === r.id ? "bg-brand-soft" : "hover:bg-accent")}><ChevronRight className={cn("size-3.5 text-ink-muted", open && "rotate-90")} /><Folder className="size-4" style={{ color, fill: color }} />{label}</Link>
                {open && kids.slice(0, 6).map((k) => <Link key={k.id} href={href({ view: null, folder: k.id, id: null })} className={cn("ml-6 flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs", folderId === k.id ? "bg-brand-soft" : "hover:bg-accent")}><Folder className="size-3.5" style={{ color: k.color ?? color, fill: k.color ?? color }} />{k.name}</Link>)}
                {open && kids.length > 6 && <p className="ml-7 py-1 text-xs text-brand-text">+ {kids.length - 6} more</p>}
              </div>
            );
          })}
        </Card>
        <Card className="min-w-0 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SearchInput placeholder="Search files and folders..." className="w-72" />
            <span className="ml-auto flex gap-1">
              <Link href={href({ layout: "grid" })} aria-label="Grid view" className={cn("inline-flex size-9 items-center justify-center rounded-lg", sp.layout === "grid" ? "bg-brand-strong text-white" : "border text-brand-text")}><LayoutGrid className="size-4" /></Link>
              <Link href={href({ layout: null })} aria-label="List view" className={cn("inline-flex size-9 items-center justify-center rounded-lg", sp.layout !== "grid" ? "bg-brand-strong text-white" : "border text-brand-text")}><List className="size-4" /></Link>
            </span>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <FilterSelect param="type" placeholder="All Types" options={types.map((t) => ({ value: t.ext, label: t.ext }))} />
            {scope === "ALL" && <FilterSelect param="co" placeholder="All Companies" options={[{ value: "vmh", label: "VMH" }, { value: "vth", label: "VTH" }]} />}
            <FilterSelect param="client" placeholder="All Clients" options={clients.map((x) => ({ value: x.id, label: x.name }))} />
            <FilterSelect param="project" placeholder="All Projects" options={projects.map((x) => ({ value: x.id, label: x.name }))} />
            <FilterSelect param="sort" placeholder="Last Modified" options={[{ value: "name", label: "Name" }, { value: "size", label: "Size" }]} />
          </div>
          {crumbs.length > 0 && <p className="mb-2 text-xs text-ink-muted"><Link href={href({ folder: null })} className="hover:underline">All Files</Link>{crumbs.map((x) => <span key={x.id}> › <Link href={href({ folder: x.id })} className="hover:underline">{x.name}</Link></span>)}</p>}
          {sp.layout === "grid" ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {subfolders.map((f) => <Link key={f.id} href={href({ folder: f.id })} className="flex flex-col items-center gap-2 rounded-lg border p-4 text-xs hover:bg-accent"><FileIcon ext="FOLDER" size={40} folderColor={f.color ?? undefined} />{f.name}</Link>)}
              {files.map((f) => <Link key={f.id} href={href({ id: f.id })} scroll={false} className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center text-xs hover:bg-accent"><FileIcon ext={f.ext} size={40} /><span className="w-full truncate">{f.name}</span><span className="text-ink-muted">{formatFileSize(f.size)}</span></Link>)}
            </div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-xs">
              <thead><tr className="text-left text-2xs text-ink-2">{["Name", "Type", "Size", "Last Modified", "Shared With", ""].map((h) => <th key={h} className="bg-surface-muted px-2 py-2 font-medium first:rounded-l-md last:rounded-r-md">{h}</th>)}</tr></thead>
              <tbody>
                {subfolders.map((f) => <tr key={f.id} className="border-b hover:bg-accent"><td className="px-2 py-2"><Link href={href({ folder: f.id, id: null })} className="flex items-center gap-2.5 font-medium text-ink"><FileIcon ext="FOLDER" size={24} folderColor={f.color ?? undefined} />{f.name}</Link></td><td className="px-2 text-ink-muted">Folder</td><td className="px-2">—</td><td className="px-2">{formatDate(new Date(f.updatedAt))}</td><td /><td /></tr>)}
                {files.map((f) => (
                  <tr key={f.id} className={cn("border-b", f.id === openId ? "bg-brand-soft" : "hover:bg-accent")}>
                    <td className="px-2 py-2"><Link href={href({ id: f.id })} scroll={false} className="flex items-center gap-2.5 font-medium text-ink"><FileIcon ext={f.ext} size={24} /><span className="truncate">{f.name}</span></Link></td>
                    <td className="px-2 text-ink-muted">{f.ext}</td>
                    <td className="px-2">{formatFileSize(f.size)}</td>
                    <td className="px-2">{formatDate(new Date(f.updatedAt))}</td>
                    <td className="px-2"><AvatarStack people={f.shares.flatMap((s: any) => (s.user ? [s.user] : []))} size={22} max={2} /></td>
                    <td className="px-2"><StarButton id={f.id} starred={f.starred} /></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
          {files.length === 0 && subfolders.length === 0 && <EmptyState title={view === "trash" ? "Trash is empty" : "No files here"} hint={view === "trash" ? "Deleted files stay here for 30 days." : undefined} />}
        </Card>
        {openId && <FilePanel id={openId} closeHref={href({ id: null, tab: null })} people={people} tab={sp.tab ?? "details"} />}
      </div>
    </div>
  );
}

function FilePanel({ id, closeHref, people, tab }: { id: string; closeHref: string; people: { id: string; name: string }[]; tab: string }) {
  const { data } = useQuery({ queryKey: ["files", "panel", id], queryFn: () => query(api.api.files[":id"].panel.$get({ param: { id } })) });
  if (!data) return <CardSkeleton />;
  if (!data.found) return null;

  const { file: f, activity, canUpdate } = data;
  const preview = f.mime.startsWith("image/") ? "image" : f.mime.startsWith("video/") ? "video" : null;
  const dl = `${API_URL}/api/files/${f.id}/download`;
  return (
    <SidePanel title={f.name} closeHref={closeHref}>
      <div className="flex h-48 items-center justify-center overflow-hidden rounded-xl bg-surface-muted">
        {preview === "image" ? (
          <img src={dl} alt={f.name} className="max-h-full object-contain" />
        ) : preview === "video" ? (
          <video src={dl} controls className="max-h-full" />
        ) : (
          <div className="flex h-40 w-32 flex-col items-center justify-center gap-2 rounded-lg bg-white shadow-card"><FileIcon ext={f.ext} size={36} /><span className="px-2 text-center text-[10.5px] font-semibold text-ink">{f.name.replace(/\.[^.]+$/, "")}</span></div>
        )}
      </div>
      <p className="mt-3 text-md font-bold text-ink">{f.name}</p>
      <p className="text-xs text-ink-muted">{formatFileSize(f.size)} · {f.ext}{f.version > 1 && ` · v${f.version}`}</p>
      <div className="mt-3 flex gap-2">
        <a href={dl} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-strong text-xs font-semibold text-white"><Download className="size-4" /> Download</a>
        <Link href={`${closeHref}${closeHref.includes("?") ? "&" : "?"}id=${f.id}&tab=share`} scroll={false} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs"><Share2 className="size-4" /> Share</Link>
      </div>
      <UnderlineTabs className="mt-3" active={tab} tabs={[{ value: "details", label: "Details" }, { value: "versions", label: "Version History" }, { value: "activity", label: "Activity" }, { value: "share", label: "Manage" }]} />
      <div className="pt-3">
        {tab === "details" && (
          <>
            <KeyValue labelWidth={92} rows={[
              ["Location", f.folder ? `${f.folder.parent ? `${f.folder.parent.name} › ` : ""}${f.folder.name}` : "—"],
              ["Uploaded by", <span key="u" className="flex items-center gap-1.5"><Avatar person={f.uploadedBy} size={20} />{f.uploadedBy.name}</span>],
              ["Uploaded on", formatFullDateTime(new Date(f.createdAt))],
              ["Last modified", formatFullDateTime(new Date(f.updatedAt))],
              ["Shared with", <AvatarStack key="s" people={f.shares.flatMap((s: any) => (s.user ? [s.user] : []))} size={22} />],
              ["Tags", f.tags.length ? <span key="t" className="flex flex-wrap gap-1">{f.tags.map((g) => <span key={g} className="rounded bg-brand-soft px-1.5 py-0.5 text-brand-text">{g}</span>)}</span> : "—"],
            ]} />
            {f.description && <><p className="mt-3 text-xs font-semibold text-ink">Description</p><p className="mt-1 rounded-lg bg-surface-muted p-2.5 text-xs text-ink-2">{f.description}</p></>}
          </>
        )}
        {tab === "versions" && (
          <ul className="space-y-2 text-xs">
            <li className="flex justify-between"><span><b>v{f.version}</b> (current) · {formatFileSize(f.size)}</span><a href={dl} className="text-brand-text">Download</a></li>
            {f.versions.map((v: any) => <li key={v.id} className="flex justify-between"><span>v{v.version} · {formatFileSize(v.size)} · {v.uploadedBy.name} · {formatDate(new Date(v.createdAt))}</span><a href={`${dl}?v=${v.version}`} className="text-brand-text">Download</a></li>)}
            {canUpdate && <li className="pt-2"><UploadButton fileId={f.id} label="Upload new version" /></li>}
          </ul>
        )}
        {tab === "activity" && activity.map((a) => <ActivityRow key={a.id} person={a.actor ?? undefined} text={a.summary} time={a.time} />)}
        {tab === "share" && canUpdate && <FileMenuActions id={f.id} trashed={Boolean(f.deletedAt)} status={f.status} portal={f.sharedWithPortal} people={people} shared={f.shares.flatMap((s: any) => (s.userId ? [s.userId] : []))} />}
      </div>
    </SidePanel>
  );
}
