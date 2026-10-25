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

