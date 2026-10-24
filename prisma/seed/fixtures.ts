// Every row that is visible in docs/vertex-design.pdf, as data. Dates are PDF dates
// (today = 22 Oct 2026); util.at() shifts them. Padding data is generated in seed.ts.

export type TeamKey = "dhrumil" | "rohan" | "priya" | "aman" | "neha" | "dhruv";
export type Co = "VMH" | "VTH";

export const TEAM: {
  key: TeamKey;
  name: string;
  email: string;
  isOwner?: boolean;
  title?: string;
  companies: Co[];
  role: "ADMIN" | "MANAGER" | "MEMBER";
}[] = [
  { key: "dhrumil", name: "Dhrumil", email: "dhrumil@vertexmediahouse.com", isOwner: true, title: "Owner (Super Admin)", companies: ["VMH", "VTH"], role: "ADMIN" },
  { key: "rohan", name: "Rohan", email: "rohan@vertexmediahouse.com", title: "Project Manager", companies: ["VMH", "VTH"], role: "MANAGER" },
  { key: "priya", name: "Priya", email: "priya@vertexmediahouse.com", title: "Video Editor & Designer", companies: ["VMH", "VTH"], role: "MEMBER" },
  { key: "aman", name: "Aman", email: "aman@vertexmediahouse.com", title: "Video Editor", companies: ["VMH", "VTH"], role: "MEMBER" },
  { key: "neha", name: "Neha", email: "neha@vertextechhouse.com", title: "Developer", companies: ["VMH", "VTH"], role: "MEMBER" },
  { key: "dhruv", name: "Dhruv", email: "dhruv@vertexmediahouse.com", title: "Video Editor", companies: ["VMH"], role: "MEMBER" },
];

// ── Clients (page 4 table, pages 3, 5, 6, 9, 13) ───────────────────────────────
export type ClientFx = {
  key: string;
  name: string;
  domain: string;
  type: string;
  status?: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "INACTIVE";
  owner: TeamKey;
  companies: Co[];
  lastActivity: number; // minutes ago
  createdDaysAgo?: number;
  notes?: string;
  tags?: string[];
  address?: string;
};

const H = 60;
const D = 24 * H;

export const CLIENTS: ClientFx[] = [
  { key: "bright_labs", name: "Bright Labs", domain: "brightlabs.co", type: "YouTube Editing", owner: "rohan", companies: ["VMH", "VTH"], lastActivity: 2 * H, notes: "Preparing a product launch for their new app in November; wants launch videos.", tags: ["product-launch", "retainer"], address: "500 Howard St, San Francisco, CA, USA" },
  { key: "greenbuild_infra", name: "GreenBuild Infra", domain: "greenbuild.com", type: "Custom CRM", owner: "priya", companies: ["VTH"], lastActivity: D, address: "123 Business Park, Ahmedabad, Gujarat, India" },
  { key: "rocco_construction", name: "Rocco Construction", domain: "roccoconstruction.com", type: "Website + CRM", owner: "aman", companies: ["VTH"], lastActivity: 2 * D, address: "88 Harbor Rd, Boston, MA, USA" },
  { key: "elite_creators", name: "Elite Creators", domain: "elitecreators.co", type: "YouTube Channel", owner: "neha", companies: ["VMH", "VTH"], lastActivity: D },
  { key: "danny_drywall", name: "Danny Drywall", domain: "dannydrywall.com", type: "Website + Estimator", owner: "rohan", companies: ["VTH"], lastActivity: 3 * H, createdDaysAgo: 7 },
  { key: "scaleup_co", name: "ScaleUp Co.", domain: "scaleup.co", type: "Website Development", owner: "priya", companies: ["VTH", "VMH"], lastActivity: 5 * D },
  { key: "creative_studio", name: "Creative Studio", domain: "creativestudio.co", type: "Video Editing", status: "ON_HOLD", owner: "aman", companies: ["VMH"], lastActivity: 7 * D },
  { key: "flow_marketing", name: "Flow Marketing", domain: "flowmarketing.co", type: "Short-form Editing", owner: "neha", companies: ["VMH", "VTH"], lastActivity: 2 * D },
  { key: "urban_living", name: "Urban Living", domain: "urbanliving.com", type: "Website Redesign", owner: "rohan", companies: ["VTH", "VMH"], lastActivity: 3 * D },
  { key: "ashoka_buildcon", name: "Ashoka Buildcon", domain: "ashokabuildcon.com", type: "Automation System", owner: "priya", companies: ["VTH"], lastActivity: 4 * D, address: "Ashoka House, Nashik, Maharashtra, India" },
  { key: "vidhi_enterprise", name: "Vidhi Enterprise", domain: "vidhienterprise.com", type: "Custom ERP", owner: "aman", companies: ["VTH"], lastActivity: 6 * D, createdDaysAgo: 14 },
  { key: "nextgen_agency", name: "NextGen Agency", domain: "nextgenagency.com", type: "Video Editing", owner: "neha", companies: ["VTH", "VMH"], lastActivity: 4 * D, createdDaysAgo: 2 },
  { key: "durrell_properties", name: "Durrell Properties", domain: "durrellproperties.com", type: "Website", owner: "rohan", companies: ["VTH"], lastActivity: 2 * D, createdDaysAgo: 3 },
  { key: "bhaumik_podcast", name: "Bhaumik Podcast", domain: "bhaumikpodcast.com", type: "Video Editing", owner: "priya", companies: ["VMH"], lastActivity: 3 * D, createdDaysAgo: 7 },
  { key: "fit_life_media", name: "Fit Life Media", domain: "fitlifemedia.com", type: "Video Editing", owner: "aman", companies: ["VMH"], lastActivity: 3 * D, createdDaysAgo: 8 },
  { key: "neha_personal_brand", name: "Neha Personal Brand", domain: "nehabrand.in", type: "Reels Editing", status: "ON_HOLD", owner: "neha", companies: ["VMH"], lastActivity: 9 * D },
  { key: "trend_talk", name: "Trend Talk", domain: "trendtalk.in", type: "Shorts + Thumbnails", owner: "dhruv", companies: ["VMH"], lastActivity: D },
  { key: "alex_johnson", name: "Alex Johnson", domain: "alexjohnson.tv", type: "YouTube Shorts", owner: "rohan", companies: ["VMH"], lastActivity: 2 * H, notes: "Mentioned on our last call that their merch store needs a new website and a simple CRM.", tags: ["website", "crm"] },
  { key: "karan_mehta", name: "Karan Mehta", domain: "karanmehta.com", type: "Channel Management", owner: "priya", companies: ["VMH"], lastActivity: D },
];

