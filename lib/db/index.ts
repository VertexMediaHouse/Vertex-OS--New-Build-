// In-memory mock database layer connected directly to Google Sheets.
// Hydrated on startup from Google Sheets, with local mock fallback.
// Mutations mutate memory for 0ms latency and async-sync to Google Sheets.

import { fetchAllFromSheets, scheduleTableSync, isSheetsConfigured } from "../sheets";
import { SCHEMA } from "./schema";
// Only company/user/membership/account ship with real (non-mock) seed rows, in ./seed.ts.
// Every business table starts empty here — Google Sheets is the live source of truth —
// and is typed off a sample row in ./schema.ts instead.
import { companyData, userData, membershipData, accountData } from "./seed";

// ───────────────────────────── Enums ─────────────────────────────

export const CompanyCode = { VMH: "VMH", VTH: "VTH" } as const;
export type CompanyCode = (typeof CompanyCode)[keyof typeof CompanyCode];

export const UserKind = { STAFF: "STAFF", CLIENT: "CLIENT" } as const;
export type UserKind = (typeof UserKind)[keyof typeof UserKind];

export const MemberRole = { ADMIN: "ADMIN", MANAGER: "MANAGER", MEMBER: "MEMBER" } as const;
export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];

export const ClientStatus = { ACTIVE: "ACTIVE", ON_HOLD: "ON_HOLD", COMPLETED: "COMPLETED", INACTIVE: "INACTIVE" } as const;
export type ClientStatus = (typeof ClientStatus)[keyof typeof ClientStatus];

export const LeadStage = { NEW: "NEW", CONTACTED: "CONTACTED", PROPOSAL: "PROPOSAL", NEGOTIATION: "NEGOTIATION", WON: "WON", LOST: "LOST" } as const;
export type LeadStage = (typeof LeadStage)[keyof typeof LeadStage];

export const LeadSource = { FIVERR: "FIVERR", WEBSITE: "WEBSITE", REFERRAL: "REFERRAL", LINKEDIN: "LINKEDIN", EMAIL: "EMAIL", INSTAGRAM: "INSTAGRAM", OTHER: "OTHER" } as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];

export const AlertStatus = { OPEN: "OPEN", CONVERTED: "CONVERTED", DISMISSED: "DISMISSED" } as const;
export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];

export const ProjectTemplate = { VMH: "VMH", VTH: "VTH" } as const;
export type ProjectTemplate = (typeof ProjectTemplate)[keyof typeof ProjectTemplate];

