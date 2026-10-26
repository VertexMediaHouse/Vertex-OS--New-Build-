"use client";

import Link from "@/components/ui/link";
import { usePathname, useNavigate, useSearchParams } from "@/lib/nav";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/status";
import { pageItems } from "@/lib/pagination";

/** Current URL with some search params replaced (null removes). */
export function useHrefWith() {
  const pathname = usePathname();
  const params = useSearchParams();
  return (patch: Record<string, string | number | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
}

// ── Filter tabs with counts: All (32) | VMH (18) | VTH (14) ─────────────
export type FilterTab = { value: string; label: string; count?: number; tone?: "blue" | "vmh" | "vth" | Tone };

const TAB_TONE: Record<string, string> = {
  blue: "bg-info-soft text-brand-text",
  vmh: "bg-vmh-soft text-vmh-text",
  vth: "bg-vth-soft text-vth-text",
  success: "bg-success-soft text-success-text",
  warning: "bg-warning-soft text-warning-text",
  danger: "bg-danger-soft text-danger-text",
  info: "bg-info-soft text-info-text",
  review: "bg-review-soft text-review-text",
  neutral: "bg-neutral-soft text-neutral-text",
};

/**
 * Pill tabs that write ?{param}=value. Every tab keeps its tint (as in the PDF); the
 * active one gets a ring so it reads as selected without relying on colour alone.
 */
export function FilterTabs({ tabs, param, active, className }: { tabs: FilterTab[]; param: string; active: string; className?: string }) {
  const hrefWith = useHrefWith();
  return (
    <div role="tablist" className={cn("flex flex-wrap items-center gap-2", className)}>
      {tabs.map((t) => {
        const selected = t.value === active;
        return (
          <Link
            key={t.value}
            role="tab"
            aria-selected={selected}
            href={hrefWith({ [param]: t.value === tabs[0]!.value ? null : t.value, page: null })}
            scroll={false}
            className={cn(
              "inline-flex h-8 items-center rounded-lg px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
              TAB_TONE[t.tone ?? "neutral"],
              selected ? "ring-1 ring-current/25" : "opacity-90 hover:opacity-100",
            )}
          >
            {t.label}
            {t.count !== undefined && ` (${t.count})`}
          </Link>
        );
      })}
    </div>
  );
}

// ── Underline tabs (Overview | Tasks | Files …) ─────────────────────────
export function UnderlineTabs({
  tabs,
  param = "tab",
  active,
  size = "md",
  className,
}: {
  tabs: { value: string; label: React.ReactNode }[];
  param?: string;
  active: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const hrefWith = useHrefWith();
  return (
    <div role="tablist" className={cn("flex items-end gap-1 border-b", className)}>
      {tabs.map((t) => {
        const selected = t.value === active;
        return (
          <Link
            key={t.value}
            role="tab"
            aria-selected={selected}
            href={hrefWith({ [param]: t.value === tabs[0]!.value ? null : t.value })}
            scroll={false}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 font-medium whitespace-nowrap transition-colors",
              size === "md" ? "h-10 text-md" : "h-11 text-base",
              selected ? "border-brand bg-brand-soft/40 text-brand-text" : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

// ── Segmented control (List | Kanban | Calendar, Day | Week | Month) ────
export function SegmentedControl({
  options,
  param,
  active,
  className,
}: {
  options: { value: string; label: React.ReactNode; icon?: React.ReactNode }[];
  param: string;
  active: string;
  className?: string;
}) {
  const hrefWith = useHrefWith();
  return (
    <div role="radiogroup" className={cn("inline-flex h-10 items-center rounded-lg border bg-card p-0.5", className)}>
      {options.map((o) => {
        const selected = o.value === active;
        return (
          <Link
            key={o.value}
            role="radio"
            aria-checked={selected}
            href={hrefWith({ [param]: o.value === options[0]!.value ? null : o.value })}
            scroll={false}
            className={cn(
              "inline-flex h-full items-center gap-1.5 rounded-md px-4 text-sm font-medium transition-colors",
              selected ? "bg-brand-strong text-white" : "text-ink-2 hover:bg-accent",
            )}
          >
            {o.icon}
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

// ── Pagination: "Showing 1 to 10 of 68 clients" + ‹ 1 2 3 4 5 … 7 › ────
export function Pagination({ page, pageSize, total, noun, className }: { page: number; pageSize: number; total: number; noun: string; className?: string }) {
  const hrefWith = useHrefWith();
  const navigate = useNavigate();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const go = (p: number) => navigate(hrefWith({ page: p === 1 ? null : p }), { preventScrollReset: true });
  const box = "inline-flex size-[30px] items-center justify-center rounded-md border text-xs font-medium transition-colors";
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <p className="text-xs text-ink-muted">
        Showing {from} to {to} of {total} {noun}
      </p>
      <nav aria-label="Pagination" className="flex items-center gap-1.5">
        <button type="button" className={cn(box, "bg-card disabled:opacity-40")} disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </button>
        {pageItems(page, pages).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-xs text-ink-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? "page" : undefined}
              onClick={() => go(p)}
              className={cn(box, p === page ? "border-brand bg-brand-strong text-white" : "bg-card text-ink-2 hover:bg-accent")}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" className={cn(box, "bg-card disabled:opacity-40")} disabled={page >= pages} onClick={() => go(page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" />
        </button>
      </nav>
    </div>
  );
}
