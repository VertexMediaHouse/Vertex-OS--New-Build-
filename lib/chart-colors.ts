// Chart series colours. Hues follow the PDF; purple/blue pairs are split by lightness so
// they stay distinct for colour-blind readers (checked with the dataviz palette validator,
// see docs/decisions.md). Grey is reserved for "Other".

export const COMPANY_COLORS = { VMH: "#8650F8", VTH: "#28C89C", TOTAL: "#1E293B" } as const;

export const OTHER_GREY = "#B8C0CC";

export const WORK_CATEGORY_COLORS: Record<string, string> = {
  VIDEO_EDITING: "#A78BFA",
  WEBSITE_DEVELOPMENT: "#2563EB",
  CRM_ERP: "#10B981",
  AUTOMATION: "#F59E0B",
  DESIGN: "#F26B6B",
  MEETINGS: OTHER_GREY,
  OTHER: OTHER_GREY,
};

export const WORK_CATEGORY_LABELS: Record<string, string> = {
  VIDEO_EDITING: "Video Editing",
  WEBSITE_DEVELOPMENT: "Website Development",
  CRM_ERP: "CRM / ERP",
  AUTOMATION: "Automation (n8n)",
  DESIGN: "Design (Thumbnails)",
  MEETINGS: "Meetings",
  OTHER: "Others",
};

/** Goals by Category donut: five named slots, the rest fold into "Other". */
export const GOAL_CATEGORY_COLORS: Record<string, string> = {
  REVENUE_SALES: "#7C3AED",
  CLIENT_ACQUISITION: "#60A5FA",
  PROJECT_DELIVERY: "#10B981",
  TEAM_HIRING: "#F59E0B",
  PROCESS_AUTOMATION: "#F26B6B",
};

export const GOAL_CATEGORY_LABELS: Record<string, string> = {
  REVENUE_SALES: "Revenue & Sales",
  CLIENT_ACQUISITION: "Client Acquisition",
  PROJECT_DELIVERY: "Project Delivery",
  PRODUCT_DEVELOPMENT: "Product Development",
  TEAM_HIRING: "Team & Hiring",
  PROCESS_AUTOMATION: "Process & Automation",
  CONTENT_CREATION: "Content Creation",
  CLIENT_SUCCESS: "Client Success",
  LEARNING_GROWTH: "Learning & Growth",
};

export const CLIENT_SEGMENT_COLORS = { ACTIVE: "#10B981", ON_HOLD: "#F59E0B", COMPLETED: "#2563EB", INACTIVE: "#EF5356" } as const;

/** Dashboard Project Status donut (page 2). */
export const PROJECT_STATUS_COLORS = { notStarted: "#2563EB", inProgress: "#10B981", inReview: "#F59E0B", onHold: "#EF4444", delivered: "#A78BFA" } as const;

/** Reports Project Status donut (page 13). */
export const REPORT_STATUS_COLORS = { COMPLETED: "#10B981", IN_PROGRESS: "#2563EB", ON_HOLD: "#F59E0B", NOT_STARTED: "#EF5356" } as const;

/** Dashboard Tasks Overview donut (page 2). */
export const TASK_OVERVIEW_COLORS = { pending: "#2563EB", dueToday: "#F59E0B", overdue: "#EF4444", completed: "#10B981", upcoming: "#60A5FA" } as const;

/** Goal Progress Overview lines (page 10). */
export const GOAL_LINE_COLORS = { ALL: "#1D4ED8", VMH: "#A78BFA", VTH: "#28C89C" } as const;

/** VMH production board stage bars (page 1); each bar is labelled by its column. */
export const PRODUCTION_STAGE_COLORS: Record<string, string> = {
  EDITING: "#4290FC",
  INTERNAL_QC: "#96BEFC",
  CLIENT_REVIEW: "#9ED8F2",
  REVISION: "#FCA5A5",
  DELIVERED: "#4AD0A6",
};

export const AXIS = { grid: "#EEF2F6", text: "#94A3B8" } as const;
