import { APP_TIMEZONE, daysBetween } from "./clock";

type Money = number | string | { toString(): string };

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** ₹12,45,000 (Prisma Decimals, strings and numbers all accepted). */
export function formatINR(value: Money): string {
  return inr.format(Number(value.toString()));
}

export function formatMoney(value: Money, currency = "INR"): string {
  return currency === "USD" ? usd.format(Number(value.toString())) : formatINR(value);
}

/** Axis labels: ₹50K, ₹1.5L, ₹10L, ₹1.2Cr. */
export function formatINRCompact(value: number): string {
  if (value === 0) return "0";
  const sign = value < 0 ? "-" : "";
  const n = Math.abs(value);
  if (n >= 1e7) return `${sign}₹${trim(n / 1e7)}Cr`;
  if (n >= 1e5) return `${sign}₹${trim(n / 1e5)}L`;
  if (n >= 1e3) return `${sign}₹${trim(n / 1e3)}K`;
  return `${sign}₹${n}`;
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** 186h 30m, 2h 00m, 45m. */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = String(m % 60).padStart(2, "0");
  return h === 0 ? `${m}m` : `${h}h ${rest}m`;
}

/** Hours only, rounded: "28h". */
export function formatHours(minutes: number): string {
  return `${Math.round(minutes / 60)}h`;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: APP_TIMEZONE });
const shortFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: APP_TIMEZONE });
const longFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: APP_TIMEZONE });
const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: APP_TIMEZONE });
const monthYearFmt = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: APP_TIMEZONE });
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: APP_TIMEZONE });

/** 20 Oct 2026 */
export const formatDate = (d: Date) => dateFmt.format(d);
/** 20 Oct */
export const formatShortDate = (d: Date) => shortFmt.format(d);
/** Thursday, 22 October 2026 (Intl puts a comma after the weekday in en-GB already) */
export const formatLongDate = (d: Date) => longFmt.format(d);
/** 10:00 AM */
export const formatTime = (d: Date) => timeFmt.format(d);
/** 02:00 PM: zero-padded hour, as in the dashboard agenda */
export const formatTimePadded = (d: Date) => formatTime(d).padStart(8, "0");
/** 20 Oct, 10:30 AM */
export const formatDateTime = (d: Date) => `${formatShortDate(d)}, ${formatTime(d)}`;
/** 20 Oct 2026, 10:30 AM */
export const formatFullDateTime = (d: Date) => `${formatDate(d)}, ${formatTime(d)}`;
/** Oct 2026 */
export const formatMonthYear = (d: Date) => monthYearFmt.format(d);
/** Oct */
export const formatMonth = (d: Date) => monthFmt.format(d);
/** 1 Oct 2026 - 31 Oct 2026 */
export const formatRange = (from: Date, to: Date) => `${formatDate(from)} - ${formatDate(to)}`;

/** "2 minutes ago", "3 hours ago", "1 day ago", "1 week ago", "2 weeks ago". */
export function formatRelative(date: Date, now: Date): string {
  const sec = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"} ago`;
  if (sec < 60) return "just now";
  if (sec < 3600) return unit(Math.floor(sec / 60), "minute");
  if (sec < 86_400) return unit(Math.floor(sec / 3600), "hour");
  const days = Math.floor(sec / 86_400);
  if (days < 7) return unit(days, "day");
  if (days < 30) return unit(Math.floor(days / 7), "week");
  if (days < 365) return unit(Math.floor(days / 30), "month");
  return unit(Math.floor(days / 365), "year");
}

/** "(4 days left)", "(1 day left)", "(due today)", "(2 days overdue)". */
export function formatDaysLeft(due: Date, now: Date): string {
  const d = daysBetween(now, due);
  if (d > 1) return `${d} days left`;
  if (d === 1) return "1 day left";
  if (d === 0) return "due today";
  return d === -1 ? "1 day overdue" : `${-d} days overdue`;
}

/** File sizes as in the PDF: 850 KB, 2.4 MB, 48 KB. */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) {
    const mb = bytes / 1024 ** 2;
    return `${Number.isInteger(Math.round(mb * 10) / 10) ? Math.round(mb) : mb.toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}
