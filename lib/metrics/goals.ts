import { addDays, startOfDayIST } from "@/lib/clock";

export type GoalStatusName = "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "COMPLETED" | "OVERDUE";

export type GoalThresholds = { onTrack: number; atRisk: number };

const num = (v: number | { toString(): string }) => Number(v.toString());

/** Percent of the way from start to target, 0–100. */
export function goalProgress(g: {
  startValue: number | { toString(): string };
  currentValue: number | { toString(): string };
  targetValue: number | { toString(): string };
}): number {
  const start = num(g.startValue);
  const span = num(g.targetValue) - start;
  if (span <= 0) return 100;
  return Math.max(0, Math.min(100, ((num(g.currentValue) - start) / span) * 100));
}

/**
 * Status from progress vs time elapsed: On Track when progress ≥ onTrack × expected,
 * At Risk when ≥ atRisk × expected, else Off Track. Past the end date below 100% = Overdue.
 */
export function goalStatus(input: {
  progress: number;
  startDate: Date;
  endDate: Date;
  now: Date;
  thresholds?: GoalThresholds;
}): GoalStatusName {
  const { progress, startDate, endDate, now } = input;
  const t = input.thresholds ?? { onTrack: 0.9, atRisk: 0.7 };
  if (progress >= 100) return "COMPLETED";
  // The end date counts as a whole day: a goal ending today is not overdue yet.
  if (now.getTime() >= addDays(startOfDayIST(endDate), 1).getTime()) return "OVERDUE";
  const span = endDate.getTime() - startDate.getTime();
  const elapsed = span <= 0 ? 1 : Math.max(0, Math.min(1, (now.getTime() - startDate.getTime()) / span));
  const expected = elapsed * 100;
  if (expected === 0) return "ON_TRACK";
  const ratio = progress / expected;
  if (ratio >= t.onTrack) return "ON_TRACK";
  if (ratio >= t.atRisk) return "AT_RISK";
  return "OFF_TRACK";
}