export const ProjectStatus = {
  NOT_STARTED: "NOT_STARTED",
  PLANNING: "PLANNING",
  IN_PROGRESS: "IN_PROGRESS",
  EDITING: "EDITING",
  DEVELOPMENT: "DEVELOPMENT",
  IN_REVIEW: "IN_REVIEW",
  CLIENT_REVIEW: "CLIENT_REVIEW",
  REVISION: "REVISION",
  ON_HOLD: "ON_HOLD",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const WorkCategory = {
  VIDEO_EDITING: "VIDEO_EDITING",
  WEBSITE_DEVELOPMENT: "WEBSITE_DEVELOPMENT",
  CRM_ERP: "CRM_ERP",
  AUTOMATION: "AUTOMATION",
  DESIGN: "DESIGN",
  MEETINGS: "MEETINGS",
  OTHER: "OTHER",
} as const;
export type WorkCategory = (typeof WorkCategory)[keyof typeof WorkCategory];

export const Priority = { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH" } as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const BillingType = {
  MONTHLY_RETAINER: "MONTHLY_RETAINER",
  FIXED_SCOPE: "FIXED_SCOPE",
  RETAINER_HOURS: "RETAINER_HOURS",
  TIME_AND_MATERIALS: "TIME_AND_MATERIALS",
} as const;
export type BillingType = (typeof BillingType)[keyof typeof BillingType];

export const MilestoneStatus = { PENDING: "PENDING", IN_PROGRESS: "IN_PROGRESS", COMPLETED: "COMPLETED" } as const;
export type MilestoneStatus = (typeof MilestoneStatus)[keyof typeof MilestoneStatus];

export const ApprovalStatus = { PENDING: "PENDING", APPROVED: "APPROVED", REVISION: "REVISION" } as const;
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const ProductionStage = {
  EDITING: "EDITING",
  INTERNAL_QC: "INTERNAL_QC",
  CLIENT_REVIEW: "CLIENT_REVIEW",
  REVISION: "REVISION",
  DELIVERED: "DELIVERED",
} as const;
export type ProductionStage = (typeof ProductionStage)[keyof typeof ProductionStage];

export const IssueStatus = { OPEN: "OPEN", IN_PROGRESS: "IN_PROGRESS", RESOLVED: "RESOLVED", CLOSED: "CLOSED" } as const;
export type IssueStatus = (typeof IssueStatus)[keyof typeof IssueStatus];

export const Severity = { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", CRITICAL: "CRITICAL" } as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const TaskStatus = { TODO: "TODO", IN_PROGRESS: "IN_PROGRESS", IN_REVIEW: "IN_REVIEW", CLIENT_REVIEW: "CLIENT_REVIEW", COMPLETED: "COMPLETED" } as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TimeEntryStatus = { RUNNING: "RUNNING", PENDING: "PENDING", APPROVED: "APPROVED", REJECTED: "REJECTED" } as const;
export type TimeEntryStatus = (typeof TimeEntryStatus)[keyof typeof TimeEntryStatus];

export const InvoiceStatus = { DRAFT: "DRAFT", PENDING: "PENDING", PAID: "PAID", OVERDUE: "OVERDUE", CANCELLED: "CANCELLED" } as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const PaymentMethod = {
  BANK_TRANSFER: "BANK_TRANSFER",
  UPI: "UPI",
  CARD: "CARD",
  PAYPAL: "PAYPAL",
  WISE: "WISE",
  CASH: "CASH",
  OTHER: "OTHER",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const GoalScope = { COMPANY: "COMPANY", TEAM: "TEAM", PERSONAL: "PERSONAL" } as const;
export type GoalScope = (typeof GoalScope)[keyof typeof GoalScope];

export const GoalCategory = {
  REVENUE_SALES: "REVENUE_SALES",
  CLIENT_ACQUISITION: "CLIENT_ACQUISITION",
  PROJECT_DELIVERY: "PROJECT_DELIVERY",
  PRODUCT_DEVELOPMENT: "PRODUCT_DEVELOPMENT",
  TEAM_HIRING: "TEAM_HIRING",
  PROCESS_AUTOMATION: "PROCESS_AUTOMATION",
  CONTENT_CREATION: "CONTENT_CREATION",
  CLIENT_SUCCESS: "CLIENT_SUCCESS",
  LEARNING_GROWTH: "LEARNING_GROWTH",
} as const;
export type GoalCategory = (typeof GoalCategory)[keyof typeof GoalCategory];

export const GoalMetric = {
  MANUAL: "MANUAL",
  REVENUE: "REVENUE",
  NEW_CLIENTS: "NEW_CLIENTS",
  PROJECTS_COMPLETED: "PROJECTS_COMPLETED",
  VIDEOS_DELIVERED: "VIDEOS_DELIVERED",
  LEADS_WON: "LEADS_WON",
  BILLABLE_HOURS: "BILLABLE_HOURS",
} as const;
export type GoalMetric = (typeof GoalMetric)[keyof typeof GoalMetric];

export const GoalUnit = { CURRENCY: "CURRENCY", COUNT: "COUNT", PERCENT: "PERCENT", HOURS: "HOURS" } as const;
export type GoalUnit = (typeof GoalUnit)[keyof typeof GoalUnit];

export const GoalStatus = { ON_TRACK: "ON_TRACK", AT_RISK: "AT_RISK", OFF_TRACK: "OFF_TRACK", COMPLETED: "COMPLETED", OVERDUE: "OVERDUE" } as const;
export type GoalStatus = (typeof GoalStatus)[keyof typeof GoalStatus];

export const FolderCategory = {
  CLIENT_FILES: "CLIENT_FILES",
  PROJECT_FILES: "PROJECT_FILES",
  DESIGN_ASSETS: "DESIGN_ASSETS",
  VIDEO_ASSETS: "VIDEO_ASSETS",
  DOCUMENTS: "DOCUMENTS",
  TEAM_RESOURCES: "TEAM_RESOURCES",
} as const;
export type FolderCategory = (typeof FolderCategory)[keyof typeof FolderCategory];

export const FileStatus = { DRAFT: "DRAFT", REVIEW: "REVIEW", FINAL: "FINAL" } as const;
export type FileStatus = (typeof FileStatus)[keyof typeof FileStatus];

export const CampaignStatus = { DRAFT: "DRAFT", SCHEDULED: "SCHEDULED", ACTIVE: "ACTIVE", PAUSED: "PAUSED", COMPLETED: "COMPLETED" } as const;
export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const RecipientStatus = { QUEUED: "QUEUED", SENT: "SENT", OPENED: "OPENED", REPLIED: "REPLIED", BOUNCED: "BOUNCED" } as const;
export type RecipientStatus = (typeof RecipientStatus)[keyof typeof RecipientStatus];

export const EventType = { CALL: "CALL", REVIEW: "REVIEW", FOLLOW_UP: "FOLLOW_UP", MEETING: "MEETING" } as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

export const EntityType = {
  LEAD: "LEAD",
  CLIENT: "CLIENT",
  PROJECT: "PROJECT",
  TASK: "TASK",
  TIME_ENTRY: "TIME_ENTRY",
  INVOICE: "INVOICE",
  PAYMENT: "PAYMENT",
  GOAL: "GOAL",
  FILE: "FILE",
  CAMPAIGN: "CAMPAIGN",
  APPROVAL: "APPROVAL",
  EVENT: "EVENT",
} as const;
export type EntityType = (typeof EntityType)[keyof typeof EntityType];

export const ContentStage = {
  IDEA: "IDEA",
  SCRIPTING: "SCRIPTING",
  FILMING: "FILMING",
  EDITING: "EDITING",
  SCHEDULED: "SCHEDULED",
  PUBLISHED: "PUBLISHED",
} as const;
export type ContentStage = (typeof ContentStage)[keyof typeof ContentStage];

export const ContentChannel = {
  YOUTUBE: "YOUTUBE",
  INSTAGRAM: "INSTAGRAM",
  LINKEDIN: "LINKEDIN",
  SHORTS: "SHORTS",
  PODCAST: "PODCAST",
  OTHER: "OTHER",
} as const;
export type ContentChannel = (typeof ContentChannel)[keyof typeof ContentChannel];

// ───────────────────────────── Prisma Namespace & Decimal ─────────────────────────────

export class Decimal {
  private val: number;
  constructor(v: number | string | Decimal) {
    this.val = v instanceof Decimal ? v.val : Number(v) || 0;
  }
  plus(n: number | string | Decimal) {
    return new Decimal(this.val + (n instanceof Decimal ? n.val : Number(n) || 0));
  }
  minus(n: number | string | Decimal) {
    return new Decimal(this.val - (n instanceof Decimal ? n.val : Number(n) || 0));
  }
  times(n: number | string | Decimal) {
    return new Decimal(this.val * (n instanceof Decimal ? n.val : Number(n) || 0));
  }
  div(n: number | string | Decimal) {
    const d = n instanceof Decimal ? n.val : Number(n) || 0;
    return new Decimal(d === 0 ? 0 : this.val / d);
  }
  lessThan(n: number | string | Decimal) {
    return this.val < (n instanceof Decimal ? n.val : Number(n) || 0);
  }
  toNumber() {
    return this.val;
  }
  toString() {
    return String(this.val);
  }
  toFixed(digits?: number) {
    return this.val.toFixed(digits);
  }
  valueOf() {
    return this.val;
  }
  toJSON() {
    return this.val;
  }
}

const OuterDecimal = Decimal;

// Mirrors the real @prisma/client's own `Prisma` namespace shape, which callers already
// use as `Prisma.Decimal`/`Prisma.XWhereInput` — an ES module can't offer that shape.
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Prisma {
  export const Decimal: typeof OuterDecimal = (globalThis as any).Decimal || OuterDecimal;
  export type Decimal = InstanceType<typeof Decimal>;
  export type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];
  export type InputJsonValue = any;
  export type TransactionClient = any;
  export type TimeEntryWhereInput = any;
  export type TaskWhereInput = any;
  export type ProjectWhereInput = any;
  export type LeadWhereInput = any;
  export type InvoiceWhereInput = any;
  export type GoalWhereInput = any;
  export type FileWhereInput = any;
  export type ContentItemWhereInput = any;
  export type ClientWhereInput = any;
  export type ClientCreateManyInput = any;
  export type ClientCompanyCreateManyInput = any;
  export type ClientContactCreateManyInput = any;
  export type LeadCreateManyInput = any;
  export type TaskCreateManyInput = any;
  export type TimeEntryCreateManyInput = any;
  export type FolderCreateManyInput = any;
  export type FileCreateManyInput = any;
  export type FileShareCreateManyInput = any;
}

// ───────────────────────────── Data Store & Date Hydration ─────────────────────────────

function hydrateDates(val: any): any {
  if (val === null || val === undefined) return val;
  if (val instanceof Date) return val; // already hydrated — recursing would wipe it to `{}`
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d;
    }
    return val;
  }
  if (Array.isArray(val)) return val.map(hydrateDates);
  if (typeof val === "object") {
    // A date cell written back while this field held `{}` (the bug above, now fixed)
    // round-trips through Sheets as the literal object `{}`. Treat it as a missing date
    // instead of crashing every caller that expects a Date, string or null here.
    if (Object.keys(val).length === 0) return null;
    const out: any = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = hydrateDates(v);
    }
    return out;
  }
  return val;
}

