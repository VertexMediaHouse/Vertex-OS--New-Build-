"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown, Search } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatRange } from "@/lib/format";
import { dayKey, parseDay, PRESET_LABELS } from "@/lib/period";
import { useHrefWith } from "./nav";

/** Search box bound to ?{param}= (debounced). variant="filled" = grey, borderless (PDF search inputs). */
export function SearchInput({ placeholder, param = "q", className, variant = "filled" }: { placeholder: string; param?: string; className?: string; variant?: "filled" | "outline" }) {
  const params = useSearchParams();
  const router = useRouter();
  const hrefWith = useHrefWith();
  const urlValue = params.get(param) ?? "";
  const [value, setValue] = useState(urlValue);
  const [, startTransition] = useTransition();

  // The URL can change without typing (a "Clear" link, a company switch): follow it, during
  // render rather than in an effect.
  const [prevUrlValue, setPrevUrlValue] = useState(urlValue);
  if (prevUrlValue !== urlValue) {
    setPrevUrlValue(urlValue);
    setValue(urlValue);
  }

  useEffect(() => {
    // Already what the URL says (first render, or the URL changed on its own): nothing to push.
    if (value.trim() === urlValue) return;
    const t = setTimeout(() => startTransition(() => router.replace(hrefWith({ [param]: value.trim() || null, page: null }), { scroll: false })), 300);
    return () => clearTimeout(t);
    // hrefWith changes every render; only typing should trigger navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <label className={cn("relative flex h-9 items-center", className)}>
      <Search className="pointer-events-none absolute left-3 size-4 text-ink-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder.replace(/\.\.\.$|…$/, "")}
        className={cn(
          "h-full w-full rounded-lg pr-3 pl-9 text-xs text-ink outline-none placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-ring/40",
          variant === "filled" ? "bg-surface-muted" : "border border-input bg-card",
        )}
      />
    </label>
  );
}

/** Dropdown bound to ?{param}=. The first option ("All Sources") clears the param. */
export function FilterSelect({ param, options, placeholder, className }: { param: string; options: { value: string; label: string }[]; placeholder: string; className?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const hrefWith = useHrefWith();
  const current = params.get(param) ?? "__all";
  return (
    <Select value={current} onValueChange={(v) => router.replace(hrefWith({ [param]: v === "__all" ? null : v, page: null }), { scroll: false })}>
      <SelectTrigger aria-label={placeholder} className={cn("h-9! min-w-[116px] bg-card text-xs text-ink-2", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** "Clear" link that drops the given params. */
export function ClearFilters({ params: keys }: { params: string[] }) {
  const hrefWith = useHrefWith();
  return (
    <Link href={hrefWith(Object.fromEntries(keys.map((k) => [k, null])))} scroll={false} className="px-1 text-xs font-medium text-brand-text hover:underline">
      Clear
    </Link>
  );
}

/**
 * Period picker bound to ?range=&from=&to=. `from`/`to` are the resolved period (YYYY-MM-DD,
 * `to` inclusive) so the label is right on first render. variant="card" = dashboard two-line card.
 */
export function DateRangePicker({ from, to, preset, variant = "button", className }: { from: string; to: string; preset: string; variant?: "button" | "card"; className?: string }) {
  const router = useRouter();
  const hrefWith = useHrefWith();
  const [open, setOpen] = useState(false);
  const fromDate = parseDay(from)!;
  const toDate = parseDay(to)!;
  const [range, setRange] = useState<DateRange | undefined>({ from: fromDate, to: toDate });
  const label = formatRange(fromDate, toDate);

  const apply = (patch: Record<string, string | null>) => {
    setOpen(false);
    router.replace(hrefWith({ ...patch, page: null }), { scroll: false });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2.5 rounded-lg border bg-card text-left text-xs text-ink-2 transition-colors hover:bg-accent",
            variant === "button" ? "h-9 px-3" : "h-14 rounded-xl px-3.5 shadow-card",
            className,
          )}
        >
          {variant === "card" ? (
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-review-soft text-review-text">
              <CalendarDays className="size-4" aria-hidden />
            </span>
          ) : (
            <CalendarDays className="size-4 text-brand-text" aria-hidden />
          )}
          {variant === "card" ? (
            <span className="flex flex-col">
              <span className="text-xs font-semibold text-ink">{preset === "custom" ? "Custom" : PRESET_LABELS[preset as keyof typeof PRESET_LABELS]}</span>
              <span className="text-[10.5px] text-ink-muted">{label}</span>
            </span>
          ) : (
            <span className="font-medium text-ink">{label}</span>
          )}
          <ChevronDown className={cn("size-4 text-ink-muted", variant === "card" && "ml-4")} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-auto gap-3 p-3">
        <div className="flex w-32 flex-col gap-1 border-r pr-3">
          {(Object.keys(PRESET_LABELS) as (keyof typeof PRESET_LABELS)[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => apply({ range: p === "month" ? null : p, from: null, to: null })}
              className={cn("rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent", preset === p && "bg-brand-soft font-semibold text-brand-text")}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>
        <div>
          <Calendar mode="range" numberOfMonths={1} selected={range} onSelect={setRange} defaultMonth={fromDate} />
          <div className="flex items-center justify-between gap-3 border-t pt-2">
            <span className="text-2xs text-ink-muted">{range?.from && range.to ? `${formatDate(range.from)} – ${formatDate(range.to)}` : "Pick start and end"}</span>
            <button
              type="button"
              disabled={!range?.from || !range.to}
              onClick={() => apply({ range: "custom", from: dayKey(range!.from!), to: dayKey(range!.to!) })}
              className="rounded-md bg-brand-strong px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