// Primary + additional contacts shown on pages 5 and 6; other clients get one generated contact.
export const CONTACTS: Record<string, { name: string; title: string; email: string; phone?: string; location?: string; timezone?: string; isPrimary?: boolean }[]> = {
  bright_labs: [
    { name: "Rohan Mehta", title: "Founder, Bright Labs", email: "rohan@brightlabs.co", phone: "+1 415 555 0192", location: "PST (USA)", timezone: "America/Los_Angeles", isPrimary: true },
    { name: "Priya Shah", title: "Marketing Manager", email: "priya@brightlabs.co" },
    { name: "Aman Verma", title: "Content Lead", email: "aman@brightlabs.co" },
  ],
  greenbuild_infra: [
    { name: "Raj Mehta", title: "Director, GreenBuild Infra", email: "raj@greenbuildinfra.com", phone: "+1 415 555 0187", location: "California, USA", timezone: "America/Los_Angeles", isPrimary: true },
    { name: "Pooja Shah", title: "Project Manager", email: "pooja@greenbuildinfra.com" },
    { name: "Karan Patel", title: "Technical Lead", email: "karan@greenbuildinfra.com" },
  ],
};

// ── Leads (page 3). hidden = not shown as a card, only counted in the column ──
export type LeadFx = {
  client?: string;
  name: string;
  service: string;
  value: number;
  co: Co;
  stage: "NEW" | "CONTACTED" | "PROPOSAL" | "NEGOTIATION" | "WON";
  owner: TeamKey;
  activityDaysAgo?: number; // card "3 days ago"; none = no time shown
  createdDaysAgo: number;
  source: "FIVERR" | "WEBSITE" | "REFERRAL" | "LINKEDIN" | "EMAIL" | "INSTAGRAM" | "OTHER";
};

export const LEADS: LeadFx[] = [
  // New: 8 leads, ₹6,40,000
  { client: "bright_labs", name: "Bright Labs", service: "YouTube Editing", value: 80000, co: "VMH", stage: "NEW", owner: "rohan", createdDaysAgo: 0, source: "FIVERR" },
  { client: "scaleup_co", name: "ScaleUp Co.", service: "Website Development", value: 150000, co: "VTH", stage: "NEW", owner: "priya", activityDaysAgo: 3, createdDaysAgo: 3, source: "WEBSITE" },
  { client: "creative_studio", name: "Creative Studio", service: "Video Editing", value: 60000, co: "VMH", stage: "NEW", owner: "aman", createdDaysAgo: 4, source: "FIVERR" },
  // Contacted: 10 leads, ₹8,20,000
  { client: "greenbuild_infra", name: "GreenBuild Infra", service: "Custom CRM", value: 250000, co: "VTH", stage: "CONTACTED", owner: "priya", activityDaysAgo: 1, createdDaysAgo: 1, source: "WEBSITE" },
  { client: "flow_marketing", name: "Flow Marketing", service: "Short-form Editing", value: 75000, co: "VMH", stage: "CONTACTED", owner: "neha", activityDaysAgo: 2, createdDaysAgo: 6, source: "INSTAGRAM" },
  { client: "urban_living", name: "Urban Living", service: "Website Redesign", value: 120000, co: "VTH", stage: "CONTACTED", owner: "rohan", activityDaysAgo: 3, createdDaysAgo: 8, source: "REFERRAL" },
  // Proposal: 6 leads (header raised to ₹9,30,000 so open pipeline = ₹28,50,000; see decisions.md)
  { client: "rocco_construction", name: "Rocco Construction", service: "Website + CRM", value: 300000, co: "VTH", stage: "PROPOSAL", owner: "aman", activityDaysAgo: 2, createdDaysAgo: 2, source: "LINKEDIN" },
  { client: "fit_life_media", name: "Fit Life Media", service: "Monthly Editing", value: 120000, co: "VMH", stage: "PROPOSAL", owner: "aman", activityDaysAgo: 3, createdDaysAgo: 9, source: "FIVERR" },
  { client: "ashoka_buildcon", name: "Ashoka Buildcon", service: "Automation System", value: 350000, co: "VTH", stage: "PROPOSAL", owner: "priya", activityDaysAgo: 5, createdDaysAgo: 10, source: "REFERRAL" },
  // Negotiation: 5 leads, ₹4,60,000
  { client: "elite_creators", name: "Elite Creators", service: "YouTube Channel", value: 100000, co: "VMH", stage: "NEGOTIATION", owner: "neha", activityDaysAgo: 1, createdDaysAgo: 3, source: "FIVERR" },
  { client: "durrell_properties", name: "Durrell Properties", service: "2 Websites", value: 200000, co: "VTH", stage: "NEGOTIATION", owner: "rohan", activityDaysAgo: 2, createdDaysAgo: 11, source: "LINKEDIN" },
  { client: "nextgen_agency", name: "NextGen Agency", service: "Video Editing", value: 80000, co: "VMH", stage: "NEGOTIATION", owner: "neha", activityDaysAgo: 4, createdDaysAgo: 12, source: "EMAIL" },
  // Won: 3 leads, ₹4,50,000
  { client: "danny_drywall", name: "Danny Drywall", service: "Website + Estimator", value: 120000, co: "VTH", stage: "WON", owner: "rohan", activityDaysAgo: 7, createdDaysAgo: 7, source: "WEBSITE" },
  { client: "bhaumik_podcast", name: "Bhaumik Podcast", service: "12 Reels Editing", value: 60000, co: "VMH", stage: "WON", owner: "priya", activityDaysAgo: 7, createdDaysAgo: 13, source: "INSTAGRAM" },
  { client: "vidhi_enterprise", name: "Vidhi Enterprise", service: "Custom ERP", value: 270000, co: "VTH", stage: "WON", owner: "aman", activityDaysAgo: 14, createdDaysAgo: 14, source: "WEBSITE" },
];

/** Hidden leads per column: [count, total value, VMH count]; names are generated. */
export const HIDDEN_LEADS = {
  NEW: [5, 350000, 3],
  CONTACTED: [7, 375000, 5],
  PROPOSAL: [3, 160000, 2],
  NEGOTIATION: [2, 80000, 1],
} as const;

// ── Projects (pages 5, 6). status uses the template's statuses ───────────────────
export type ProjectFx = {
  key: string;
  client: string;
  name: string;
  co: Co;
  status: string;
  progress: number;
  typeLabel: string;
  category: "VIDEO_EDITING" | "WEBSITE_DEVELOPMENT" | "CRM_ERP" | "AUTOMATION" | "DESIGN";
  value: number;
  billing: "MONTHLY_RETAINER" | "FIXED_SCOPE" | "RETAINER_HOURS" | "TIME_AND_MATERIALS";
  start: string;
  due: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  members: TeamKey[];
  summary?: string;
  description?: string;
  retainerHours?: number;
  completed?: string;
};