const store: Record<string, any[]> = {
  company: hydrateDates(companyData),
  user: hydrateDates(userData),
  session: [],
  account: hydrateDates(accountData),
  verification: [],
  rateLimit: [],
  membership: hydrateDates(membershipData),
  client: [],
  clientCompany: [],
  projectContact: [],
  clientContact: [],
  lead: [],
  crossSellAlert: [],
  project: [],
  projectMember: [],
  deliverable: [],
  milestone: [],
  timelinePhase: [],
  approval: [],
  bug: [],
  supportTicket: [],
  task: [],
  checklistItem: [],
  timeEntry: [],
  invoice: [],
  invoiceLineItem: [],
  payment: [],
  goal: [],
  goalMember: [],
  goalMilestone: [],
  folder: [],
  file: [],
  fileVersion: [],
  fileShare: [],
  emailCampaign: [],
  campaignRecipient: [],
  calendarEvent: [],
  comment: [],
  activity: [],
  notification: [],
  tag: [],
  contentItem: [],
  note: [],
  recurringTask: [],
};

// "Add Client" and "Convert lead" file in a client under this fixed id (see
// server/routes/clients.ts and leads.ts) assuming it already exists — true for the
// bundled mock data, but a Google Sheet someone reset without these rows would otherwise
// break both flows (a Postgres migration used to guarantee this; see docs/decisions.md #36).
const ROOT_FOLDERS = [
  { id: "folder_client_files", name: "Client Files", category: "CLIENT_FILES" },
  { id: "folder_project_files", name: "Project Files", category: "PROJECT_FILES" },
  { id: "folder_design_assets", name: "Design Assets", category: "DESIGN_ASSETS" },
  { id: "folder_video_assets", name: "Video Assets", category: "VIDEO_ASSETS" },
  { id: "folder_documents", name: "Documents", category: "DOCUMENTS" },
  { id: "folder_team_resources", name: "Team Resources", category: "TEAM_RESOURCES" },
];

function ensureRootFolders() {
  const now = new Date();
  for (const f of ROOT_FOLDERS) {
    if (!store.folder.some((x) => x.id === f.id)) {
      store.folder.push({ ...f, parentId: null, companyId: null, clientId: null, projectId: null, color: "#93C5FD", deletedAt: null, createdAt: now, updatedAt: now });
    }
  }
}
ensureRootFolders();

// ───────────────────────────── Google Sheets Hydration ─────────────────────────────

let sheetsHydrated = false;
let sheetsHydratingPromise: Promise<void> | null = null;

export async function initDbFromSheets(force = false): Promise<void> {
  if (!isSheetsConfigured()) {
    sheetsHydrated = true;
    return;
  }
  if (sheetsHydrated && !force) return;
  if (sheetsHydratingPromise && !force) return sheetsHydratingPromise;

  sheetsHydratingPromise = (async () => {
    try {
      const sheetsData = await fetchAllFromSheets();
      if (!sheetsData) {
        console.log("[db] Using local mock store (Google Sheets unreachable or empty)");
        sheetsHydrated = true;
        return;
      }

      let loadedCount = 0;
      for (const [table, rows] of Object.entries(sheetsData)) {
        if (store[table] && Array.isArray(rows) && rows.length > 0) {
          const validRows = rows.filter((r) => !r._placeholder);
          if (validRows.length > 0) {
            store[table] = validRows.map(hydrateDates);
            loadedCount++;
          }
        }
      }
      ensureRootFolders();
      console.log(`[db] Successfully hydrated ${loadedCount} tables from Google Sheets`);
      sheetsHydrated = true;
    } catch (err) {
      console.error("[db] Error hydrating from Google Sheets:", err);
    } finally {
      sheetsHydratingPromise = null;
    }
  })();

  return sheetsHydratingPromise;
}

// Auto-trigger background hydration if configured
if (typeof process !== "undefined" && process.env?.GOOGLE_SHEET_WEBAPP_URL) {
  initDbFromSheets().catch((err) => console.error("[db] Initial sheets hydration error:", err));
}


// ───────────────────────────── Relations Map ─────────────────────────────

type Rel = { type: "one" | "many"; target: string; local: string; foreign: string };

