// Pure workload/turnaround helpers (unit-tested).

/** (logged + planned minutes) ÷ weekly capacity, as a percent. */
export function workloadPercent(loggedMin: number, plannedMin: number, capacityHours: number): number {
  if (capacityHours <= 0) return 0;
  return ((loggedMin + plannedMin) / (capacityHours * 60)) * 100;
}

/** > 100% = Over (red), < 50% = Idle (amber), else fine (green). */
export function workloadState(pct: number): "over" | "idle" | "ok" {
  if (pct > 100) return "over";
  if (pct < 50) return "idle";
  return "ok";
}

/** Mean hours from editing start to delivery; null when nothing was delivered. */
export function avgTurnaroundHours(items: { start: Date | null; end: Date | null }[]): number | null {
  const spans = items.filter((i) => i.start && i.end).map((i) => (i.end!.getTime() - i.start!.getTime()) / 3_600_000);
  return spans.length ? spans.reduce((a, b) => a + b, 0) / spans.length : null;
}

/** Waiting Since pill: 1 day = amber, 2+ days = red. */
export function waitingDays(requestedAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - requestedAt.getTime()) / 86_400_000));
}