export const PROJECTS: ProjectFx[] = [
  // VMH list, page 5 (in display order)
  {
    key: "bright_labs_shorts", client: "bright_labs", name: "YouTube Shorts Editing", co: "VMH", status: "IN_PROGRESS", progress: 70,
    typeLabel: "Short-form Video Editing", category: "VIDEO_EDITING", value: 80000, billing: "MONTHLY_RETAINER", start: "2026-10-01", due: "2026-10-25",
    priority: "HIGH", members: ["rohan", "priya", "aman", "neha", "dhruv"],
    summary: "Editing 12 Shorts per month with thumbnails and captions",
    description: "Edit 12 YouTube Shorts per month with engaging captions, transitions, sound effects and branded thumbnails. Maintain consistent style and fast turnaround (24–48 hours).",
  },
  { key: "elite_monthly", client: "elite_creators", name: "Monthly Video Editing", co: "VMH", status: "CLIENT_REVIEW", progress: 85, typeLabel: "Long-form Video Editing", category: "VIDEO_EDITING", value: 60000, billing: "MONTHLY_RETAINER", start: "2026-10-01", due: "2026-10-31", members: ["neha", "aman", "priya"] },
  { key: "flow_reels", client: "flow_marketing", name: "Instagram Reels Editing", co: "VMH", status: "EDITING", progress: 45, typeLabel: "Reels Editing", category: "VIDEO_EDITING", value: 45000, billing: "MONTHLY_RETAINER", start: "2026-10-05", due: "2026-10-30", members: ["aman", "priya", "dhruv"] },
  { key: "creative_channel", client: "creative_studio", name: "YouTube Channel Management", co: "VMH", status: "IN_PROGRESS", progress: 60, typeLabel: "Channel Management", category: "VIDEO_EDITING", value: 60000, billing: "MONTHLY_RETAINER", start: "2026-09-15", due: "2026-11-15", members: ["rohan", "priya"] },
  { key: "bhaumik_podcast_edit", client: "bhaumik_podcast", name: "Podcast Editing", co: "VMH", status: "REVISION", progress: 90, typeLabel: "Podcast Editing", category: "VIDEO_EDITING", value: 18000, billing: "FIXED_SCOPE", start: "2026-10-10", due: "2026-10-31", members: ["priya", "dhruv"] },
  { key: "scaleup_thumbnails", client: "scaleup_co", name: "Thumbnails Design", co: "VMH", status: "COMPLETED", progress: 100, typeLabel: "Thumbnail Design", category: "DESIGN", value: 25000, billing: "FIXED_SCOPE", start: "2026-09-20", due: "2026-10-15", completed: "2026-10-14", members: ["dhruv", "priya", "aman"] },
  { key: "fitlife_shortform", client: "fit_life_media", name: "Short-form Editing", co: "VMH", status: "IN_PROGRESS", progress: 55, typeLabel: "Short-form Video Editing", category: "VIDEO_EDITING", value: 22000, billing: "MONTHLY_RETAINER", start: "2026-10-05", due: "2026-11-05", members: ["aman", "neha"] },
  { key: "neha_reels", client: "neha_personal_brand", name: "Reels Editing", co: "VMH", status: "ON_HOLD", progress: 30, typeLabel: "Reels Editing", category: "VIDEO_EDITING", value: 30000, billing: "MONTHLY_RETAINER", start: "2026-09-01", due: "2026-11-30", members: ["priya", "aman", "dhruv"] },
  { key: "urban_longform", client: "urban_living", name: "YouTube Long-form", co: "VMH", status: "NOT_STARTED", progress: 0, typeLabel: "Long-form Video Editing", category: "VIDEO_EDITING", value: 40000, billing: "FIXED_SCOPE", start: "2026-10-26", due: "2026-11-30", members: [] },
  { key: "trendtalk_shorts", client: "trend_talk", name: "Shorts + Thumbnails", co: "VMH", status: "IN_PROGRESS", progress: 65, typeLabel: "Short-form Video Editing", category: "VIDEO_EDITING", value: 35000, billing: "MONTHLY_RETAINER", start: "2026-10-01", due: "2026-10-31", members: ["dhruv", "aman", "priya"] },
  // VMH, not in the visible list
  { key: "alex_shorts", client: "alex_johnson", name: "YouTube Shorts", co: "VMH", status: "CLIENT_REVIEW", progress: 80, typeLabel: "Short-form Video Editing", category: "VIDEO_EDITING", value: 50000, billing: "MONTHLY_RETAINER", start: "2026-10-01", due: "2026-10-31", members: ["priya", "rohan"] },
  { key: "karan_channel", client: "karan_mehta", name: "Channel Management", co: "VMH", status: "IN_PROGRESS", progress: 50, typeLabel: "Channel Management", category: "VIDEO_EDITING", value: 45000, billing: "MONTHLY_RETAINER", start: "2026-10-01", due: "2026-10-31", members: ["dhruv", "priya"] },
  { key: "bright_labs_podcast", client: "bright_labs", name: "Podcast Clips", co: "VMH", status: "COMPLETED", progress: 100, typeLabel: "Podcast Editing", category: "VIDEO_EDITING", value: 0, billing: "FIXED_SCOPE", start: "2026-08-01", due: "2026-08-31", completed: "2026-08-29", members: ["aman"] },
  { key: "elite_repurpose", client: "elite_creators", name: "Shorts Repurposing", co: "VMH", status: "IN_PROGRESS", progress: 40, typeLabel: "Short-form Video Editing", category: "VIDEO_EDITING", value: 20000, billing: "MONTHLY_RETAINER", start: "2026-10-01", due: "2026-10-31", members: ["neha"] },
  { key: "flow_ads", client: "flow_marketing", name: "Ad Creatives", co: "VMH", status: "COMPLETED", progress: 100, typeLabel: "Ad Video Editing", category: "VIDEO_EDITING", value: 30000, billing: "FIXED_SCOPE", start: "2026-09-01", due: "2026-09-30", completed: "2026-09-28", members: ["aman"] },
  { key: "nextgen_video", client: "nextgen_agency", name: "Brand Video Editing", co: "VMH", status: "NOT_STARTED", progress: 0, typeLabel: "Long-form Video Editing", category: "VIDEO_EDITING", value: 80000, billing: "FIXED_SCOPE", start: "2026-10-28", due: "2026-11-28", members: [] },

  // VTH list, page 6 (in display order)
  {
    key: "greenbuild_crm", client: "greenbuild_infra", name: "Custom CRM Development", co: "VTH", status: "IN_PROGRESS", progress: 70,
    typeLabel: "Custom CRM Development", category: "CRM_ERP", value: 250000, billing: "FIXED_SCOPE", start: "2026-09-01", due: "2026-10-30",
    priority: "HIGH", members: ["neha", "priya", "rohan", "aman", "dhrumil"],
    summary: "Custom CRM with lead management, project tracking and automation",
    description: "Custom CRM system for GreenBuild Infra to manage leads, clients, projects and automation workflows. Includes role-based access, reporting dashboard and integrations with email and contact forms.",
  },
  { key: "rocco_web_crm", client: "rocco_construction", name: "Website + CRM", co: "VTH", status: "IN_REVIEW", progress: 85, typeLabel: "Website + CRM", category: "WEBSITE_DEVELOPMENT", value: 300000, billing: "FIXED_SCOPE", start: "2026-10-12", due: "2026-10-26", members: ["aman", "neha", "rohan"] },
  { key: "ashoka_website", client: "ashoka_buildcon", name: "Website Redesign", co: "VTH", status: "DEVELOPMENT", progress: 60, typeLabel: "Website Redesign", category: "WEBSITE_DEVELOPMENT", value: 150000, billing: "FIXED_SCOPE", start: "2026-09-15", due: "2026-11-10", members: ["neha", "priya", "rohan"] },
  { key: "vidhi_erp", client: "vidhi_enterprise", name: "Custom ERP System", co: "VTH", status: "PLANNING", progress: 20, typeLabel: "Custom ERP Development", category: "CRM_ERP", value: 270000, billing: "FIXED_SCOPE", start: "2026-10-12", due: "2026-12-31", members: ["rohan", "neha"] },
  { key: "nextgen_automation", client: "nextgen_agency", name: "AI Automation (n8n)", co: "VTH", status: "IN_PROGRESS", progress: 55, typeLabel: "Automation (n8n)", category: "AUTOMATION", value: 120000, billing: "RETAINER_HOURS", retainerHours: 60, start: "2026-10-15", due: "2026-11-05", members: ["neha", "rohan", "aman"] },
  { key: "durrell_crm", client: "durrell_properties", name: "Property Management CRM", co: "VTH", status: "COMPLETED", progress: 100, typeLabel: "Custom CRM Development", category: "CRM_ERP", value: 200000, billing: "FIXED_SCOPE", start: "2026-08-01", due: "2026-10-15", completed: "2026-10-14", members: ["neha", "aman", "rohan"] },
  { key: "elite_automation", client: "elite_creators", name: "Automation + Dashboard", co: "VTH", status: "DEVELOPMENT", progress: 45, typeLabel: "Automation (n8n)", category: "AUTOMATION", value: 40000, billing: "FIXED_SCOPE", start: "2026-10-01", due: "2026-11-15", members: ["neha", "priya", "rohan"] },
  { key: "scaleup_website", client: "scaleup_co", name: "Website Development", co: "VTH", status: "ON_HOLD", progress: 30, typeLabel: "Website Development", category: "WEBSITE_DEVELOPMENT", value: 150000, billing: "FIXED_SCOPE", start: "2026-10-01", due: "2026-11-20", members: ["aman", "neha", "rohan"] },
  { key: "flow_portal", client: "flow_marketing", name: "Client Portal + CRM", co: "VTH", status: "PLANNING", progress: 10, typeLabel: "Client Portal + CRM", category: "CRM_ERP", value: 90000, billing: "FIXED_SCOPE", start: "2026-10-20", due: "2026-12-15", members: ["neha", "priya", "aman"] },
  { key: "urban_dashboard", client: "urban_living", name: "Real Estate Dashboard", co: "VTH", status: "PLANNING", progress: 0, typeLabel: "Dashboard Development", category: "WEBSITE_DEVELOPMENT", value: 120000, billing: "FIXED_SCOPE", start: "2026-10-25", due: "2026-12-20", members: ["neha"] },
  // VTH, not in the visible list (page 1 approvals)
  { key: "bright_labs_website", client: "bright_labs", name: "Website Redesign", co: "VTH", status: "IN_REVIEW", progress: 75, typeLabel: "Website Redesign", category: "WEBSITE_DEVELOPMENT", value: 200000, billing: "FIXED_SCOPE", start: "2026-09-10", due: "2026-10-31", members: ["neha", "priya"] },
  { key: "scaleup_crm", client: "scaleup_co", name: "CRM Development", co: "VTH", status: "IN_PROGRESS", progress: 35, typeLabel: "Custom CRM Development", category: "CRM_ERP", value: 0, billing: "TIME_AND_MATERIALS", start: "2026-10-05", due: "2026-12-01", members: ["neha", "rohan"] },
];