const relations: Record<string, Record<string, Rel>> = {
  company: {
    memberships: { type: "many", target: "membership", local: "id", foreign: "companyId" },
    clients: { type: "many", target: "clientCompany", local: "id", foreign: "companyId" },
    leads: { type: "many", target: "lead", local: "id", foreign: "companyId" },
    projects: { type: "many", target: "project", local: "id", foreign: "companyId" },
    tasks: { type: "many", target: "task", local: "id", foreign: "companyId" },
    timeEntries: { type: "many", target: "timeEntry", local: "id", foreign: "companyId" },
    invoices: { type: "many", target: "invoice", local: "id", foreign: "companyId" },
    goals: { type: "many", target: "goal", local: "id", foreign: "companyId" },
    folders: { type: "many", target: "folder", local: "id", foreign: "companyId" },
    files: { type: "many", target: "file", local: "id", foreign: "companyId" },
    campaigns: { type: "many", target: "emailCampaign", local: "id", foreign: "companyId" },
    events: { type: "many", target: "calendarEvent", local: "id", foreign: "companyId" },
    activities: { type: "many", target: "activity", local: "id", foreign: "companyId" },
    notes: { type: "many", target: "note", local: "id", foreign: "companyId" },
    content: { type: "many", target: "contentItem", local: "id", foreign: "companyId" },
    recurringTasks: { type: "many", target: "recurringTask", local: "id", foreign: "companyId" },
  },
  user: {
    sessions: { type: "many", target: "session", local: "id", foreign: "userId" },
    accounts: { type: "many", target: "account", local: "id", foreign: "userId" },
    memberships: { type: "many", target: "membership", local: "id", foreign: "userId" },
    assignedTasks: { type: "many", target: "task", local: "id", foreign: "assigneeId" },
    createdTasks: { type: "many", target: "task", local: "id", foreign: "createdById" },
    timeEntries: { type: "many", target: "timeEntry", local: "id", foreign: "userId" },
    notifications: { type: "many", target: "notification", local: "id", foreign: "userId" },
    notes: { type: "many", target: "note", local: "id", foreign: "authorId" },
    recurringTasks: { type: "many", target: "recurringTask", local: "id", foreign: "assigneeId" },
  },
  membership: {
    user: { type: "one", target: "user", local: "userId", foreign: "id" },
    company: { type: "one", target: "company", local: "companyId", foreign: "id" },
  },
  session: {
    user: { type: "one", target: "user", local: "userId", foreign: "id" },
  },
  account: {
    user: { type: "one", target: "user", local: "userId", foreign: "id" },
  },
  client: {
    companies: { type: "many", target: "clientCompany", local: "id", foreign: "clientId" },
    contacts: { type: "many", target: "clientContact", local: "id", foreign: "clientId" },
    leads: { type: "many", target: "lead", local: "id", foreign: "clientId" },
    projects: { type: "many", target: "project", local: "id", foreign: "clientId" },
    invoices: { type: "many", target: "invoice", local: "id", foreign: "clientId" },
    folders: { type: "many", target: "folder", local: "id", foreign: "clientId" },
    files: { type: "many", target: "file", local: "id", foreign: "clientId" },
    supportTickets: { type: "many", target: "supportTicket", local: "id", foreign: "clientId" },
    crossSell: { type: "many", target: "crossSellAlert", local: "id", foreign: "clientId" },
    owner: { type: "one", target: "user", local: "ownerId", foreign: "id" },
  },
  clientCompany: {
    client: { type: "one", target: "client", local: "clientId", foreign: "id" },
    company: { type: "one", target: "company", local: "companyId", foreign: "id" },
  },
  clientContact: {
    client: { type: "one", target: "client", local: "clientId", foreign: "id" },
    user: { type: "one", target: "user", local: "userId", foreign: "id" },
  },
  lead: {
    company: { type: "one", target: "company", local: "companyId", foreign: "id" },
    client: { type: "one", target: "client", local: "clientId", foreign: "id" },
    owner: { type: "one", target: "user", local: "ownerId", foreign: "id" },
  },
  crossSellAlert: {
    client: { type: "one", target: "client", local: "clientId", foreign: "id" },
    fromCompany: { type: "one", target: "company", local: "fromCompanyId", foreign: "id" },
    toCompany: { type: "one", target: "company", local: "toCompanyId", foreign: "id" },
    lead: { type: "one", target: "lead", local: "leadId", foreign: "id" },
  },
  project: {
    company: { type: "one", target: "company", local: "companyId", foreign: "id" },
    client: { type: "one", target: "client", local: "clientId", foreign: "id" },
    members: { type: "many", target: "projectMember", local: "id", foreign: "projectId" },
    deliverables: { type: "many", target: "deliverable", local: "id", foreign: "projectId" },
    milestones: { type: "many", target: "milestone", local: "id", foreign: "projectId" },
    phases: { type: "many", target: "timelinePhase", local: "id", foreign: "projectId" },
    approvals: { type: "many", target: "approval", local: "id", foreign: "projectId" },
    bugs: { type: "many", target: "bug", local: "id", foreign: "projectId" },
    supportTickets: { type: "many", target: "supportTicket", local: "id", foreign: "projectId" },
    tasks: { type: "many", target: "task", local: "id", foreign: "projectId" },
    timeEntries: { type: "many", target: "timeEntry", local: "id", foreign: "projectId" },
    invoices: { type: "many", target: "invoice", local: "id", foreign: "projectId" },
    files: { type: "many", target: "file", local: "id", foreign: "projectId" },
  },
  projectMember: {
    project: { type: "one", target: "project", local: "projectId", foreign: "id" },
    user: { type: "one", target: "user", local: "userId", foreign: "id" },
  },
  deliverable: {
    project: { type: "one", target: "project", local: "projectId", foreign: "id" },
  },
  milestone: {
    project: { type: "one", target: "project", local: "projectId", foreign: "id" },
  },
  timelinePhase: {
    project: { type: "one", target: "project", local: "projectId", foreign: "id" },
  },
  approval: {
    project: { type: "one", target: "project", local: "projectId", foreign: "id" },
    file: { type: "one", target: "file", local: "fileId", foreign: "id" },
    respondedBy: { type: "one", target: "clientContact", local: "respondedByContactId", foreign: "id" },
  },
  bug: {
    project: { type: "one", target: "project", local: "projectId", foreign: "id" },
  },
  supportTicket: {
    client: { type: "one", target: "client", local: "clientId", foreign: "id" },
    project: { type: "one", target: "project", local: "projectId", foreign: "id" },
  },
  task: {
    company: { type: "one", target: "company", local: "companyId", foreign: "id" },
    project: { type: "one", target: "project", local: "projectId", foreign: "id" },
    assignee: { type: "one", target: "user", local: "assigneeId", foreign: "id" },
    createdBy: { type: "one", target: "user", local: "createdById", foreign: "id" },
    reviewFrom: { type: "one", target: "user", local: "reviewFromId", foreign: "id" },
    parent: { type: "one", target: "task", local: "parentId", foreign: "id" },
    subtasks: { type: "many", target: "task", local: "id", foreign: "parentId" },
    checklist: { type: "many", target: "checklistItem", local: "id", foreign: "taskId" },
    timeEntries: { type: "many", target: "timeEntry", local: "id", foreign: "taskId" },
    files: { type: "many", target: "file", local: "id", foreign: "taskId" },
  },
  checklistItem: {
    task: { type: "one", target: "task", local: "taskId", foreign: "id" },
    assignee: { type: "one", target: "user", local: "assigneeId", foreign: "id" },
  },
  timeEntry: {
    user: { type: "one", target: "user", local: "userId", foreign: "id" },
    company: { type: "one", target: "company", local: "companyId", foreign: "id" },
    project: { type: "one", target: "project", local: "projectId", foreign: "id" },
    task: { type: "one", target: "task", local: "taskId", foreign: "id" },
    approvedBy: { type: "one", target: "user", local: "approvedById", foreign: "id" },
    invoice: { type: "one", target: "invoice", local: "invoiceId", foreign: "id" },
  },
  invoice: {
    company: { type: "one", target: "company", local: "companyId", foreign: "id" },
    client: { type: "one", target: "client", local: "clientId", foreign: "id" },
    project: { type: "one", target: "project", local: "projectId", foreign: "id" },
    lineItems: { type: "many", target: "invoiceLineItem", local: "id", foreign: "invoiceId" },
    payments: { type: "many", target: "payment", local: "id", foreign: "invoiceId" },
    timeEntries: { type: "many", target: "timeEntry", local: "id", foreign: "invoiceId" },
  },
  invoiceLineItem: {
    invoice: { type: "one", target: "invoice", local: "invoiceId", foreign: "id" },
  },
  payment: {
    invoice: { type: "one", target: "invoice", local: "invoiceId", foreign: "id" },
    createdBy: { type: "one", target: "user", local: "createdById", foreign: "id" },
  },
  goal: {
    company: { type: "one", target: "company", local: "companyId", foreign: "id" },
    owner: { type: "one", target: "user", local: "ownerId", foreign: "id" },
    members: { type: "many", target: "goalMember", local: "id", foreign: "goalId" },
    milestones: { type: "many", target: "goalMilestone", local: "id", foreign: "goalId" },
  },
  goalMember: {
    goal: { type: "one", target: "goal", local: "goalId", foreign: "id" },
    user: { type: "one", target: "user", local: "userId", foreign: "id" },
  },
  goalMilestone: {
    goal: { type: "one", target: "goal", local: "goalId", foreign: "id" },
  },
  folder: {
    parent: { type: "one", target: "folder", local: "parentId", foreign: "id" },
    children: { type: "many", target: "folder", local: "id", foreign: "parentId" },
    files: { type: "many", target: "file", local: "id", foreign: "folderId" },
    client: { type: "one", target: "client", local: "clientId", foreign: "id" },
    project: { type: "one", target: "project", local: "projectId", foreign: "id" },
    company: { type: "one", target: "company", local: "companyId", foreign: "id" },
  },
  file: {
    folder: { type: "one", target: "folder", local: "folderId", foreign: "id" },
    company: { type: "one", target: "company", local: "companyId", foreign: "id" },
    client: { type: "one", target: "client", local: "clientId", foreign: "id" },
    project: { type: "one", target: "project", local: "projectId", foreign: "id" },
    task: { type: "one", target: "task", local: "taskId", foreign: "id" },
    uploadedBy: { type: "one", target: "user", local: "uploadedById", foreign: "id" },
    versions: { type: "many", target: "fileVersion", local: "id", foreign: "fileId" },
    shares: { type: "many", target: "fileShare", local: "id", foreign: "fileId" },
  },
  fileVersion: {
    file: { type: "one", target: "file", local: "fileId", foreign: "id" },
    uploadedBy: { type: "one", target: "user", local: "uploadedById", foreign: "id" },
  },
  fileShare: {
    file: { type: "one", target: "file", local: "fileId", foreign: "id" },
    user: { type: "one", target: "user", local: "userId", foreign: "id" },
    clientContact: { type: "one", target: "clientContact", local: "clientContactId", foreign: "id" },
  },
  emailCampaign: {
    company: { type: "one", target: "company", local: "companyId", foreign: "id" },
    recipients: { type: "many", target: "campaignRecipient", local: "id", foreign: "campaignId" },
  },
  campaignRecipient: {
    campaign: { type: "one", target: "emailCampaign", local: "campaignId", foreign: "id" },
    lead: { type: "one", target: "lead", local: "leadId", foreign: "id" },
    client: { type: "one", target: "client", local: "clientId", foreign: "id" },
  },
  calendarEvent: {
    company: { type: "one", target: "company", local: "companyId", foreign: "id" },
    client: { type: "one", target: "client", local: "clientId", foreign: "id" },
    lead: { type: "one", target: "lead", local: "leadId", foreign: "id" },
    project: { type: "one", target: "project", local: "projectId", foreign: "id" },
  },
  comment: {
    author: { type: "one", target: "user", local: "authorId", foreign: "id" },
  },
  activity: {
    company: { type: "one", target: "company", local: "companyId", foreign: "id" },
    actor: { type: "one", target: "user", local: "actorId", foreign: "id" },
  },
  notification: {
    user: { type: "one", target: "user", local: "userId", foreign: "id" },
  },
  contentItem: {
    company: { type: "one", target: "company", local: "companyId", foreign: "id" },
    owner: { type: "one", target: "user", local: "ownerId", foreign: "id" },
  },
  note: {
    company: { type: "one", target: "company", local: "companyId", foreign: "id" },
    author: { type: "one", target: "user", local: "authorId", foreign: "id" },
  },
  recurringTask: {
    company: { type: "one", target: "company", local: "companyId", foreign: "id" },
    assignee: { type: "one", target: "user", local: "assigneeId", foreign: "id" },
    project: { type: "one", target: "project", local: "projectId", foreign: "id" },
    createdBy: { type: "one", target: "user", local: "createdById", foreign: "id" },
  },
};

