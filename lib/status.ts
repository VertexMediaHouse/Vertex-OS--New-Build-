// Label + colour tone for every status-like enum, in one place (design-spec §1.1).

export type Tone = "success" | "warning" | "danger" | "info" | "review" | "neutral";

type Meta = { label: string; tone: Tone };
const m = (label: string, tone: Tone): Meta => ({ label, tone });

export const PROJECT_STATUS: Record<string, Meta> = {
  NOT_STARTED: m("Not Started", "neutral"),
  PLANNING: m("Planning", "review"),
  IN_PROGRESS: m("In Progress", "info"),
  EDITING: m("Editing", "info"),
  DEVELOPMENT: m("Development", "review"),
  IN_REVIEW: m("In Review", "warning"),
  CLIENT_REVIEW: m("Client Review", "warning"),
  REVISION: m("Revision", "danger"),
  ON_HOLD: m("On Hold", "warning"),
  COMPLETED: m("Completed", "success"),
  CANCELLED: m("Cancelled", "neutral"),
};

export const TASK_STATUS: Record<string, Meta> = {
  TODO: m("To Do", "neutral"),
  IN_PROGRESS: m("In Progress", "info"),
  IN_REVIEW: m("In Review", "review"),
  CLIENT_REVIEW: m("Client Review", "warning"),
  COMPLETED: m("Completed", "success"),
};

export const PRODUCTION_STAGE: Record<string, Meta> = {
  EDITING: m("Editing", "info"),
  INTERNAL_QC: m("Internal QC", "info"),
  CLIENT_REVIEW: m("Client Review", "warning"),
  REVISION: m("Revision", "danger"),
  DELIVERED: m("Delivered", "success"),
};

export const LEAD_STAGE: Record<string, Meta> = {
  NEW: m("New", "neutral"),
  CONTACTED: m("Contacted", "info"),
  PROPOSAL: m("Proposal", "review"),
  NEGOTIATION: m("Negotiation", "warning"),
  WON: m("Won", "success"),
  LOST: m("Lost", "danger"),
};

export const CLIENT_STATUS: Record<string, Meta> = {
  ACTIVE: m("Active", "success"),
  ON_HOLD: m("On Hold", "warning"),
  COMPLETED: m("Completed", "info"),
  INACTIVE: m("Inactive", "danger"),
};

export const INVOICE_STATUS: Record<string, Meta> = {
  DRAFT: m("Draft", "neutral"),
  PENDING: m("Pending", "warning"),
  PAID: m("Paid", "success"),
  OVERDUE: m("Overdue", "danger"),
  CANCELLED: m("Cancelled", "neutral"),
};

export const GOAL_STATUS: Record<string, Meta> = {
  ON_TRACK: m("On Track", "success"),
  AT_RISK: m("At Risk", "warning"),
  OFF_TRACK: m("Off Track", "danger"),
  COMPLETED: m("Completed", "success"),
  OVERDUE: m("Overdue", "danger"),
};

export const TIME_STATUS: Record<string, Meta> = {
  RUNNING: m("Running", "info"),
  PENDING: m("Pending", "warning"),
  APPROVED: m("Approved", "success"),
  REJECTED: m("Rejected", "danger"),
  NON_BILLABLE: m("Non-Billable", "neutral"),
};

export const APPROVAL_STATUS: Record<string, Meta> = {
  PENDING: m("Pending", "neutral"),
  APPROVED: m("Approved", "success"),
  REVISION: m("Revision", "danger"),
};

export const MILESTONE_STATUS: Record<string, Meta> = {
  PENDING: m("Pending", "neutral"),
  IN_PROGRESS: m("Progress", "info"),
  COMPLETED: m("Completed", "success"),
};

export const FILE_STATUS: Record<string, Meta> = {
  DRAFT: m("Draft", "neutral"),
  REVIEW: m("Review", "warning"),
  FINAL: m("Final", "success"),
};

export const PRIORITY: Record<string, Meta> = {
  HIGH: m("High", "danger"),
  MEDIUM: m("Medium", "warning"),
  LOW: m("Low", "success"),
};

/** Tailwind classes per tone: soft background + saturated text, plus the dot colour. */
export const TONE_CLASSES: Record<Tone, { pill: string; dot: string; bar: string }> = {
  success: { pill: "bg-success-soft text-success-text", dot: "bg-success", bar: "bg-success" },
  warning: { pill: "bg-warning-soft text-warning-text", dot: "bg-warning-text", bar: "bg-warning" },
  danger: { pill: "bg-danger-soft text-danger-text", dot: "bg-danger", bar: "bg-danger" },
  info: { pill: "bg-info-soft text-info-text", dot: "bg-info-text", bar: "bg-info" },
  review: { pill: "bg-review-soft text-review-text", dot: "bg-review", bar: "bg-review" },
  neutral: { pill: "bg-neutral-soft text-neutral-text", dot: "bg-neutral", bar: "bg-neutral" },
};