/** VMH projects for generated clients: [status, count]. Brings VMH to 28 (4 review, 6 completed). */
export const PADDED_VMH_PROJECTS: [string, number][] = [
  ["CLIENT_REVIEW", 2],
  ["COMPLETED", 3],
  ["IN_PROGRESS", 4],
  ["EDITING", 2],
  ["NOT_STARTED", 1],
];

// ── Tasks (page 7 board + My Tasks; page 5/6 project task lists) ────────────────
export type TaskFx = {
  title: string;
  client: string;
  project: string;
  co: Co;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "CLIENT_REVIEW" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  due: string;
  progress?: number;
  assignee: TeamKey;
  stage?: "EDITING" | "INTERNAL_QC" | "CLIENT_REVIEW" | "REVISION" | "DELIVERED";
};

export const TASKS: TaskFx[] = [
  // To Do (12)
  { title: "Edit Podcast Episode #12", client: "bhaumik_podcast", project: "bhaumik_podcast_edit", co: "VMH", status: "TODO", priority: "HIGH", due: "2026-10-20", assignee: "priya" },
  { title: "Create Thumbnail Options", client: "elite_creators", project: "elite_monthly", co: "VMH", status: "TODO", priority: "MEDIUM", due: "2026-10-21", assignee: "dhruv" },
  { title: "Website Homepage Design", client: "rocco_construction", project: "rocco_web_crm", co: "VTH", status: "TODO", priority: "HIGH", due: "2026-10-20", assignee: "neha" },
  { title: "CRM Module - User Roles", client: "greenbuild_infra", project: "greenbuild_crm", co: "VTH", status: "TODO", priority: "MEDIUM", due: "2026-10-22", assignee: "neha" },
  { title: "Prepare Client Presentation", client: "nextgen_agency", project: "nextgen_automation", co: "VTH", status: "TODO", priority: "LOW", due: "2026-10-24", assignee: "rohan" },
  // In Progress (18)
  { title: "Edit YouTube Short #1", client: "bright_labs", project: "bright_labs_shorts", co: "VMH", status: "IN_PROGRESS", priority: "HIGH", due: "2026-10-20", progress: 70, assignee: "rohan", stage: "EDITING" },
  { title: "Client Revisions - Video 2", client: "elite_creators", project: "elite_monthly", co: "VMH", status: "IN_PROGRESS", priority: "MEDIUM", due: "2026-10-23", progress: 50, assignee: "aman", stage: "REVISION" },
  { title: "CRM Lead Module", client: "greenbuild_infra", project: "greenbuild_crm", co: "VTH", status: "IN_PROGRESS", priority: "HIGH", due: "2026-10-22", progress: 60, assignee: "neha" },
  { title: "Landing Page Development", client: "scaleup_co", project: "scaleup_website", co: "VTH", status: "IN_PROGRESS", priority: "MEDIUM", due: "2026-10-27", progress: 40, assignee: "aman" },
  { title: "Automation Workflow (n8n)", client: "ashoka_buildcon", project: "ashoka_website", co: "VTH", status: "IN_PROGRESS", priority: "HIGH", due: "2026-10-28", progress: 65, assignee: "neha" },
  // In Review (8)
  { title: "Thumbnail Review", client: "creative_studio", project: "creative_channel", co: "VMH", status: "IN_REVIEW", priority: "MEDIUM", due: "2026-10-23", progress: 90, assignee: "priya", stage: "INTERNAL_QC" },
  { title: "Website UI Design", client: "vidhi_enterprise", project: "vidhi_erp", co: "VTH", status: "IN_REVIEW", priority: "HIGH", due: "2026-10-21", progress: 80, assignee: "priya" },
  { title: "API Integration Testing", client: "nextgen_agency", project: "nextgen_automation", co: "VTH", status: "IN_REVIEW", priority: "MEDIUM", due: "2026-10-24", progress: 70, assignee: "neha" },
  { title: "Final Video QC", client: "neha_personal_brand", project: "neha_reels", co: "VMH", status: "IN_REVIEW", priority: "HIGH", due: "2026-10-25", progress: 90, assignee: "aman", stage: "INTERNAL_QC" },
  // Client Review (10)
  { title: "Short #3 for Approval", client: "bright_labs", project: "bright_labs_shorts", co: "VMH", status: "CLIENT_REVIEW", priority: "HIGH", due: "2026-10-23", progress: 100, assignee: "rohan", stage: "CLIENT_REVIEW" },
  { title: "Website Design Approval", client: "rocco_construction", project: "rocco_web_crm", co: "VTH", status: "CLIENT_REVIEW", priority: "MEDIUM", due: "2026-10-24", progress: 100, assignee: "aman" },
  { title: "CRM Dashboard Review", client: "greenbuild_infra", project: "greenbuild_crm", co: "VTH", status: "CLIENT_REVIEW", priority: "HIGH", due: "2026-10-25", progress: 100, assignee: "neha" },
  { title: "Podcast Episode Final", client: "bhaumik_podcast", project: "bhaumik_podcast_edit", co: "VMH", status: "CLIENT_REVIEW", priority: "MEDIUM", due: "2026-10-22", progress: 100, assignee: "priya", stage: "CLIENT_REVIEW" },
  // Completed (20)
  { title: "Short #2 Delivered", client: "bright_labs", project: "bright_labs_shorts", co: "VMH", status: "COMPLETED", priority: "HIGH", due: "2026-10-21", progress: 100, assignee: "rohan", stage: "DELIVERED" },
  { title: "Thumbnail Set Delivered", client: "elite_creators", project: "elite_monthly", co: "VMH", status: "COMPLETED", priority: "MEDIUM", due: "2026-10-21", progress: 100, assignee: "dhruv", stage: "DELIVERED" },
  { title: "Homepage Design Live", client: "scaleup_co", project: "scaleup_website", co: "VTH", status: "COMPLETED", priority: "HIGH", due: "2026-10-20", progress: 100, assignee: "aman" },
  { title: "Lead Module Completed", client: "greenbuild_infra", project: "greenbuild_crm", co: "VTH", status: "COMPLETED", priority: "MEDIUM", due: "2026-10-15", progress: 100, assignee: "neha" },
  { title: "Podcast Episode #11", client: "bhaumik_podcast", project: "bhaumik_podcast_edit", co: "VMH", status: "COMPLETED", priority: "MEDIUM", due: "2026-10-19", progress: 100, assignee: "priya", stage: "DELIVERED" },
  // Page 5: Bright Labs project tasks (8/12 completed)
  { title: "Edit Short #1", client: "bright_labs", project: "bright_labs_shorts", co: "VMH", status: "COMPLETED", priority: "HIGH", due: "2026-10-20", progress: 100, assignee: "aman", stage: "DELIVERED" },
  { title: "Edit Short #2", client: "bright_labs", project: "bright_labs_shorts", co: "VMH", status: "COMPLETED", priority: "HIGH", due: "2026-10-21", progress: 100, assignee: "priya", stage: "DELIVERED" },
  { title: "Edit Short #3", client: "bright_labs", project: "bright_labs_shorts", co: "VMH", status: "IN_REVIEW", priority: "HIGH", due: "2026-10-22", progress: 90, assignee: "aman", stage: "INTERNAL_QC" },
  { title: "Edit Short #4", client: "bright_labs", project: "bright_labs_shorts", co: "VMH", status: "IN_PROGRESS", priority: "MEDIUM", due: "2026-10-23", progress: 40, assignee: "priya", stage: "EDITING" },
  { title: "Edit Short #5", client: "bright_labs", project: "bright_labs_shorts", co: "VMH", status: "TODO", priority: "MEDIUM", due: "2026-10-24", assignee: "dhruv" },
  // Page 6: GreenBuild project tasks (12 total)
  { title: "Design CRM Dashboard", client: "greenbuild_infra", project: "greenbuild_crm", co: "VTH", status: "COMPLETED", priority: "HIGH", due: "2026-10-12", progress: 100, assignee: "priya" },
  { title: "Build Lead Module", client: "greenbuild_infra", project: "greenbuild_crm", co: "VTH", status: "COMPLETED", priority: "HIGH", due: "2026-10-15", progress: 100, assignee: "rohan" },
  { title: "Setup Email Integration", client: "greenbuild_infra", project: "greenbuild_crm", co: "VTH", status: "IN_PROGRESS", priority: "MEDIUM", due: "2026-10-18", progress: 50, assignee: "priya" },
  { title: "Develop Reports", client: "greenbuild_infra", project: "greenbuild_crm", co: "VTH", status: "IN_PROGRESS", priority: "MEDIUM", due: "2026-10-20", progress: 30, assignee: "rohan" },
  { title: "QA Testing", client: "greenbuild_infra", project: "greenbuild_crm", co: "VTH", status: "TODO", priority: "MEDIUM", due: "2026-10-25", assignee: "priya" },
];