// ───────────────────────────── Query Engine ─────────────────────────────

function compareEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return a == b;
  if (a instanceof Date || b instanceof Date) {
    const at = a instanceof Date ? a.getTime() : new Date(a).getTime();
    const bt = b instanceof Date ? b.getTime() : new Date(b).getTime();
    return at === bt;
  }
  return false;
}

function toTimestampOrNum(v: any): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v).getTime();
    if (!isNaN(d)) return d;
  }
  return Number(v);
}

function matchesWhere(item: any, where: any, modelName: string): boolean {
  if (!where || typeof where !== "object") return true;

  for (const [k, cond] of Object.entries(where as Record<string, any>)) {
    if (cond === undefined) continue;

    if (k === "AND") {
      const ok = Array.isArray(cond)
        ? cond.every((c) => matchesWhere(item, c, modelName))
        : matchesWhere(item, cond, modelName);
      if (!ok) return false;
      continue;
    }

    if (k === "OR") {
      const ok = Array.isArray(cond) && cond.some((c) => matchesWhere(item, c, modelName));
      if (!ok) return false;
      continue;
    }

    if (k === "NOT") {
      const ok = Array.isArray(cond)
        ? !cond.some((c) => matchesWhere(item, c, modelName))
        : !matchesWhere(item, cond, modelName);
      if (!ok) return false;
      continue;
    }

    const rel = relations[modelName]?.[k];
    if (rel) {
      const relCond = cond as any;
      if (rel.type === "one") {
        const target = store[rel.target]?.find((x) => x[rel.foreign] === item[rel.local]);
        if (relCond === null) {
          if (target) return false;
        } else if (typeof relCond === "object") {
          if (relCond.is === null && target) return false;
          if (relCond.is && (!target || !matchesWhere(target, relCond.is, rel.target))) return false;
          if (relCond.isNot && target && matchesWhere(target, relCond.isNot, rel.target)) return false;
          if (!target || !matchesWhere(target, relCond, rel.target)) return false;
        }
      } else {
        const targets = store[rel.target]?.filter((x) => x[rel.foreign] === item[rel.local]) || [];
        if (relCond?.some && !targets.some((x: any) => matchesWhere(x, relCond.some, rel.target))) return false;
        if (relCond?.every && !targets.every((x: any) => matchesWhere(x, relCond.every, rel.target))) return false;
        if (relCond?.none && targets.some((x: any) => matchesWhere(x, relCond.none, rel.target))) return false;
      }
      continue;
    }

    const val = item[k];

    if (cond === null || typeof cond !== "object" || cond instanceof Date) {
      if (!compareEqual(val, cond)) return false;
      continue;
    }

    for (const [op, opVal] of Object.entries(cond as Record<string, any>)) {
      if (op === "equals" && !compareEqual(val, opVal)) return false;
      if (op === "not" && compareEqual(val, opVal)) return false;
      if (op === "in" && (!Array.isArray(opVal) || !opVal.some((x) => compareEqual(val, x)))) return false;
      if (op === "notIn" && Array.isArray(opVal) && opVal.some((x) => compareEqual(val, x))) return false;
      if (op === "lt" && !(toTimestampOrNum(val) < toTimestampOrNum(opVal))) return false;
      if (op === "lte" && !(toTimestampOrNum(val) <= toTimestampOrNum(opVal))) return false;
      if (op === "gt" && !(toTimestampOrNum(val) > toTimestampOrNum(opVal))) return false;
      if (op === "gte" && !(toTimestampOrNum(val) >= toTimestampOrNum(opVal))) return false;
      if (op === "contains") {
        const mode = (cond as any).mode;
        const strVal = String(val ?? "");
        const target = String(opVal ?? "");
        const match = mode === "insensitive" ? strVal.toLowerCase().includes(target.toLowerCase()) : strVal.includes(target);
        if (!match) return false;
      }
      if (op === "startsWith") {
        const mode = (cond as any).mode;
        const strVal = String(val ?? "");
        const target = String(opVal ?? "");
        const match = mode === "insensitive" ? strVal.toLowerCase().startsWith(target.toLowerCase()) : strVal.startsWith(target);
        if (!match) return false;
      }
      if (op === "endsWith") {
        const mode = (cond as any).mode;
        const strVal = String(val ?? "");
        const target = String(opVal ?? "");
        const match = mode === "insensitive" ? strVal.toLowerCase().endsWith(target.toLowerCase()) : strVal.endsWith(target);
        if (!match) return false;
      }
      if (op === "has" && (!Array.isArray(val) || !val.includes(opVal))) return false;
      if (op === "hasEvery" && (!Array.isArray(val) || !opVal.every((x: any) => val.includes(x)))) return false;
      if (op === "hasSome" && (!Array.isArray(val) || !opVal.some((x: any) => val.includes(x)))) return false;
      if (op === "isEmpty" && (!Array.isArray(val) || val.length > 0)) return false;
    }
  }

  return true;
}

