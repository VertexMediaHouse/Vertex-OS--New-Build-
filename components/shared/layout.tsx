import type { LucideIcon } from "lucide-react";
import { Inbox, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, IconTile } from "./primitives";

/** Page title + subtitle on the left, actions on the right. */
export function PageHeader({ title, subtitle, actions, className }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-4xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-base text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

/** Label / value rows (Project Details, Invoice drawer, File details). */
export function KeyValue({ rows, labelWidth = 110, className }: { rows: [React.ReactNode, React.ReactNode][]; labelWidth?: number; className?: string }) {
  return (
    <dl className={cn("grid gap-y-3 text-xs", className)} style={{ gridTemplateColumns: `${labelWidth}px minmax(0, 1fr)` }}>
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="self-center text-ink-muted">{k}</dt>
          <dd className="min-w-0 self-center font-medium text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Right-hand detail panel. Docked as a column on wide screens (as in the PDF). */
export function SidePanel({ title, closeHref, header, className, children }: { title: React.ReactNode; closeHref: string; header?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)} role="complementary" aria-label={typeof title === "string" ? title : "Details"}>
      <div className="flex items-start gap-3 px-4 pt-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] leading-6 font-bold text-ink">{title}</h2>
          {header && <div className="mt-2 flex flex-wrap items-center gap-2">{header}</div>}
        </div>
        <Link href={closeHref} scroll={false} aria-label="Close" className="rounded-md p-1 text-ink-2 hover:bg-accent">
          <X className="size-[18px]" />
        </Link>
      </div>
      <div className="flex-1 px-4 pt-3 pb-4">{children}</div>
    </Card>
  );
}

export function EmptyState({ icon = Inbox, title, hint, action, className }: { icon?: LucideIcon; title: string; hint?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-10 text-center", className)}>
      <IconTile icon={icon} tone="slate" />
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="max-w-xs text-xs text-ink-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Skeleton card matching a SectionCard's shape. */
export function CardSkeleton({ className, rows = 4 }: { className?: string; rows?: number }) {
  return (
    <Card className={cn("p-4", className)} aria-busy>
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-[10px]" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-3.5" style={{ width: `${90 - i * 12}%` }} />
        ))}
      </div>
    </Card>
  );
}

export function KpiSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("p-4", className)} aria-busy>
      <div className="flex gap-3.5">
        <Skeleton className="size-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
      <Skeleton className="mt-5 h-8" />
    </Card>
  );
}