/** Column totals on the page 7 board. */
export const BOARD_COUNTS = { TODO: 12, IN_PROGRESS: 18, IN_REVIEW: 8, CLIENT_REVIEW: 10, COMPLETED: 20 } as const;

/** The task opened in the page 7 drawer. */
export const DRAWER_TASK = {
  title: "Edit YouTube Short #1",
  start: "2026-10-18",
  tags: ["Editing", "Shorts", "YouTube"],
  description: "Edit 1 YouTube Short (30–60 seconds) with captions, transitions, background music and brand elements as per the brief. Maintain fast pace and engaging style.",
  checklist: [
    ["Rough-cut editing", true, "rohan"],
    ["Add captions", true, "priya"],
    ["Add background music", true, "aman"],
    ["Add brand elements (logo, lower third)", false, "neha"],
    ["Export final file (1080x1920)", false, "rohan"],
  ] as [string, boolean, TeamKey][],
  comments: [
    ["priya", "2026-10-18", "11:30", "Looks good! Can we make the captions bold?"],
    ["rohan", "2026-10-18", "12:15", "Updated the captions. Please check the new version."],
    ["priya", "2026-10-18", "15:40", "Perfect, the bold captions read much better on mobile."],
    ["dhrumil", "2026-10-19", "10:05", "@Rohan let's lock this one and move to Short #2 once the music is in."],
  ] as [TeamKey, string, string, string][],
  files: [
    ["Short_RoughCut.mp4", 45 * 1024 * 1024, "video/mp4"],
    ["Brand_Logo.png", 2 * 1024 * 1024, "image/png"],
    ["Music_Track.mp3", 5 * 1024 * 1024, "audio/mpeg"],
  ] as [string, number, string][],
  timeMinutes: 150,
};