function applyOrderBy(items: any[], orderBy: any): any[] {
  if (!orderBy) return items;
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];

  return [...items].sort((a, b) => {
    for (const order of orders) {
      for (const [key, dir] of Object.entries(order)) {
        let va = a[key];
        let vb = b[key];
        if (va instanceof Date) va = va.getTime();
        if (vb instanceof Date) vb = vb.getTime();
        if (va === vb) continue;
        if (va === null || va === undefined) return dir === "asc" ? -1 : 1;
        if (vb === null || vb === undefined) return dir === "asc" ? 1 : -1;
        if (va < vb) return dir === "asc" ? -1 : 1;
        if (va > vb) return dir === "asc" ? 1 : -1;
      }
    }
    return 0;
  });
}

function projectItem(item: any, modelName: string, select?: any, include?: any): any {
  if (!item) return item;
  let res: any;

  if (select) {
    res = {};
    for (const [k, v] of Object.entries(select)) {
      if (!v) continue;
      const rel = relations[modelName]?.[k];
      if (rel) {
        const vObj = typeof v === "object" && v !== null ? (v as Record<string, any>) : undefined;
        if (rel.type === "one") {
          const target = store[rel.target]?.find((x) => x[rel.foreign] === item[rel.local]);
          res[k] = target
            ? projectItem(
                target,
                rel.target,
                vObj?.select,
                vObj?.include,
              )
            : null;
        } else {
          let targets = store[rel.target]?.filter((x) => x[rel.foreign] === item[rel.local]) || [];
          if (vObj?.where) targets = targets.filter((x) => matchesWhere(x, vObj.where, rel.target));
          if (vObj?.orderBy) targets = applyOrderBy(targets, vObj.orderBy);
          if (vObj?.take !== undefined) targets = targets.slice(vObj.skip ?? 0, (vObj.skip ?? 0) + vObj.take);
          res[k] = targets.map((t) =>
            projectItem(
              t,
              rel.target,
              vObj?.select,
              vObj?.include,
            ),
          );
        }
      } else {
        res[k] = item[k];
      }
    }
  } else {
    res = { ...item };
  }

  if (include) {
    for (const [k, v] of Object.entries(include)) {
      if (!v) continue;
      const rel = relations[modelName]?.[k];
      if (rel) {
        const vObj = typeof v === "object" && v !== null ? (v as Record<string, any>) : undefined;
        if (rel.type === "one") {
          const target = store[rel.target]?.find((x) => x[rel.foreign] === item[rel.local]);
          res[k] = target
            ? projectItem(
                target,
                rel.target,
                vObj?.select,
                vObj?.include,
              )
            : null;
        } else {
          let targets = store[rel.target]?.filter((x) => x[rel.foreign] === item[rel.local]) || [];
          if (vObj?.where) targets = targets.filter((x) => matchesWhere(x, vObj.where, rel.target));
          if (vObj?.orderBy) targets = applyOrderBy(targets, vObj.orderBy);
          if (vObj?.take !== undefined) targets = targets.slice(vObj.skip ?? 0, (vObj.skip ?? 0) + vObj.take);
          res[k] = targets.map((t) =>
            projectItem(
              t,
              rel.target,
              vObj?.select,
              vObj?.include,
            ),
          );
        }
      }
    }
  }

  return res;
}

let autoIdCounter = 1000;
function nextId(prefix: string) {
  return `${prefix}_${Date.now()}_${autoIdCounter++}`;
}

// ───────────────────────────── Model Delegate Factory ─────────────────────────────

// Known scalar fields come from the model's own schema.ts shape; relations added by
// `include`/`select` fall through the index signature, so a route handler's return type
// stays a concrete object (never bare `any`) and Hono's client-side type inference holds.
type Loose<T> = T & { [key: string]: any };

// JSON import types infer DateTime columns as `string` (that's what's in the file on disk),
// but hydrateDates() turns them into real Date objects in the in-memory store at runtime —
// matching what Prisma gave server-side code before. Re-widen exactly those fields (the
// DateTime columns of prisma/schema.prisma) back to Date; Hono's c.json() re-narrows them
// to `string` for API clients automatically (Date has .toJSON(), see hono's JSONParsed<T>).
type DateField =
  | "accessTokenExpiresAt" | "archivedAt" | "completedAt" | "createdAt" | "cycleMonth"
  | "date" | "deletedAt" | "deliveredAt" | "dueDate" | "editingStartedAt" | "end"
  | "endDate" | "expiresAt" | "issueDate" | "lastActivityAt" | "lostAt"
  | "meetingBookedAt" | "openedAt" | "publishDate" | "publishedAt" | "readAt"
  | "refreshTokenExpiresAt" | "repliedAt" | "requestedAt" | "resolvedAt" | "respondedAt"
  | "scheduledAt" | "sentAt" | "shootDate" | "since" | "start" | "startDate"
  | "updatedAt" | "wonAt";

type Hydrate<T> = { [K in keyof T]: K extends DateField ? (null extends T[K] ? Date | null : Date) : T[K] };

type ModelDelegate<T extends Record<string, any>> = {
  findMany(args?: any): Promise<Loose<T>[]>;
  findFirst(args?: any): Promise<Loose<T> | null>;
  findFirstOrThrow(args?: any): Promise<Loose<T>>;
  findUnique(args?: any): Promise<Loose<T> | null>;
  findUniqueOrThrow(args?: any): Promise<Loose<T>>;
  count(args?: any): Promise<number>;
  groupBy(args?: any): Promise<any[]>;
  aggregate(args?: any): Promise<any>;
  create(args?: any): Promise<Loose<T>>;
  createMany(args?: any): Promise<{ count: number }>;
  update(args?: any): Promise<Loose<T>>;
  updateMany(args?: any): Promise<{ count: number }>;
  delete(args?: any): Promise<Loose<T>>;
  deleteMany(args?: any): Promise<{ count: number }>;
  upsert(args?: any): Promise<Loose<T>>;
};

