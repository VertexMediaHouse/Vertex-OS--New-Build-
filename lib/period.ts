import { addDays, addMonthsIST, IST_OFFSET_MS, startOfDayIST, startOfMonthIST, startOfWeekIST } from "./clock";

export type Preset = "today" | "week" | "month" | "quarter" | "custom";

export type Period = {
  preset: Preset;
  /** Inclusive start (00:00 IST). */
  from: Date;
  /** Exclusive end (00:00 IST of the day after the last day). */
  to: Date;
  /** Same length, immediately before; for trend chips. */
  prevFrom: Date;
  prevTo: Date;
};

export const PRESET_LABELS: Record<Exclude<Preset, "custom">, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  quarter: "This Quarter",
};

/** "2026-10-05" (IST) → Date at 00:00 IST. */
export function parseDay(value: string | undefined | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!) - IST_OFFSET_MS);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date → "2026-10-05" in IST. */
export function dayKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Resolve ?range=&from=&to= into a concrete period. Defaults to this month. */
export function resolvePeriod(params: { range?: string | null; from?: string | null; to?: string | null }, now: Date, fallback: Preset = "month"): Period {
  const from = parseDay(params.from);
  const to = parseDay(params.to);
  if (params.range === "custom" || (from && to && !params.range)) {
    if (from && to && from <= to) return withPrev("custom", from, addDays(to, 1));
  }
  const preset = (["today", "week", "month", "quarter"] as const).find((p) => p === params.range) ?? (fallback === "custom" ? "month" : fallback);
  const today = startOfDayIST(now);
  switch (preset) {
    case "today":
      return withPrev(preset, today, addDays(today, 1));
    case "week": {
      const start = startOfWeekIST(now);
      return withPrev(preset, start, addDays(start, 7));
    }
    case "quarter": {
      const month = startOfMonthIST(now);
      const m = new Date(month.getTime() + IST_OFFSET_MS).getUTCMonth();
      const start = addMonthsIST(month, -(m % 3));
      return withPrev(preset, start, addMonthsIST(start, 3));
    }
    default: {
      const start = startOfMonthIST(now);
      return withPrev("month", start, addMonthsIST(start, 1));
    }
  }
}

function withPrev(preset: Preset, from: Date, to: Date): Period {
  if (preset === "month") return { preset, from, to, prevFrom: addMonthsIST(from, -1), prevTo: from };
  if (preset === "quarter") return { preset, from, to, prevFrom: addMonthsIST(from, -3), prevTo: from };
  const len = to.getTime() - from.getTime();
  return { preset, from, to, prevFrom: new Date(from.getTime() - len), prevTo: from };
}

/** Last day included in the period (for "1 Oct 2026 - 31 Oct 2026"). */
export const lastDay = (p: Period) => addDays(p.to, -1);

/** % change; null when there's nothing to compare with. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