// ── Time entries (page 8 timesheet rows) ─────────────────────────────────────
export const TIME_ROWS: { date: string; who: TeamKey; project: string; task: string; start: string; end: string; billable: boolean }[] = [
  { date: "2026-10-20", who: "rohan", project: "bright_labs_shorts", task: "Edit Short #1", start: "10:00", end: "11:30", billable: true },
  { date: "2026-10-20", who: "priya", project: "greenbuild_crm", task: "UI Design - Dashboard", start: "11:45", end: "13:15", billable: true },
  { date: "2026-10-20", who: "aman", project: "elite_monthly", task: "Add Captions", start: "14:00", end: "16:00", billable: true },
  { date: "2026-10-20", who: "neha", project: "nextgen_automation", task: "Workflow Setup", start: "16:15", end: "18:00", billable: true },
  { date: "2026-10-19", who: "dhruv", project: "scaleup_thumbnails", task: "Thumbnail Options", start: "11:00", end: "12:30", billable: true },
  { date: "2026-10-19", who: "rohan", project: "vth_internal", task: "Figma Design", start: "13:00", end: "15:30", billable: false },
  { date: "2026-10-19", who: "priya", project: "bhaumik_podcast_edit", task: "Episode Edit", start: "16:00", end: "18:00", billable: true },
  { date: "2026-10-18", who: "aman", project: "ashoka_website", task: "Client Meeting", start: "15:00", end: "16:00", billable: false },
];

/**
 * October minutes per person × company × billable, chosen so every page-8 / page-13 total
 * holds: 186h 30m total; VMH 108h 20m / VTH 78h 10m; billable 152h 15m (92h 40m / 59h 35m).
 * Visible rows above are part of these buckets.
 */
export const TIME_BUCKETS: Record<TeamKey, { VMH_B: number; VMH_N: number; VTH_B: number; VTH_N: number }> = {
  dhrumil: { VMH_B: 300, VMH_N: 490, VTH_B: 320, VTH_N: 600 },
  rohan: { VMH_B: 1500, VMH_N: 250, VTH_B: 650, VTH_N: 150 },
  priya: { VMH_B: 1200, VMH_N: 100, VTH_B: 800, VTH_N: 75 },
  aman: { VMH_B: 700, VMH_N: 100, VTH_B: 600, VTH_N: 290 },
  neha: { VMH_B: 760, VMH_N: 0, VTH_B: 1205, VTH_N: 0 },
  dhruv: { VMH_B: 1100, VMH_N: 0, VTH_B: 0, VTH_N: 0 },
};

/** Minutes logged Mon 19 – Wed 21 Oct, so dashboard workload reads like page 1 (70% / Over / Idle / 60%). */
export const WEEK_TARGET_MIN: Record<TeamKey, number> = { dhrumil: 600, rohan: 1680, priya: 1980, aman: 960, neha: 1320, dhruv: 720 };

/** Planned minutes on open tasks due this week (adds to workload). */
export const WEEK_PLANNED_MIN: Partial<Record<TeamKey, number>> = { priya: 900, neha: 120 };

/** GreenBuild CRM: 42h 30m logged, 38h 15m billable (page 6 Time Tracking card). */
export const GREENBUILD_MINUTES = { billable: 2295, nonBillable: 255 };

// ── Invoices (page 9 table; VTH-019 line items) ───────────────────────────────
export type InvoiceFx = { number: string; client: string; project: string; issue: string; due: string; amount: number; paidPct: number; draft?: boolean };

export const INVOICES: InvoiceFx[] = [
  { number: "VMH-021", client: "bright_labs", project: "bright_labs_shorts", issue: "2026-10-20", due: "2026-10-27", amount: 40000, paidPct: 100 },
  { number: "VTH-019", client: "greenbuild_infra", project: "greenbuild_crm", issue: "2026-10-18", due: "2026-11-02", amount: 250000, paidPct: 40 },
  { number: "VMH-020", client: "elite_creators", project: "elite_monthly", issue: "2026-10-15", due: "2026-10-22", amount: 25000, paidPct: 100 },
  { number: "VTH-018", client: "rocco_construction", project: "rocco_web_crm", issue: "2026-10-12", due: "2026-10-26", amount: 300000, paidPct: 20 },
  { number: "VMH-019", client: "bhaumik_podcast", project: "bhaumik_podcast_edit", issue: "2026-10-10", due: "2026-10-20", amount: 18000, paidPct: 100 },
  { number: "VTH-017", client: "scaleup_co", project: "scaleup_website", issue: "2026-10-08", due: "2026-10-25", amount: 150000, paidPct: 60 },
  { number: "VMH-018", client: "fit_life_media", project: "fitlife_shortform", issue: "2026-10-05", due: "2026-10-15", amount: 22000, paidPct: 100 },
  { number: "VTH-016", client: "nextgen_agency", project: "nextgen_automation", issue: "2026-10-03", due: "2026-10-20", amount: 120000, paidPct: 50 },
  { number: "VMH-017", client: "flow_marketing", project: "flow_reels", issue: "2026-10-01", due: "2026-10-10", amount: 30000, paidPct: 100 },
  { number: "VTH-015", client: "ashoka_buildcon", project: "ashoka_website", issue: "2026-09-28", due: "2026-10-15", amount: 350000, paidPct: 30 },
];

export const VTH019_LINES: [string, number, number][] = [
  ["CRM Development", 1, 180000],
  ["Email Integration", 1, 40000],
  ["Training & Handover", 1, 30000],
];

// ── Goals (pages 1, 10, 11) ─────────────────────────────────────────────────
export type GoalFx = {
  key: string;
  title: string;
  subtitle?: string;
  co: Co | null;
  scope: "COMPANY" | "TEAM" | "PERSONAL";
  category: string;
  unit: "CURRENCY" | "COUNT" | "PERCENT" | "HOURS";
  current: number;
  target: number;
  start: string;
  end: string;
  owner: TeamKey;
  members?: TeamKey[];
  icon: string;
  description?: string;
};