function createModelDelegate<T extends Record<string, any> = Record<string, any>>(modelName: string): ModelDelegate<T> {
  return {
    async findMany(args: any = {}) {
      if (!sheetsHydrated && sheetsHydratingPromise) await sheetsHydratingPromise;
      let items = store[modelName] || [];
      if (args.where) items = items.filter((x) => matchesWhere(x, args.where, modelName));
      if (args.distinct) {
        const distinctKeys = Array.isArray(args.distinct) ? args.distinct : [args.distinct];
        const seen = new Set<string>();
        items = items.filter((x) => {
          const key = distinctKeys.map((k: string) => String(x[k])).join("|");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      if (args.orderBy) items = applyOrderBy(items, args.orderBy);
      if (args.skip !== undefined || args.take !== undefined) {
        const skip = args.skip ?? 0;
        const take = args.take ?? items.length;
        items = items.slice(skip, skip + take);
      }
      return items.map((x) => projectItem(x, modelName, args.select, args.include));
    },

    async findFirst(args: any = {}) {
      if (!sheetsHydrated && sheetsHydratingPromise) await sheetsHydratingPromise;
      let items = store[modelName] || [];
      if (args.where) items = items.filter((x) => matchesWhere(x, args.where, modelName));
      if (args.orderBy) items = applyOrderBy(items, args.orderBy);
      const item = items[args.skip ?? 0];
      return item ? projectItem(item, modelName, args.select, args.include) : null;
    },

    async findFirstOrThrow(args: any = {}) {
      const item = await this.findFirst(args);
      if (!item) throw new Error(`Record not found in ${modelName}`);
      return item;
    },

    async findUnique(args: any = {}) {
      return this.findFirst(args);
    },

    async findUniqueOrThrow(args: any = {}) {
      const item = await this.findFirst(args);
      if (!item) throw new Error(`Record not found in ${modelName}`);
      return item;
    },

    async count(args: any = {}) {
      if (!sheetsHydrated && sheetsHydratingPromise) await sheetsHydratingPromise;
      let items = store[modelName] || [];
      if (args.where) items = items.filter((x) => matchesWhere(x, args.where, modelName));
      return items.length;
    },

    async groupBy(args: any = {}) {
      if (!sheetsHydrated && sheetsHydratingPromise) await sheetsHydratingPromise;
      let items = store[modelName] || [];
      if (args.where) items = items.filter((x) => matchesWhere(x, args.where, modelName));
      const byFields: string[] = Array.isArray(args.by) ? args.by : [args.by];
      const groups = new Map<string, { groupKey: any; items: any[] }>();

      for (const item of items) {
        const keyObj: any = {};
        for (const f of byFields) keyObj[f] = item[f];
        const keyStr = JSON.stringify(keyObj);
        if (!groups.has(keyStr)) groups.set(keyStr, { groupKey: keyObj, items: [] });
        groups.get(keyStr)!.items.push(item);
      }

      const results = [];
      for (const { groupKey, items: gItems } of groups.values()) {
        const row: any = { ...groupKey };
        if (args._count) {
          row._count = typeof args._count === "boolean" ? gItems.length : { _all: gItems.length };
        }
        if (args._sum) {
          row._sum = {};
          for (const [field, enabled] of Object.entries(args._sum)) {
            if (enabled) {
              row._sum[field] = gItems.reduce((acc, it) => acc + (Number(it[field]) || 0), 0);
            }
          }
        }
        results.push(row);
      }
      return results;
    },

    async aggregate(args: any = {}) {
      if (!sheetsHydrated && sheetsHydratingPromise) await sheetsHydratingPromise;
      let items = store[modelName] || [];
      if (args.where) items = items.filter((x) => matchesWhere(x, args.where, modelName));
      const result: any = {};
      if (args._count) result._count = items.length;
      if (args._sum) {
        result._sum = {};
        for (const [f, on] of Object.entries(args._sum)) {
          if (on) result._sum[f] = items.reduce((acc, it) => acc + (Number(it[f]) || 0), 0);
        }
      }
      return result;
    },

    async create(args: any = {}) {
      const { data, select, include } = args;
      const record: any = { ...data };
      if (!record.id) record.id = nextId(modelName);
      if (!record.createdAt) record.createdAt = new Date();
      if (!record.updatedAt) record.updatedAt = new Date();

      // Handle nested creates
      const nestedOps: Array<() => Promise<void>> = [];
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === "object" && (v as any).create) {
          delete record[k];
          const rel = relations[modelName]?.[k];
          if (rel) {
            const createData = (v as any).create;
            const creates = Array.isArray(createData) ? createData : [createData];
            for (const c of creates) {
              nestedOps.push(async () => {
                const subData = { ...c, [rel.foreign]: record[rel.local] };
                await (db as any)[rel.target].create({ data: subData });
              });
            }
          }
        }
      }

      store[modelName].push(record);
      scheduleTableSync(modelName, () => store[modelName]);
      for (const op of nestedOps) await op();
      return projectItem(record, modelName, select, include);
    },

    async createMany(args: any = {}) {
      const items: any[] = Array.isArray(args.data) ? args.data : [args.data];
      let count = 0;
      for (const it of items) {
        const record = { ...it };
        if (!record.id) record.id = nextId(modelName);
        if (!record.createdAt) record.createdAt = new Date();
        if (!record.updatedAt) record.updatedAt = new Date();
        store[modelName].push(record);
        count++;
      }
      if (count > 0) scheduleTableSync(modelName, () => store[modelName]);
      return { count };
    },

    async update(args: any = {}) {
      const { where, data, select, include } = args;
      const idx = store[modelName].findIndex((x) => matchesWhere(x, where, modelName));
      if (idx === -1) throw new Error(`Record to update not found in ${modelName}`);

      const item = store[modelName][idx]!;
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === "object" && "increment" in (v as any)) {
          item[k] = (Number(item[k]) || 0) + (Number((v as any).increment) || 0);
        } else if (v && typeof v === "object" && "decrement" in (v as any)) {
          item[k] = (Number(item[k]) || 0) - (Number((v as any).decrement) || 0);
        } else if (v && typeof v === "object" && (v as any).create) {
          const rel = relations[modelName]?.[k];
          if (rel) {
            const creates = Array.isArray((v as any).create) ? (v as any).create : [(v as any).create];
            for (const c of creates) {
              const subData = { ...c, [rel.foreign]: item[rel.local] };
              await (db as any)[rel.target].create({ data: subData });
            }
          }
        } else {
          item[k] = v;
        }
      }
      item.updatedAt = new Date();
      scheduleTableSync(modelName, () => store[modelName]);
      return projectItem(item, modelName, select, include);
    },

    async updateMany(args: any = {}) {
      const { where, data } = args;
      let count = 0;
      for (const item of store[modelName]) {
        if (matchesWhere(item, where, modelName)) {
          for (const [k, v] of Object.entries(data)) {
            if (v && typeof v === "object" && "increment" in (v as any)) {
              item[k] = (Number(item[k]) || 0) + (Number((v as any).increment) || 0);
            } else {
              item[k] = v;
            }
          }
          item.updatedAt = new Date();
          count++;
        }
      }
      if (count > 0) scheduleTableSync(modelName, () => store[modelName]);
      return { count };
    },

    async delete(args: any = {}) {
      const { where, select, include } = args;
      const idx = store[modelName].findIndex((x) => matchesWhere(x, where, modelName));
      if (idx === -1) throw new Error(`Record to delete not found in ${modelName}`);
      const [removed] = store[modelName].splice(idx, 1);
      scheduleTableSync(modelName, () => store[modelName]);
      return projectItem(removed, modelName, select, include);
    },

    async deleteMany(args: any = {}) {
      const where = args.where || {};
      const initial = store[modelName].length;
      store[modelName] = store[modelName].filter((x) => !matchesWhere(x, where, modelName));
      const removedCount = initial - store[modelName].length;
      if (removedCount > 0) scheduleTableSync(modelName, () => store[modelName]);
      return { count: removedCount };
    },

    async upsert(args: any = {}) {
      const { where, create, update, select, include } = args;
      const existing = await this.findFirst({ where });
      if (existing) {
        return this.update({ where: { id: existing.id }, data: update, select, include });
      } else {
        return this.create({ data: create, select, include });
      }
    },
  };
}

