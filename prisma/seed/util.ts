// Seed helpers: PDF-relative dates, a deterministic random generator, chunking.
import { addDays, daysBetween, IST_OFFSET_MS, now } from "../../lib/clock";

/** "Today" in the design PDF. All fixture dates are written relative to it. */
export const PDF_TODAY = "2026-10-22";

const pdfToday = istDate(PDF_TODAY, "12:00");
// When SEED_TODAY isn't set, everything shifts so the data stays "current".
export const SHIFT_DAYS = daysBetween(pdfToday, now());

function istDate(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, hh!, mm!) - IST_OFFSET_MS);
}

/** A PDF date ("2026-10-20", "10:00" IST), shifted to the seed's today. */
export function at(date: string, time = "09:00"): Date {
  return addDays(istDate(date, time), SHIFT_DAYS);
}

/** Days relative to the PDF's today, e.g. day(-3) = 19 Oct 2026 09:00 IST. */
export function day(offset: number, time = "09:00"): Date {
  return addDays(at(PDF_TODAY, time), offset);
}

/** Minutes before the real current instant (activity feeds: "2 minutes ago"). */
export function minutesAgo(minutes: number): Date {
  return new Date(now().getTime() - minutes * 60_000);
}

/** mulberry32: same seed, same data on every run. */
export function rng(seed = 20261022) {
  let a = seed;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
  };
}

/** Split `total` into parts between min and max (multiples of `step`), summing exactly to total. */
export function splitTotal(total: number, min: number, max: number, step: number, r: ReturnType<typeof rng>): number[] {
  const parts: number[] = [];
  let left = total;
  while (left > 0) {
    if (left <= max) {
      parts.push(left);
      break;
    }
    let part = Math.round(r.int(min, max) / step) * step;
    if (left - part < min) part = left - min;
    parts.push(part);
    left -= part;
  }
  return parts;
}

/** Exactly `count` parts (multiples of `step`) summing to `total`, varied around the average. */
export function splitInto(total: number, count: number, step: number, r: ReturnType<typeof rng>): number[] {
  const avg = total / count;
  const parts: number[] = [];
  for (let i = 0; i < count - 1; i++) parts.push(Math.max(step, Math.round((avg * (0.6 + r.next() * 0.8)) / step) * step));
  const last = total - parts.reduce((a, b) => a + b, 0);
  if (last >= step) return [...parts, last];
  // Variation overshot: fall back to near-equal parts.
  const even = Math.floor(avg / step) * step;
  return [...Array(count - 1).fill(even), total - even * (count - 1)];
}

/** Weekdays (Mon–Fri) from `from` to `to` inclusive, as PDF date strings. */
export function weekdays(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (let d = start; d <= end; d = new Date(d.getTime() + 86_400_000)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