export const GOALS: GoalFx[] = [
  // Page 10 table
  { key: "vth_monthly_revenue", title: "Monthly Revenue Goal", subtitle: "Increase monthly revenue for Vertex Tech House", co: "VTH", scope: "COMPANY", category: "REVENUE_SALES", unit: "CURRENCY", current: 187500, target: 250000, start: "2026-10-01", end: "2026-10-31", owner: "dhrumil", members: ["neha", "priya", "rohan", "aman", "dhruv"], icon: "target", description: "Increase monthly revenue by 25% through new website, CRM and automation projects." },
  { key: "vmh_new_clients", title: "Acquire 5 New Clients", co: "VMH", scope: "COMPANY", category: "CLIENT_ACQUISITION", unit: "COUNT", current: 3, target: 5, start: "2026-10-01", end: "2026-10-31", owner: "rohan", icon: "users" },
  { key: "vmh_20_projects", title: "Complete 20 Projects", co: "VMH", scope: "COMPANY", category: "PROJECT_DELIVERY", unit: "COUNT", current: 16, target: 20, start: "2026-10-01", end: "2026-10-31", owner: "rohan", icon: "folder-check" },
  { key: "vth_crm_module", title: "Launch CRM Module", co: "VTH", scope: "TEAM", category: "PRODUCT_DEVELOPMENT", unit: "PERCENT", current: 40, target: 100, start: "2026-10-01", end: "2026-11-15", owner: "neha", icon: "rocket" },
  { key: "vmh_hire_editors", title: "Hire 2 New Editors", co: "VMH", scope: "COMPANY", category: "TEAM_HIRING", unit: "COUNT", current: 1, target: 2, start: "2026-10-01", end: "2026-10-31", owner: "dhrumil", icon: "user-plus" },
  { key: "vth_automate", title: "Automate 3 Workflows", co: "VTH", scope: "TEAM", category: "PROCESS_AUTOMATION", unit: "PERCENT", current: 20, target: 100, start: "2026-10-01", end: "2026-10-31", owner: "neha", icon: "workflow" },
  { key: "vth_website_redesign", title: "Complete Website Redesign", co: "VTH", scope: "TEAM", category: "PROJECT_DELIVERY", unit: "PERCENT", current: 90, target: 100, start: "2026-10-01", end: "2026-10-31", owner: "aman", icon: "folder-check" },
  { key: "vmh_12_shorts", title: "Create 12 YouTube Shorts", co: "VMH", scope: "TEAM", category: "CONTENT_CREATION", unit: "COUNT", current: 12, target: 12, start: "2026-10-01", end: "2026-10-31", owner: "priya", icon: "youtube" },
  { key: "all_satisfaction", title: "Improve Client Satisfaction", co: null, scope: "COMPANY", category: "CLIENT_SUCCESS", unit: "PERCENT", current: 55, target: 100, start: "2026-10-01", end: "2026-12-31", owner: "rohan", icon: "smile" },
  { key: "all_ai_training", title: "Team Training (AI Tools)", co: null, scope: "TEAM", category: "LEARNING_GROWTH", unit: "PERCENT", current: 35, target: 100, start: "2026-10-01", end: "2026-10-31", owner: "dhrumil", icon: "graduation-cap" },
  // Page 11 (simple view, "My Goals" for Dhrumil: owner or member)
  { key: "rev_10l", title: "Generate ₹10,00,000 Revenue", subtitle: "Total revenue across all services", co: null, scope: "PERSONAL", category: "REVENUE_SALES", unit: "CURRENCY", current: 700000, target: 1000000, start: "2026-10-01", end: "2026-10-31", owner: "dhrumil", icon: "bar-chart" },
  { key: "ten_clients", title: "Get 10 New Clients", subtitle: "New clients for both companies", co: null, scope: "TEAM", category: "CLIENT_ACQUISITION", unit: "COUNT", current: 6, target: 10, start: "2026-10-01", end: "2026-10-31", owner: "priya", members: ["dhrumil", "neha", "rohan", "aman", "dhruv"], icon: "users" },
  { key: "five_projects", title: "Complete 5 Active Projects", subtitle: "Deliver and go live", co: null, scope: "TEAM", category: "PROJECT_DELIVERY", unit: "COUNT", current: 2, target: 5, start: "2026-10-01", end: "2026-10-31", owner: "rohan", members: ["dhrumil"], icon: "file-text" },
  { key: "twenty_videos", title: "Publish 20 YouTube Videos", subtitle: "For Vertex Media House", co: "VMH", scope: "TEAM", category: "CONTENT_CREATION", unit: "COUNT", current: 6, target: 20, start: "2026-10-01", end: "2026-10-20", owner: "priya", members: ["dhrumil"], icon: "youtube" },
  { key: "learn_n8n", title: "Learn n8n Automation", subtitle: "Complete basic to advanced course", co: null, scope: "PERSONAL", category: "LEARNING_GROWTH", unit: "PERCENT", current: 80, target: 100, start: "2026-10-01", end: "2026-10-31", owner: "aman", members: ["dhrumil"], icon: "graduation-cap" },
  // Page 1 "Goals Progress"
  { key: "vmh_monthly_revenue", title: "VMH - Monthly Revenue", subtitle: "₹5,00,000", co: "VMH", scope: "COMPANY", category: "REVENUE_SALES", unit: "CURRENCY", current: 360000, target: 500000, start: "2026-10-01", end: "2026-10-31", owner: "dhrumil", icon: "target" },
  { key: "vth_new_clients_monthly", title: "VTH - New Clients (Monthly)", subtitle: "10 clients", co: "VTH", scope: "COMPANY", category: "CLIENT_ACQUISITION", unit: "COUNT", current: 6, target: 10, start: "2026-10-01", end: "2026-10-31", owner: "dhrumil", icon: "users" },
  { key: "videos_weekly", title: "Videos Delivered (Weekly)", subtitle: "20 videos", co: "VMH", scope: "TEAM", category: "PROJECT_DELIVERY", unit: "COUNT", current: 17, target: 20, start: "2026-10-19", end: "2026-10-25", owner: "rohan", icon: "video" },
  { key: "projects_shipped", title: "Projects Shipped (Monthly)", subtitle: "5 projects", co: "VTH", scope: "TEAM", category: "PROJECT_DELIVERY", unit: "COUNT", current: 2, target: 5, start: "2026-10-01", end: "2026-10-31", owner: "neha", icon: "rocket" },
];

export const VTH_REVENUE_MILESTONES: [string, string, boolean][] = [
  ["Launch website & landing page", "2026-10-01", true],
  ["Get 3 new client proposals", "2026-10-15", true],
  ["Reach ₹1,50,000 revenue", "2026-10-25", true],
  ["Reach ₹2,50,000 revenue", "2026-10-31", false],
];