// ───────────────────────────── Database Client ─────────────────────────────

const rawDb = {
  company: createModelDelegate<Hydrate<(typeof companyData)[number]>>("company"),
  user: createModelDelegate<Hydrate<(typeof userData)[number]>>("user"),
  session: createModelDelegate("session"),
  account: createModelDelegate<Hydrate<(typeof accountData)[number]>>("account"),
  verification: createModelDelegate("verification"),
  rateLimit: createModelDelegate("rateLimit"),
  membership: createModelDelegate<Hydrate<(typeof membershipData)[number]>>("membership"),
  client: createModelDelegate<Hydrate<typeof SCHEMA.client>>("client"),
  clientCompany: createModelDelegate<Hydrate<typeof SCHEMA.clientCompany>>("clientCompany"),
  projectContact: createModelDelegate<Hydrate<typeof SCHEMA.projectContact>>("projectContact"),
  clientContact: createModelDelegate<Hydrate<typeof SCHEMA.clientContact>>("clientContact"),
  lead: createModelDelegate<Hydrate<typeof SCHEMA.lead>>("lead"),
  crossSellAlert: createModelDelegate<Hydrate<typeof SCHEMA.crossSellAlert>>("crossSellAlert"),
  project: createModelDelegate<Hydrate<typeof SCHEMA.project>>("project"),
  projectMember: createModelDelegate<Hydrate<typeof SCHEMA.projectMember>>("projectMember"),
  deliverable: createModelDelegate<Hydrate<typeof SCHEMA.deliverable>>("deliverable"),
  milestone: createModelDelegate<Hydrate<typeof SCHEMA.milestone>>("milestone"),
  timelinePhase: createModelDelegate<Hydrate<typeof SCHEMA.timelinePhase>>("timelinePhase"),
  approval: createModelDelegate<Hydrate<typeof SCHEMA.approval>>("approval"),
  bug: createModelDelegate<Hydrate<typeof SCHEMA.bug>>("bug"),
  supportTicket: createModelDelegate<Hydrate<typeof SCHEMA.supportTicket>>("supportTicket"),
  task: createModelDelegate<Hydrate<typeof SCHEMA.task>>("task"),
  checklistItem: createModelDelegate<Hydrate<typeof SCHEMA.checklistItem>>("checklistItem"),
  timeEntry: createModelDelegate<Hydrate<typeof SCHEMA.timeEntry>>("timeEntry"),
  invoice: createModelDelegate<Hydrate<typeof SCHEMA.invoice>>("invoice"),
  invoiceLineItem: createModelDelegate<Hydrate<typeof SCHEMA.invoiceLineItem>>("invoiceLineItem"),
  payment: createModelDelegate<Hydrate<typeof SCHEMA.payment>>("payment"),
  goal: createModelDelegate<Hydrate<typeof SCHEMA.goal>>("goal"),
  goalMember: createModelDelegate<Hydrate<typeof SCHEMA.goalMember>>("goalMember"),
  goalMilestone: createModelDelegate<Hydrate<typeof SCHEMA.goalMilestone>>("goalMilestone"),
  folder: createModelDelegate<Hydrate<typeof SCHEMA.folder>>("folder"),
  file: createModelDelegate<Hydrate<typeof SCHEMA.file>>("file"),
  fileVersion: createModelDelegate<Hydrate<typeof SCHEMA.fileVersion>>("fileVersion"),
  fileShare: createModelDelegate<Hydrate<typeof SCHEMA.fileShare>>("fileShare"),
  emailCampaign: createModelDelegate<Hydrate<typeof SCHEMA.emailCampaign>>("emailCampaign"),
  campaignRecipient: createModelDelegate<Hydrate<typeof SCHEMA.campaignRecipient>>("campaignRecipient"),
  calendarEvent: createModelDelegate<Hydrate<typeof SCHEMA.calendarEvent>>("calendarEvent"),
  comment: createModelDelegate<Hydrate<typeof SCHEMA.comment>>("comment"),
  activity: createModelDelegate<Hydrate<typeof SCHEMA.activity>>("activity"),
  notification: createModelDelegate<Hydrate<typeof SCHEMA.notification>>("notification"),
  tag: createModelDelegate<Hydrate<typeof SCHEMA.tag>>("tag"),
  contentItem: createModelDelegate<Hydrate<typeof SCHEMA.contentItem>>("contentItem"),
  note: createModelDelegate<Hydrate<typeof SCHEMA.note>>("note"),
  recurringTask: createModelDelegate<Hydrate<typeof SCHEMA.recurringTask>>("recurringTask"),

  async $disconnect() {
    // No-op for in-memory client
  },

  async $syncFromSheets() {
    return initDbFromSheets(true);
  },

  async $syncToSheets(table?: string) {
    const { syncTableToSheet } = await import("../sheets");
    if (table) {
      return syncTableToSheet(table, store[table] || []);
    }
    for (const [tbl, rows] of Object.entries(store)) {
      await syncTableToSheet(tbl, rows);
    }
    return true;
  },
};

export type PrismaClient = typeof rawDb & {
  $transaction<T>(arg: ((tx: PrismaClient) => Promise<T>) | Promise<any>[]): Promise<T>;
};

export const db: PrismaClient = {
  ...rawDb,
  async $transaction<T>(arg: ((tx: PrismaClient) => Promise<T>) | Promise<any>[]): Promise<T> {
    if (typeof arg === "function") {
      return arg(db);
    }
    return Promise.all(arg) as unknown as Promise<T>;
  },
};
