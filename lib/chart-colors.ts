// Chart series colours, drawn from the iOS system palette so a chart reads the same way
// as the rest of the UI: green means done or healthy, red means a problem, orange means
// waiting, blue and indigo are neutral progress, and grey is reserved for "Other" and
// "Not started". Hues are kept far enough apart to stay distinct for colour-blind readers
// (checked with the dataviz palette validator, see docs/decisions.md).

const GREEN = "#34C759";
const RED = "#FF3B30";
const ORANGE = "#FF9500";
const BLUE = "#007AFF";
const INDIGO = "#5856D6";
const PURPLE = "#AF52DE";
const BRAND = "#FF4D31";

export const COMPANY_COLORS = { VMH: "#7A78E8", VTH: "#30B0C7", TOTAL: "#1C1C1E" } as const;

export const OTHER_GREY = "#C7C7CC";
export const STATUS_GREY = "#8E8E93";

export const WORK_CATEGORY_COLORS: Record<string, string> = {
  VIDEO_EDITING: PURPLE,
  WEBSITE_DEVELOPMENT: BLUE,
  CRM_ERP: GREEN,
  AUTOMATION: ORANGE,
  DESIGN: BRAND,
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
  REVENUE_SALES: BRAND,
  CLIENT_ACQUISITION: BLUE,
  PROJECT_DELIVERY: GREEN,
  TEAM_HIRING: ORANGE,
  PROCESS_AUTOMATION: PURPLE,
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

export const CLIENT_SEGMENT_COLORS = { ACTIVE: GREEN, ON_HOLD: ORANGE, COMPLETED: BLUE, INACTIVE: STATUS_GREY } as const;

/** Dashboard Project Status donut (page 2). */
export const PROJECT_STATUS_COLORS = { notStarted: STATUS_GREY, inProgress: BLUE, inReview: ORANGE, onHold: RED, delivered: GREEN } as const;

/** Reports Project Status donut (page 13). */
export const REPORT_STATUS_COLORS = { COMPLETED: GREEN, IN_PROGRESS: BLUE, ON_HOLD: ORANGE, NOT_STARTED: STATUS_GREY } as const;

/** Dashboard Tasks Overview donut (page 2). */
export const TASK_OVERVIEW_COLORS = { pending: BLUE, dueToday: ORANGE, overdue: RED, completed: GREEN, upcoming: INDIGO } as const;

/** Leads board and pipeline: grey at the top of the funnel, green won, red lost. */
export const LEAD_STAGE_COLORS: Record<string, string> = {
  NEW: STATUS_GREY,
  CONTACTED: BLUE,
  PROPOSAL: INDIGO,
  NEGOTIATION: PURPLE,
  WON: GREEN,
  LOST: RED,
};

/** Goal Progress Overview lines (page 10). */
export const GOAL_LINE_COLORS = { ALL: BRAND, VMH: "#7A78E8", VTH: "#30B0C7" } as const;

/** VMH production board stage bars (page 1); each bar is labelled by its column. */
export const PRODUCTION_STAGE_COLORS: Record<string, string> = {
  EDITING: BLUE,
  INTERNAL_QC: INDIGO,
  CLIENT_REVIEW: ORANGE,
  REVISION: RED,
  DELIVERED: GREEN,
};

export const AXIS = { grid: "#E5E5EA", text: "#8E8E93" } as const;

const LOGO_COLORS = ["#2563EB", "#10B981", "#0F172A", "#7C3AED", "#DB2777", "#F59E0B", "#0EA5E9", "#EF4444"];
/** Stable per-client accent, from the name alone. */
export const logoColor = (name?: string | null) => LOGO_COLORS[[...(name ?? "")].reduce((a, c) => a + c.charCodeAt(0), 0) % LOGO_COLORS.length]!;
