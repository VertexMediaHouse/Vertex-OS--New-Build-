// VMH and VTH projects share one model; each template has its own statuses, tabs and billing types.

export const TEMPLATES = {
  VMH: {
    statuses: ["NOT_STARTED", "IN_PROGRESS", "EDITING", "CLIENT_REVIEW", "REVISION", "ON_HOLD", "COMPLETED"],
    tabs: ["overview", "tasks", "files", "access", "time", "invoices", "notes", "activity"],
    billing: ["MONTHLY_RETAINER", "FIXED_SCOPE"],
  },
  VTH: {
    statuses: ["PLANNING", "DEVELOPMENT", "IN_PROGRESS", "IN_REVIEW", "ON_HOLD", "COMPLETED"],
    tabs: ["overview", "tasks", "milestones", "files", "access", "time", "invoices", "notes", "activity"],
    billing: ["FIXED_SCOPE", "RETAINER_HOURS", "TIME_AND_MATERIALS"],
  },
} as const;

export const TAB_LABELS: Record<string, string> = {
  overview: "Overview", tasks: "Tasks", milestones: "Milestones", files: "Files", access: "Client Access", time: "Time Tracking", invoices: "Invoices", notes: "Notes", activity: "Activity",
};

export const BILLING_LABELS: Record<string, string> = {
  MONTHLY_RETAINER: "Monthly Retainer", FIXED_SCOPE: "Fixed Scope", RETAINER_HOURS: "Retainer (hours)", TIME_AND_MATERIALS: "Time & Materials",
};

/** List tabs: which statuses each tab includes. */
export const LIST_TABS = {
  all: null,
  active: ["NOT_STARTED", "PLANNING", "IN_PROGRESS", "EDITING", "DEVELOPMENT", "REVISION", "ON_HOLD"],
  review: ["IN_REVIEW", "CLIENT_REVIEW"],
  completed: ["COMPLETED"],
  // Not tabs: the groups the dashboard donut counts, so a slice can link to its own rows.
  notStarted: ["NOT_STARTED", "PLANNING"],
  inProgress: ["IN_PROGRESS", "EDITING", "DEVELOPMENT", "REVISION"],
  onHold: ["ON_HOLD"],
} as const;

/**
 * Progress: VMH = completed deliverable units ÷ target units; VTH = mean of key deliverable %.
 * Falls back to milestones done ÷ total when there are no deliverables.
 */
export function projectProgress(input: {
  template: "VMH" | "VTH";
  deliverables: { targetCount: number | null; completedCount: number | null; percent: number | null }[];
  milestones: { status: string }[];
}): number {
  const { template, deliverables, milestones } = input;
  if (template === "VMH") {
    const target = deliverables.reduce((a, d) => a + (d.targetCount ?? 0), 0);
    if (target > 0) return Math.round((deliverables.reduce((a, d) => a + Math.min(d.completedCount ?? 0, d.targetCount ?? 0), 0) / target) * 100);
  } else if (deliverables.length) {
    return Math.round(deliverables.reduce((a, d) => a + (d.percent ?? 0), 0) / deliverables.length);
  }
  if (milestones.length) return Math.round((milestones.filter((m) => m.status === "COMPLETED").length / milestones.length) * 100);
  return 0;
}
