import type { LucideIcon } from "lucide-react";
import { Check, Download, FileText, Folder, Image as ImageIcon, Music, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize, formatDate } from "@/lib/format";
import { Avatar, ProgressBar, type AvatarPerson, type BarTone } from "./primitives";

// ── File type icon ─────────────────────────────────────────────────────
type FileIconSpec = { bg: string; fg: string; icon?: LucideIcon; text?: string };

const FILE_ICONS: Record<string, FileIconSpec> = {
  PDF: { bg: "#FDECEC", fg: "#E5484D", text: "PDF" },
  FIG: { bg: "#F4F0FF", fg: "#A259FF", text: "F" },
  MP4: { bg: "#5B3FF5", fg: "#FFFFFF", icon: Play },
  MOV: { bg: "#5B3FF5", fg: "#FFFFFF", icon: Play },
  PNG: { bg: "#10B981", fg: "#FFFFFF", icon: ImageIcon },
  JPG: { bg: "#3B82F6", fg: "#FFFFFF", icon: ImageIcon },
  JPEG: { bg: "#3B82F6", fg: "#FFFFFF", icon: ImageIcon },
  DOCX: { bg: "#2B6CE6", fg: "#FFFFFF", text: "W" },
  XLSX: { bg: "#1E9E5A", fg: "#FFFFFF", text: "X" },
  AI: { bg: "#2B1A0E", fg: "#FF9A00", text: "Ai" },
  PSD: { bg: "#001E36", fg: "#31A8FF", text: "Ps" },
  JSON: { bg: "#6D3FF5", fg: "#FFFFFF", text: "{ }" },
  SRT: { bg: "#7C3AED", fg: "#FFFFFF", icon: FileText },
  MP3: { bg: "#7C3AED", fg: "#FFFFFF", icon: Music },
  ZIP: { bg: "#64748B", fg: "#FFFFFF", text: "ZIP" },
};

export function FileIcon({ ext, size = 28, folderColor }: { ext: string; size?: number; folderColor?: string }) {
  if (ext === "FOLDER") {
    return <Folder style={{ width: size, height: size, color: folderColor ?? "#308CFC", fill: folderColor ?? "#308CFC" }} strokeWidth={1.2} aria-hidden />;
  }
  const spec = FILE_ICONS[ext.toUpperCase()] ?? { bg: "#F1F4F8", fg: "#5B6478", icon: FileText };
  const Icon = spec.icon;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-md font-bold"
      style={{ width: size, height: size, background: spec.bg, color: spec.fg, fontSize: Math.round(size * (spec.text && spec.text.length > 2 ? 0.28 : 0.4)) }}
    >
      {Icon ? <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.2} /> : spec.text}
    </span>
  );
}

/** "Short_01_Final.mp4 · 24 MB • 20 Oct 2026" with optional status and download button. */
export function FileRow({ name, ext, size, date, status, href }: { name: string; ext: string; size: number; date: Date; status?: React.ReactNode; href?: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <FileIcon ext={ext} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-ink">{name}</p>
        <p className="text-2xs text-ink-muted">
          {formatFileSize(size)} • {formatDate(date)}
        </p>
      </div>
      {status}
      {href && (
        <a href={href} aria-label={`Download ${name}`} className="inline-flex size-8 items-center justify-center rounded-lg border text-ink-2 hover:bg-accent">
          <Download className="size-4" />
        </a>
      )}
    </div>
  );
}

// ── Timeline (milestone dots) ───────────────────────────────────────────
export type TimelinePoint = { label: string; date: string; state: "done" | "current" | "next" | "todo" };

/** Horizontal dots: done = filled, current = filled accent, next = ring, todo = hollow grey. */
export function Timeline({ points, doneColor = "var(--vmh)", currentColor = "var(--blue)" }: { points: TimelinePoint[]; doneColor?: string; currentColor?: string }) {
  const lastDone = points.reduce((acc, p, i) => (p.state === "done" || p.state === "current" ? i : acc), -1);
  return (
    <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
      {points.map((p, i) => {
        const color = p.state === "done" ? doneColor : p.state === "current" || p.state === "next" ? currentColor : "#C5CDD8";
        return (
          <li key={i} className="relative flex flex-col items-center text-center">
            {i < points.length - 1 && (
              <span className="absolute top-[6px] left-1/2 h-0.5 w-full" style={{ background: i < lastDone ? doneColor : i === lastDone ? currentColor : "#DDE3EA" }} aria-hidden />
            )}
            <span
              className="relative z-10 size-3.5 rounded-full border-2 bg-white"
              style={{ borderColor: color, background: p.state === "done" || p.state === "current" ? color : "#FFFFFF" }}
              aria-hidden
            />
            <span className="mt-2 text-2xs font-semibold text-ink">{p.date}</span>
            <span className="text-[10.5px] text-ink-muted">{p.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ── Checklist row (deliverables, task checklist, goal milestones) ───────
export function CheckRow({
  done,
  label,
  right,
  strike = false,
  round = false,
  person,
}: {
  done: boolean;
  label: React.ReactNode;
  right?: React.ReactNode;
  strike?: boolean;
  round?: boolean;
  person?: AvatarPerson;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span
        aria-hidden
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center border",
          round ? "rounded-full" : "rounded-[4px]",
          done ? (round ? "border-success bg-success text-white" : "border-brand bg-brand-strong text-white") : "border-input bg-white",
        )}
      >
        {done && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="sr-only">{done ? "Done:" : "Not done:"}</span>
      <span className={cn("min-w-0 flex-1 truncate text-xs text-ink", strike && done && "text-ink-muted line-through")}>{label}</span>
      {right}
      {person && <Avatar person={person} size={22} />}
    </div>
  );
}

/** Label + "8 / 12" + bar, or label + % + bar. */
export function MeterRow({ label, value, display, tone = "primary", barWidth = 72 }: { label: React.ReactNode; value: number; display: string; tone?: BarTone; barWidth?: number }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="min-w-0 flex-1 truncate text-xs text-ink">{label}</span>
      <span className="w-10 text-right text-2xs text-ink-2 tabular">{display}</span>
      <span style={{ width: barWidth }}>
        <ProgressBar value={value} tone={tone} />
      </span>
    </div>
  );
}

// ── Activity feed row ─────────────────────────────────────────────────
export function ActivityRow({ person, icon: Icon, iconClass, text, detail, time, right }: { person?: AvatarPerson; icon?: LucideIcon; iconClass?: string; text: React.ReactNode; detail?: React.ReactNode; time: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1">
      {person ? (
        <Avatar person={person} size={28} />
      ) : Icon ? (
        <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full", iconClass ?? "bg-surface-muted text-ink-2")}>
          <Icon className="size-3.5" aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-4 text-ink">{text}</p>
        {detail && <p className="text-2xs text-ink-muted">{detail}</p>}
        <p className="text-2xs text-ink-muted">{time}</p>
      </div>
      {right}
    </div>
  );
}