// ── Files (page 12 list, pages 5/6 recent files) ──────────────────────────────
export const FILE_ROWS: { name: string; size: number; modified: string; folder: string; client?: string; project?: string; status?: "DRAFT" | "REVIEW" | "FINAL"; tags?: string[]; description?: string }[] = [
  { name: "Project Brief - Bright Labs.pdf", size: 2.4 * 1024 * 1024, modified: "2026-10-20", folder: "client:bright_labs", client: "bright_labs", tags: ["Brief", "Client", "Website"], description: "Initial project brief and requirements shared by Bright Labs for website redesign." },
  { name: "Website Design Figma.fig", size: 5.1 * 1024 * 1024, modified: "2026-10-19", folder: "design", project: "rocco_web_crm" },
  { name: "Intro Video Final.mp4", size: 48.3 * 1024 * 1024, modified: "2026-10-18", folder: "video", project: "elite_monthly", status: "FINAL" },
  { name: "CRM Flow Diagram.png", size: 1.2 * 1024 * 1024, modified: "2026-10-17", folder: "project:crm", project: "greenbuild_crm" },
  { name: "Client Meeting Notes.docx", size: 850 * 1024, modified: "2026-10-16", folder: "documents", client: "greenbuild_infra" },
  { name: "Invoice Template.xlsx", size: 320 * 1024, modified: "2026-10-15", folder: "documents" },
  { name: "Logo - GreenBuild.ai", size: 6.8 * 1024 * 1024, modified: "2026-10-14", folder: "design", client: "greenbuild_infra" },
  { name: "Thumbnail Design.psd", size: 12.4 * 1024 * 1024, modified: "2026-10-13", folder: "design", project: "scaleup_thumbnails" },
  { name: "Automation Workflow.json", size: 48 * 1024, modified: "2026-10-12", folder: "project:automation", project: "nextgen_automation" },
  // page 5 recent files (Bright Labs shorts)
  { name: "Short_01_Final.mp4", size: 24 * 1024 * 1024, modified: "2026-10-20", folder: "client:bright_labs", project: "bright_labs_shorts", status: "FINAL" },
  { name: "Short_02_Review.mp4", size: 22 * 1024 * 1024, modified: "2026-10-21", folder: "client:bright_labs", project: "bright_labs_shorts", status: "REVIEW" },
  { name: "Thumbnail_01.jpg", size: 3 * 1024 * 1024, modified: "2026-10-20", folder: "client:bright_labs", project: "bright_labs_shorts", status: "FINAL" },
  { name: "Captions_Short_01.srt", size: 120 * 1024, modified: "2026-10-20", folder: "client:bright_labs", project: "bright_labs_shorts", status: "FINAL" },
  { name: "Style Guide.pdf", size: 2 * 1024 * 1024, modified: "2026-10-18", folder: "client:bright_labs", project: "bright_labs_shorts" },
  // page 6 recent files (GreenBuild CRM)
  { name: "CRM_Requirements.pdf", size: 2.4 * 1024 * 1024, modified: "2026-09-01", folder: "client:greenbuild_infra", project: "greenbuild_crm" },
  { name: "UI_Designs.fig", size: 12 * 1024 * 1024, modified: "2026-09-05", folder: "client:greenbuild_infra", project: "greenbuild_crm" },
  { name: "Database_Structure.xlsx", size: 1.1 * 1024 * 1024, modified: "2026-09-08", folder: "client:greenbuild_infra", project: "greenbuild_crm" },
  { name: "API_Integration_Docs.pdf", size: 3.2 * 1024 * 1024, modified: "2026-09-12", folder: "client:greenbuild_infra", project: "greenbuild_crm" },
  { name: "Testing_Report.pdf", size: 1.8 * 1024 * 1024, modified: "2026-10-20", folder: "client:greenbuild_infra", project: "greenbuild_crm" },
];

/** Page 12 category cards: [category, sub-folders, files]. */
export const FILE_CATEGORY_COUNTS: [string, number, number][] = [
  ["CLIENT_FILES", 12, 248],
  ["PROJECT_FILES", 18, 320],
  ["DESIGN_ASSETS", 8, 156],
  ["VIDEO_ASSETS", 6, 210],
  ["DOCUMENTS", 10, 96],
];

// ── Campaigns, agenda, activity, alerts (page 1) ──────────────────────────────
export const CAMPAIGNS: { name: string; co: Co | null; subject: string; sent: number; openPct: number; replyPct: number; meetings: number }[] = [
  { name: "YouTube Growth Outreach", co: "VMH", subject: "{{firstName}}, 3 edits that doubled a creator's Shorts views", sent: 2450, openPct: 48, replyPct: 12, meetings: 6 },
  { name: "Website & CRM Leads", co: "VTH", subject: "A CRM built around how {{company}} actually works", sent: 1820, openPct: 36, replyPct: 8, meetings: 4 },
  { name: "Re-Engagement Campaign", co: null, subject: "It's been a while, {{firstName}}: here's what's new at Vertex", sent: 980, openPct: 52, replyPct: 14, meetings: 8 },
];

export const AGENDA: { time: string; minutes: number; title: string; type: "CALL" | "REVIEW" | "FOLLOW_UP" | "MEETING"; co: Co | null; client?: string; project?: string }[] = [
  { time: "10:00", minutes: 30, title: "Client Call - Bright Labs", type: "CALL", co: "VTH", client: "bright_labs", project: "bright_labs_website" },
  { time: "11:30", minutes: 45, title: "Project Review - YouTube Batch", type: "REVIEW", co: "VMH", project: "bright_labs_shorts" },
  { time: "14:00", minutes: 30, title: "Follow Up - New Lead (ScaleUp Co.)", type: "FOLLOW_UP", co: "VTH", client: "scaleup_co" },
  { time: "16:00", minutes: 30, title: "Team Sync", type: "MEETING", co: null },
  // later in the day: what the scoped dashboards (page 2) show after the shared rows
  { time: "17:00", minutes: 30, title: "Client Call - Alex Johnson", type: "CALL", co: "VMH", client: "alex_johnson" },
  { time: "17:30", minutes: 30, title: "Platform Demo - Real Estate CRM", type: "CALL", co: "VTH", client: "urban_living", project: "urban_dashboard" },
];

/** Pending approvals for page 1 "Client Approvals Waiting": [project, deliverable, days waiting]. */
export const APPROVALS_WAITING: [string, string, number][] = [
  ["alex_shorts", "Video Batch #12", 2],
  ["bright_labs_website", "Homepage Design", 4],
  ["karan_channel", "Thumbnails", 1],
  ["scaleup_crm", "Feature Module", 6],
];

/** Page 5 "Client Approvals" for the Bright Labs shorts project. */
export const BRIGHT_APPROVALS: [string, "APPROVED" | "REVISION" | "PENDING", string][] = [
  ["Short #1", "APPROVED", "2026-10-20"],
  ["Short #2", "REVISION", "2026-10-21"],
  ["Thumbnail #1", "APPROVED", "2026-10-19"],
  ["Short #3", "PENDING", "2026-10-22"],
];
