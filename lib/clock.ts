// Single source of "now". SEED_TODAY (YYYY-MM-DD) pins the date so seeded data and the
// app agree (screenshots, E2E); the time of day still advances normally.
export function now(): Date {
  const pinned = process.env.SEED_TODAY;
  const real = new Date();
  if (!pinned) return real;
  const [y, m, d] = pinned.split("-").map(Number);
  // Keep the real IST wall-clock time on the pinned IST date.
  const ist = new Date(real.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(y, m - 1, d, ist.getUTCHours(), ist.getUTCMinutes(), ist.getUTCSeconds()) - IST_OFFSET_MS);
}

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const APP_TIMEZONE = "Asia/Kolkata";

/** Midnight (IST) at the start of the given instant's IST day, as a UTC Date. */
export function startOfDayIST(date: Date): Date {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Monday 00:00 IST of the week containing `date`. */
export function startOfWeekIST(date: Date): Date {
  const day = startOfDayIST(date);
  const weekday = new Date(day.getTime() + IST_OFFSET_MS).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

/** 1st of the month 00:00 IST. */
export function startOfMonthIST(date: Date): Date {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS);
}

export function addMonthsIST(monthStart: Date, months: number): Date {
  const ist = new Date(monthStart.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + months, 1) - IST_OFFSET_MS);
}

/** Whole calendar days from `from` to `to` (IST), e.g. due-date countdowns. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDayIST(to).getTime() - startOfDayIST(from).getTime()) / 86_400_000);
}
