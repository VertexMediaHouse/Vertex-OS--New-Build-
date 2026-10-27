import * as fs from "node:fs";
import * as path from "node:path";
import { hashPassword } from "better-auth/crypto";
import { addDays, now, startOfWeekIST } from "../lib/clock";
import { goalProgress, goalStatus } from "../lib/metrics/goals";
import { invoiceStatus } from "../lib/invoices/status";
import { companySettingsSchema } from "../lib/settings";
import * as F from "./seed-fixtures";
import { at, day, minutesAgo, rng, slug, splitInto, splitTotal, weekdays } from "./seed-util";

const outDir = path.resolve(process.cwd(), "lib/db/mock-data");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// In-memory collections for all models
const tables: Record<string, any[]> = {
  company: [],
  user: [],
  session: [],
  account: [],
  verification: [],
  rateLimit: [],
  membership: [],
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

const r = rng();
const coId = (c: F.Co) => c.toLowerCase();
const uid = (k: F.TeamKey) => `user_${k}`;
const NOW = now();
const STAFF: F.TeamKey[] = ["sheen", "hardik"];

const PADDED_CLIENT_NAMES = [
  "Pixel Pulse Media", "Kavya Creations", "Spice Route Foods", "Nimbus Fitness", "Orbit Realty", "Sunrise Dental Care",
  "TechNova Labs", "Mehta Textiles", "Coastal Homes", "Bloom Skincare", "Zenith Logistics", "Urban Brew Cafe",
  "The Daily Grind Podcast", "Gamer Guild", "Travel With Tara", "Finance Simplified", "Desi Kitchen Tales",
  "Yoga With Ananya", "Startup Saga", "CodeCraft Academy", "Lumen Interiors", "Peak Performance Coaching",
  "Green Leaf Organics", "Skyline Builders", "Bright Smile Clinic", "Royal Jewellers", "Metro Motors",
  "Harbor Freight Co.", "Nova Legal Associates", "Prime Properties", "Swift Couriers", "Crafted Cocktails",
  "Rhythm Dance Studio", "Kids Learn Fun", "Pet Paradise", "Fresh Basket", "Vista Eyewear", "Iron Gym",
  "Mindful Money", "Silverline Events", "Artisan Bakery", "Cloud Nine Travels", "BuildRight Infra",
  "Smart Home Hub", "Elevate Consulting", "Pure Water Systems", "Tech Talk Daily", "The Startup Show",
  "Global Exports Ltd",
];
const VMH_TYPES = ["YouTube Editing", "Short-form Editing", "Podcast Editing", "Reels Editing", "Channel Management", "Thumbnail Design"];
const VTH_TYPES = ["Website Development", "Custom CRM", "Website Redesign", "Automation (n8n)", "Custom ERP", "Landing Page"];
const PEOPLE = ["Arjun Rao", "Sneha Iyer", "Vikram Shah", "Ananya Gupta", "Rahul Nair", "Meera Joshi", "Kabir Singh", "Ishita Desai", "Daniel Brooks", "Emily Carter", "Sam Wilson", "Olivia Reed"];
const PROSPECTS = ["Northwind Media", "Lotus Wellness", "Indigo Apparel", "Peakline Studios", "Riverstone Homes", "Blue Ocean Travel", "Quantum Tutors", "Saffron Bistro", "Vertical Gardens", "Maple Dental", "Echo Podcasts", "Atlas Logistics", "Nova Fitness", "Crimson Films", "Bharat Exports", "Cityscape Realty", "Momentum Coaching"];

async function seed() {
  // 1. Companies
  const settings = companySettingsSchema.parse({});
  tables.company.push(
    { id: "vmh", code: "VMH", name: "Vertex Media House", tagline: "Video Editing", color: "#7231FB", invoicePrefix: "VMH", nextInvoiceNumber: 22, address: "Vertex Media House, Ahmedabad, Gujarat, India", gstin: "24ABCDE1234F1Z5", settings, bankDetails: { accountName: "Vertex Media House", upi: "vertexmedia@upi" }, createdAt: day(-500), updatedAt: day(-1) },
    { id: "vth", code: "VTH", name: "Vertex Tech House", tagline: "Web, CRM, ERP, Automation", color: "#00B675", invoicePrefix: "VTH", nextInvoiceNumber: 20, address: "Vertex Tech House, Ahmedabad, Gujarat, India", gstin: "24ABCDE1234F2Z4", settings, bankDetails: { accountName: "Vertex Tech House", upi: "vertextech@upi" }, createdAt: day(-500), updatedAt: day(-1) },
  );

  // 2. Users, Accounts, Memberships
  const hash = await hashPassword(process.env.SEED_PASSWORD || "vertex123");
  for (const t of F.TEAM) {
    const userId = uid(t.key);
    tables.user.push({
      id: userId,
      name: t.name,
      email: t.email,
      emailVerified: true,
      image: null,
      kind: "STAFF",
      isOwner: t.isOwner ?? false,
      title: t.title ?? null,
      timezone: "Asia/Kolkata",
      weeklyCapacityHours: 40,
      active: true,
      createdAt: day(-400),
      updatedAt: day(-1),
    });
    tables.account.push({
      id: `acc_${t.key}`,
      userId,
      accountId: userId,
      providerId: "credential",
      password: hash,
      accessToken: null,
      refreshToken: null,
      idToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      scope: null,
      createdAt: day(-400),
      updatedAt: day(-1),
    });
    for (const c of t.companies) {
      tables.membership.push({
        userId,
        companyId: coId(c),
        role: t.role,
        modules: [],
        createdAt: day(-400),
      });
    }
  }

  // 3. Clients
  type ClientRow = { id: string; name: string; companies: F.Co[] };
  const clientIds = new Map<string, ClientRow>();

  for (const c of F.CLIENTS) {
    const id = `client_${c.key}`;
    clientIds.set(c.key, { id, name: c.name, companies: c.companies });
    tables.client.push({
      id, name: c.name, domain: c.domain, logoUrl: null, type: c.type, status: c.status ?? "ACTIVE", ownerId: uid(c.owner),
      tags: c.tags ?? [], notes: c.notes ?? null, address: c.address ?? "Ahmedabad, Gujarat, India", gstin: null, currency: "INR",
      lastActivityAt: minutesAgo(c.lastActivity), archivedAt: null, createdAt: day(-(c.createdDaysAgo ?? r.int(60, 600))), updatedAt: day(-1),
    });
    c.companies.forEach((co) => tables.clientCompany.push({ clientId: id, companyId: coId(co), since: day(-60) }));
  }

  const statuses = [...Array(3).fill("ON_HOLD"), ...Array(6).fill("COMPLETED"), ...Array(3).fill("INACTIVE")];
  PADDED_CLIENT_NAMES.forEach((name, i) => {
    const co: F.Co = i % 2 === 0 && i < 50 ? "VMH" : "VTH";
    const key = slug(name);
    const id = `client_${key}`;
    clientIds.set(key, { id, name, companies: [co] });
    tables.client.push({
      id, name, domain: `${key.replace(/_/g, "")}.com`, logoUrl: null, type: r.pick(co === "VMH" ? VMH_TYPES : VTH_TYPES),
      status: (statuses[i] as "ON_HOLD" | "COMPLETED" | "INACTIVE" | undefined) ?? "ACTIVE",
      ownerId: uid(STAFF[i % STAFF.length]!), tags: [], notes: null, address: "India", gstin: null, currency: "INR",
      lastActivityAt: minutesAgo(r.int(1, 40) * 24 * 60), archivedAt: null, createdAt: day(i < 2 ? -r.int(4, 18) : -r.int(40, 700)), updatedAt: day(-1),
    });
    tables.clientCompany.push({ clientId: id, companyId: coId(co), since: day(-60) });
  });

  for (const [key, list] of Object.entries(F.CONTACTS)) {
    list.forEach((p, i) => tables.clientContact.push({ id: `contact_${key}_${i}`, clientId: `client_${key}`, ...p, isPrimary: p.isPrimary ?? false, portalAccess: false, userId: null, createdAt: day(-30) }));
  }
  for (const [key, c] of clientIds) {
    if (F.CONTACTS[key]) continue;
    const person = r.pick(PEOPLE);
    tables.clientContact.push({
      id: `contact_${key}_0`, clientId: c.id, name: person, title: `Founder, ${c.name}`, isPrimary: true,
      email: `${person.split(" ")[0]!.toLowerCase()}@${key.replace(/_/g, "")}.com`, phone: `+91 98${r.int(10000000, 99999999)}`,
      location: "IST (India)", timezone: "Asia/Kolkata", portalAccess: false, userId: null, createdAt: day(-30),
    });
  }

  // 4. Leads
  let position = 0;
  for (const l of F.LEADS) {
    const lastActivity = l.activityDaysAgo !== undefined ? day(-l.activityDaysAgo, "11:00") : day(-l.createdDaysAgo, "10:00");
    tables.lead.push({
      id: `lead_${slug(l.name)}`, companyId: coId(l.co), name: l.name, service: l.service, value: l.value, stage: l.stage,
      source: l.source, ownerId: uid(l.owner), clientId: l.client ? `client_${l.client}` : null, position: position++,
      contactName: r.pick(PEOPLE), email: `hello@${slug(l.name).replace(/_/g, "")}.com`, phone: null, notes: null,
      lastActivityAt: lastActivity, wonAt: l.stage === "WON" ? lastActivity : null, lostAt: null,
      createdAt: day(-l.createdDaysAgo, "10:00"), updatedAt: lastActivity,
    });
  }
  const vmhSources = ["FIVERR", "FIVERR", "FIVERR", "FIVERR", "INSTAGRAM", "OTHER", "OTHER", "EMAIL", "EMAIL", "EMAIL", "REFERRAL"] as const;
  const vthSources = ["WEBSITE", "WEBSITE", "REFERRAL", "REFERRAL", "LINKEDIN", "LINKEDIN"] as const;
  let vmhI = 0, vthI = 0, prospect = 0;
  for (const [stage, [count, total, vmhCount]] of Object.entries(F.HIDDEN_LEADS)) {
    const values = splitInto(total, count, 5000, r);
    for (let i = 0; i < count; i++) {
      const co: F.Co = i < vmhCount ? "VMH" : "VTH";
      const name = PROSPECTS[prospect++]!;
      const created = r.int(1, 20);
      tables.lead.push({
        id: `lead_${slug(name)}`, companyId: coId(co), name, service: r.pick(co === "VMH" ? VMH_TYPES : VTH_TYPES), value: values[i]!,
        stage: stage as F.LeadFx["stage"], source: co === "VMH" ? vmhSources[vmhI++]! : vthSources[vthI++]!,
        ownerId: uid(r.pick(STAFF)), position: position++, contactName: r.pick(PEOPLE),
        email: `contact@${slug(name).replace(/_/g, "")}.com`, phone: null, notes: null,
        lastActivityAt: day(-r.int(0, created), "12:00"), wonAt: null, lostAt: null, createdAt: day(-created, "10:00"), updatedAt: day(-1),
      });
    }
  }

  // 5. Projects
  const projectIds = new Map<string, { id: string; co: F.Co; client?: string; members: F.TeamKey[] }>();
  const all: F.ProjectFx[] = [...F.PROJECTS];
  const vmhPadClients = [...clientIds.entries()].filter(([k, c]) => !F.CLIENTS.some((f) => f.key === k) && c.companies[0] === "VMH");
  let padIdx = 0;
  for (const [status, count] of F.PADDED_VMH_PROJECTS) {
    for (let n = 0; n < count; n++, padIdx++) {
      const [key] = vmhPadClients[padIdx]!;
      const type = r.pick(VMH_TYPES);
      const done = status === "COMPLETED";
      all.push({
        key: `pad_${key}`, client: key, name: type, co: "VMH", status, progress: done ? 100 : status === "NOT_STARTED" ? 0 : r.int(25, 90),
        typeLabel: type, category: type === "Thumbnail Design" ? "DESIGN" : "VIDEO_EDITING", value: r.int(4, 12) * 5000,
        billing: "MONTHLY_RETAINER", start: done ? "2026-09-01" : "2026-10-01", due: done ? "2026-09-30" : "2026-11-15",
        completed: done ? "2026-09-29" : undefined, members: [r.pick(STAFF), r.pick(STAFF)].filter((v, idx, a) => a.indexOf(v) === idx),
      });
    }
  }

  for (const p of all) {
    const id = `project_${p.key}`;
    projectIds.set(p.key, { id, co: p.co, client: p.client, members: p.members });
    const client = F.CLIENTS.find((c) => c.key === p.client);
    tables.project.push({
      id, companyId: coId(p.co), clientId: `client_${p.client}`, name: p.name, typeLabel: p.typeLabel, category: p.category,
      template: p.co, status: p.status, priority: p.priority ?? "MEDIUM", value: p.value, billingType: p.billing,
      retainerHours: p.retainerHours ?? null, startDate: at(p.start), dueDate: at(p.due), completedAt: p.completed ? at(p.completed, "17:00") : null,
      progress: p.progress, summary: p.summary ?? `${p.typeLabel} for ${client?.name ?? clientIds.get(p.client)?.name}`,
      description: p.description ?? `${p.typeLabel} project for ${client?.name ?? clientIds.get(p.client)?.name}.`,
      createdAt: at(p.start, "08:00"), updatedAt: day(-1),
    });
    for (const m of p.members) {
      tables.projectMember.push({ projectId: id, userId: uid(m) });
    }
  }

  for (const [key, co, name] of [["vth_internal", "VTH", "System Setup"], ["vmh_internal", "VMH", "Operations"]] as const) {
    projectIds.set(key, { id: `project_${key}`, co, members: ["dhrumil"] });
    tables.project.push({
      id: `project_${key}`, companyId: coId(co), clientId: null, name, typeLabel: "Internal", category: "OTHER", template: co,
      status: "IN_PROGRESS", priority: "MEDIUM", value: 0, billingType: "TIME_AND_MATERIALS", retainerHours: null,
      startDate: at("2026-01-01"), dueDate: null, completedAt: null, progress: 50, summary: `${co} internal work`, description: `${co} internal work`,
      createdAt: at("2026-01-01"), updatedAt: day(-1),
    });
    for (const m of ["dhrumil", ...STAFF]) {
      tables.projectMember.push({ projectId: `project_${key}`, userId: uid(m as F.TeamKey) });
    }
  }

  // Deliverables, Milestones, Phases, Approvals, Bugs, SupportTickets
  const bright = "project_bright_labs_shorts";
  ["12 Edited YouTube Shorts (Monthly)", "12 Thumbnails", "Captions & Subtitles", "Background Music & SFX", "Final Files (1080x1920)"].forEach((title, order) => {
    tables.deliverable.push({ id: `deliv_${bright}_${order}`, projectId: bright, title, targetCount: 12, completedCount: 8, percent: null, cycleMonth: at("2026-10-01", "00:00"), order });
  });
  [["Project Started", "2026-10-01", "COMPLETED"], ["First Drafts", "2026-10-05", "COMPLETED"], ["Client Review", "2026-10-15", "COMPLETED"], ["Final Delivery", "2026-10-25", "PENDING"]].forEach(([label, date, status], order) => {
    tables.timelinePhase.push({ id: `phase_${bright}_${order}`, projectId: bright, label, date: at(date), status, order });
  });

  const gb = "project_greenbuild_crm";
  ([["CRM Module (Leads, Clients, Projects)", 100], ["User Roles & Permissions", 100], ["Email & Form Integrations", 80], ["Reporting Dashboard", 60], ["n8n Automation Workflows", 40], ["Testing & Deployment", 0], ["Training & Handover", 0]] as const).forEach(([title, percent], order) => {
    tables.deliverable.push({ id: `deliv_${gb}_${order}`, projectId: gb, title, targetCount: null, completedCount: null, percent, cycleMonth: null, order });
  });
  ([["Requirement Gathering", "2026-09-05", "COMPLETED"], ["UI/UX Design Approval", "2026-09-12", "COMPLETED"], ["Core CRM Development", "2026-09-28", "COMPLETED"], ["Integration Setup", "2026-10-10", "IN_PROGRESS"], ["Testing & QA", "2026-10-20", "PENDING"], ["Client Review", "2026-10-25", "PENDING"], ["Final Deployment", "2026-10-30", "PENDING"]] as const).forEach(([title, due, status], order) => {
    tables.milestone.push({ id: `ms_${gb}_${order}`, projectId: gb, title, dueDate: at(due), status, order });
  });
  ([["Start", "2026-09-01", "COMPLETED"], ["Requirements", "2026-09-05", "COMPLETED"], ["Design", "2026-09-12", "COMPLETED"], ["Development", "2026-09-28", "COMPLETED"], ["Integration", "2026-10-10", "IN_PROGRESS"], ["Testing", "2026-10-20", "PENDING"], ["Review", "2026-10-25", "PENDING"], ["Deployment", "2026-10-30", "PENDING"]] as const).forEach(([label, date, status], order) => {
    tables.timelinePhase.push({ id: `phase_${gb}_${order}`, projectId: gb, label, date: at(date), status, order });
  });

  const vthMilestones: [string, string, string, string][] = [
    ["rocco_web_crm", "Client UAT", "2026-10-23", "PENDING"],
    ["ashoka_website", "Homepage Development", "2026-10-24", "IN_PROGRESS"],
    ["nextgen_automation", "Workflow Handover", "2026-10-21", "PENDING"],
    ["vidhi_erp", "Requirements Sign-off", "2026-10-30", "PENDING"],
    ["elite_automation", "Dashboard Prototype", "2026-11-02", "PENDING"],
  ];
  vthMilestones.forEach(([p, title, due, status], order) => {
    tables.milestone.push({ id: `ms_${p}_${order}`, projectId: `project_${p}`, title, dueDate: at(due), status, order });
  });

  for (const [key, p] of projectIds) {
    if (key === "bright_labs_shorts" || key === "greenbuild_crm" || key.endsWith("_internal")) continue;
    const fx = all.find((x) => x.key === key)!;
    if (p.co === "VMH") {
      tables.deliverable.push({ id: `deliv_${p.id}_0`, projectId: p.id, title: `${fx.typeLabel} deliverables`, targetCount: 8, completedCount: Math.round((fx.progress / 100) * 8), percent: null, cycleMonth: null, order: 0 });
    } else {
      tables.deliverable.push(
        { id: `deliv_${p.id}_0`, projectId: p.id, title: "Design", targetCount: null, completedCount: null, percent: Math.min(100, fx.progress + 30), cycleMonth: null, order: 0 },
        { id: `deliv_${p.id}_1`, projectId: p.id, title: "Development", targetCount: null, completedCount: null, percent: fx.progress, cycleMonth: null, order: 1 },
      );
    }
  }

  F.BRIGHT_APPROVALS.forEach(([title, status, date], i) => {
    tables.approval.push({
      id: `appr_bright_${i}`, projectId: bright, title, fileId: null, status, requestedAt: at(date, "09:00"),
      respondedAt: status === "PENDING" ? null : at(date, "15:00"), respondedByContactId: status === "PENDING" ? null : "contact_bright_labs_0",
      comment: status === "REVISION" ? "Please tighten the intro and use the new logo." : null,
    });
  });
  F.APPROVALS_WAITING.forEach(([p, title, days], i) => {
    tables.approval.push({
      id: `appr_waiting_${i}`, projectId: `project_${p}`, title, fileId: null, status: "PENDING", requestedAt: minutesAgo(days * 24 * 60 + 30),
      respondedAt: null, respondedByContactId: null, comment: null,
    });
  });

  [["greenbuild_crm", "Lead import skips rows with empty phone", "HIGH"], ["rocco_web_crm", "Contact form email not sent on Safari", "MEDIUM"], ["ashoka_website", "Hero image stretched on tablets", "LOW"], ["durrell_crm", "Rent reminder sent twice", "MEDIUM"]].forEach(
    ([p, title, severity], i) => {
      tables.bug.push({ id: `bug_${i}`, projectId: `project_${p}`, title, severity, status: i === 3 ? "RESOLVED" : "OPEN", createdAt: day(-(i + 2)), resolvedAt: i === 3 ? day(-1) : null });
    },
  );
  const ticketClients = ["greenbuild_infra", "rocco_construction", "durrell_properties", "ashoka_buildcon", "nextgen_agency", "scaleup_co", "urban_living", "vidhi_enterprise"];
  ticketClients.forEach((c, i) => {
    tables.supportTicket.push({
      id: `ticket_${i}`, clientId: `client_${c}`, projectId: null, title: ["Add a new user", "Change dashboard colours", "Export not downloading", "Update office address", "Workflow failed overnight", "Reset admin password", "Add WhatsApp button", "Invoice template tweak"][i]!,
      status: i === 7 ? "RESOLVED" : "OPEN", createdAt: day(-(i + 1)), resolvedAt: i === 7 ? day(-1) : null,
    });
  });

  // 6. Tasks
  const taskIds = new Map<string, string>();
  const counts = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, CLIENT_REVIEW: 0, COMPLETED: 0 };
  const weekStart = startOfWeekIST(NOW);

  const pushTask = (t: F.TaskFx, pos: number) => {
    const id = `task_${slug(t.title)}`;
    taskIds.set(t.title, id);
    counts[t.status]++;
    const due = at(t.due, "18:00");
    const done = t.status === "COMPLETED";
    const completedAt = done ? (due < weekStart ? due : new Date(Math.min(NOW.getTime() - 3600_000, Math.max(weekStart.getTime() + 3600_000, due.getTime())))) : null;
    const delivered = t.stage === "DELIVERED" ? completedAt : null;
    tables.task.push({
      id, companyId: coId(t.co), projectId: `project_${t.project}`, title: t.title, description: `${t.title} for ${clientIds.get(t.client)?.name}.`,
      status: t.status, priority: t.priority, assigneeId: uid(t.assignee), createdById: uid("dhrumil"), reviewFromId: null,
      startDate: addDays(due, -3), dueDate: due, completedAt, estimatedMinutes: null, progress: t.progress ?? (done ? 100 : 0),
      position: pos, tags: [], parentId: null, productionStage: t.stage ?? null,
      deliveredAt: delivered, editingStartedAt: t.stage ? addDays(delivered ?? due, -(r.int(20, 36) / 24)) : null,
      createdAt: addDays(due, -5), updatedAt: day(-1),
    });
  };
  F.TASKS.forEach((t, i) => pushTask(t, i));

  const fillers: Record<keyof typeof counts, string[]> = {
    TODO: ["Draft Script Outline", "Collect Brand Assets", "Plan Content Calendar", "Set Up Staging Server", "Write Test Cases"],
    IN_PROGRESS: ["Color Grade Episode 4", "Edit Reel #7", "Sound Design - Teaser", "Build Contact Form", "API Rate Limiting", "Dashboard Charts", "Edit Short #6", "Caption Pass - Batch 3", "Payment Gateway Setup", "Mobile Menu Fixes"],
    IN_REVIEW: ["Thumbnail A/B Set", "Checkout Flow QA", "Podcast Intro Mix"],
    CLIENT_REVIEW: ["Reel #5 for Approval", "Homepage Copy Review", "Short #4 for Approval", "ERP Wireframes Review", "Episode 3 Rough Cut", "Automation Demo"],
    COMPLETED: ["Short #1 Delivered", "Logo Animation Delivered", "Staging Deployed", "Reel #4 Delivered", "Email Templates Done", "Podcast Episode #10", "Edit Short #7", "Edit Short #8", "Edit Short #9", "Thumbnail Pack Delivered", "Database Backup Setup"],
  };
  const vmhProjects = [...projectIds.entries()].filter(([k, p]) => p.co === "VMH" && !k.endsWith("_internal") && p.client);
  const vthProjects = [...projectIds.entries()].filter(([k, p]) => p.co === "VTH" && !k.endsWith("_internal") && p.client);
  const isVmhTitle = (t: string) => /short|reel|thumbnail|podcast|episode|edit|caption|color|sound|logo|script|content|brand/i.test(t);
  let dueToday = 4;
  let taskPosition = 100;

  for (const status of Object.keys(fillers) as (keyof typeof counts)[]) {
    const titles = [...fillers[status]];
    while (counts[status] < F.BOARD_COUNTS[status]) {
      const title = titles.shift()!;
      const co: F.Co = isVmhTitle(title) ? "VMH" : "VTH";
      const project = /Edit Short #[7-9]|Short #1 Delivered/.test(title)
        ? "bright_labs_shorts"
        : /Write Test Cases|API Rate Limiting|Dashboard Charts/.test(title)
          ? "greenbuild_crm"
          : r.pick(co === "VMH" ? vmhProjects : vthProjects)[0];
      const pr = projectIds.get(project)!;
      const done = status === "COMPLETED";
      const dueDay = done ? r.int(-3, 0) : status !== "TODO" && dueToday-- > 0 ? 0 : r.int(1, 12);
      const staff = pr.members.filter((m) => m !== "dhrumil");
      pushTask(
        {
          title, client: pr.client!, project, co: pr.co, status, priority: r.pick(["LOW", "MEDIUM", "MEDIUM", "HIGH"] as const),
          due: shiftDate("2026-10-22", dueDay),
          progress: done || status === "CLIENT_REVIEW" ? 100 : status === "TODO" ? 0 : r.int(20, 90), assignee: r.pick(staff.length ? staff : STAFF),
          stage: pr.co === "VMH" ? ({ TODO: undefined, IN_PROGRESS: "EDITING", IN_REVIEW: "INTERNAL_QC", CLIENT_REVIEW: "CLIENT_REVIEW", COMPLETED: "DELIVERED" } as const)[status] : undefined,
        },
        taskPosition++,
      );
    }
  }

  // Task estimates
  for (const [who, total] of Object.entries(F.WEEK_PLANNED_MIN) as [F.TeamKey, number][]) {
    const open = tables.task.filter((t) => t.assigneeId === uid(who) && t.status !== "COMPLETED" && new Date(t.dueDate) >= weekStart && new Date(t.dueDate) < addDays(weekStart, 7));
    if (open.length) {
      const est = Math.round(total / open.length);
      open.forEach((t) => { t.estimatedMinutes = est; });
    }
  }

  // Drawer task details
  const drawer = taskIds.get(F.DRAWER_TASK.title)!;
  const drawerTask = tables.task.find((t) => t.id === drawer);
  if (drawerTask) {
    drawerTask.startDate = at(F.DRAWER_TASK.start);
    drawerTask.tags = F.DRAWER_TASK.tags;
    drawerTask.description = F.DRAWER_TASK.description;
    const doneItems = F.DRAWER_TASK.checklist.filter((c) => c[1]).length;
    drawerTask.progress = Math.round((doneItems / F.DRAWER_TASK.checklist.length) * 100);
  }
  F.DRAWER_TASK.checklist.forEach(([text, done, who], order) => {
    tables.checklistItem.push({ id: `cl_${drawer}_${order}`, taskId: drawer, text, done, assigneeId: uid(who), order });
  });
  F.DRAWER_TASK.comments.forEach(([who, date, time, body], i) => {
    tables.comment.push({
      id: `comm_${drawer}_${i}`, entityType: "TASK", entityId: drawer, authorId: uid(who), body, mentions: body.includes("@Hardik") ? [uid("hardik")] : [],
      createdAt: at(date, time),
    });
  });

  // 7. Time entries
  const left = structuredClone(F.TIME_BUCKETS);
  const occ = new Map<string, [number, number][]>();
  const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
  const WEEK_START = "2026-10-19";
  const weekUsed: Partial<Record<F.TeamKey, number>> = {};
  let timeId = 0;

  const addTime = (who: F.TeamKey, project: string, date: string, start: string, minutes: number, billable: boolean, note: string, taskId?: string) => {
    const p = projectIds.get(project)!;
    const k = `${who}|${date}`;
    (occ.get(k) ?? occ.set(k, []).get(k)!).push([toMin(start), toMin(start) + minutes]);
    if (date >= WEEK_START) weekUsed[who] = (weekUsed[who] ?? 0) + minutes;
    const s = at(date, start);
    const recent = s >= weekStart;
    tables.timeEntry.push({
      id: `time_${timeId++}`, userId: uid(who), companyId: coId(p.co), projectId: p.id, taskId: taskId ?? null,
      start: s, end: new Date(s.getTime() + minutes * 60_000), durationMin: minutes, note, billable,
      status: billable && recent && r.next() < 0.5 ? "PENDING" : "APPROVED",
      category: !billable && project.endsWith("_internal") && note.toLowerCase().includes("meeting") ? "MEETINGS" : null,
      manual: false, approvedById: billable && recent ? null : uid("dhrumil"), invoiceId: null,
      createdAt: s, updatedAt: s,
    });
    const bucket = `${p.co}_${billable ? "B" : "N"}` as keyof (typeof left)["hardik"];
    left[who][bucket] -= minutes;
  };

  for (const t of F.TIME_ROWS) {
    const [sh, sm] = t.start.split(":").map(Number);
    const [eh, em] = t.end.split(":").map(Number);
    addTime(t.who, t.project, t.date, t.start, eh! * 60 + em! - (sh! * 60 + sm!), t.billable, t.task, taskIds.get(t.task));
  }
  addTime("hardik", "bright_labs_shorts", "2026-10-19", "10:00", 90, true, "Rough cut + captions", taskIds.get(F.DRAWER_TASK.title));
  addTime("hardik", "bright_labs_shorts", "2026-10-21", "10:00", 60, true, "Music and brand pass", taskIds.get(F.DRAWER_TASK.title));

  const gbPlan: [F.TeamKey, boolean, number][] = [["sheen", true, 800 - 90], ["hardik", true, 650], ["dhrumil", false, 255]];
  const days = weekdays("2026-10-01", "2026-10-21");
  const placeTime = (who: F.TeamKey, minutes: number) => {
    const week = days.filter((d) => d >= WEEK_START);
    const earlier = days.filter((d) => d < WEEK_START).reverse();
    const order = (weekUsed[who] ?? 0) + minutes <= F.WEEK_TARGET_MIN[who] ? [...week, ...earlier] : earlier;
    for (const date of order) {
      const busy = occ.get(`${who}|${date}`) ?? [];
      for (let m = 8 * 60 + 30; m + minutes <= 20 * 60 + 30; m += 15) {
        if (busy.some(([a, b]) => m < b + 15 && a < m + minutes + 15)) continue;
        return { date, start: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}` };
      }
    }
    return { date: "2026-10-15", start: "09:00" };
  };

  for (const [who, billable, minutes] of gbPlan) {
    for (const chunk of splitTotal(minutes, 60, 180, 15, r)) {
      const { date, start } = placeTime(who, chunk);
      addTime(who, "greenbuild_crm", date, start, chunk, billable, billable ? r.pick(["CRM development", "API work", "UI build", "Bug fixes"]) : "Client meeting");
    }
  }

  for (const who of Object.keys(left) as F.TeamKey[]) {
    for (const bucket of ["VMH_B", "VMH_N", "VTH_B", "VTH_N"] as const) {
      const co = bucket.slice(0, 3) as F.Co;
      const billable = bucket.endsWith("_B");
      const options = [...projectIds.entries()]
        .filter(([k, p]) => p.co === co && (billable ? !k.endsWith("_internal") && k !== "greenbuild_crm" && (p.members.includes(who) || who === "dhrumil") : k.endsWith("_internal")))
        .map(([k]) => k);
      if (left[who][bucket] <= 0) continue;
      for (const chunk of splitTotal(left[who][bucket], 45, 180, 15, r)) {
        const { date, start } = placeTime(who, chunk);
        const project = r.pick(options.length ? options : [`${co.toLowerCase()}_internal`]);
        addTime(who, project, date, start, chunk, billable, billable ? r.pick(["Editing", "Revisions", "Development", "Design", "QA"]) : r.pick(["Team meeting", "Internal planning", "Tooling", "Client meeting"]));
      }
    }
  }

  // 8. Invoices
  const fixtures = [...F.INVOICES];
  const vmhPad = [...clientIds.entries()].filter(([, c]) => c.companies.includes("VMH")).map(([k]) => k);
  const vthPad = [...clientIds.entries()].filter(([, c]) => c.companies.includes("VTH")).map(([k]) => k);
  const padInv = (co: F.Co, n: number, issue: string): F.InvoiceFx => {
    const client = co === "VMH" ? vmhPad[(n * 7) % vmhPad.length]! : vthPad[(n * 5) % vthPad.length]!;
    const project = [...projectIds.entries()].find(([k, p]) => p.client === client && p.co === co && !k.endsWith("_internal"))?.[0] ?? `${co.toLowerCase()}_internal`;
    return { number: `${co}-${String(n).padStart(3, "0")}`, client, project, issue, due: shiftDate(issue, 15), amount: co === "VMH" ? r.int(6, 40) * 1000 : r.int(5, 20) * 10000, paidPct: 100 };
  };
  for (let n = 1; n <= 16; n++) fixtures.push(padInv("VMH", n, shiftDate("2026-06-01", Math.round((n - 1) * 7.5))));
  for (let n = 1; n <= 14; n++) fixtures.push(padInv("VTH", n, shiftDate("2026-06-05", (n - 1) * 8)));
  const tweak = (num: string, patch: Partial<F.InvoiceFx>) => Object.assign(fixtures.find((f) => f.number === num)!, patch);
  tweak("VTH-013", { client: "bright_labs", project: "bright_labs_website", issue: "2026-09-15", due: "2026-09-30", amount: 120000 });
  tweak("VMH-016", { draft: true, paidPct: 0 });
  tweak("VTH-014", { draft: true, paidPct: 0 });
  tweak("VTH-012", { paidPct: 0 });
  tweak("VMH-014", { paidPct: 0 });
  tweak("VTH-010", { due: "2026-11-05", paidPct: 0 });
  tweak("VMH-015", { due: "2026-10-30", paidPct: 0 });
  tweak("VMH-013", { due: "2026-10-25", paidPct: 0 });

  for (const f of fixtures) {
    const co = f.number.slice(0, 3) as F.Co;
    const seq = Number(f.number.slice(4));
    const issue = at(f.issue, "10:00");
    const due = at(f.due, "18:00");
    const paid = Math.round((f.amount * f.paidPct) / 100);
    const lines = f.number === "VTH-019" ? F.VTH019_LINES : ([[F.PROJECTS.find((p) => p.key === f.project)?.typeLabel ?? "Professional services", 1, f.amount]] as [string, number, number][]);
    const status = invoiceStatus({ current: f.draft ? "DRAFT" : "PENDING", total: f.amount, paid, dueDate: due, now: NOW });
    const id = `invoice_${f.number.toLowerCase().replace("-", "_")}`;
    const payDate = f.number === "VTH-013" ? minutesAgo(60) : new Date(Math.min(NOW.getTime() - 86_400_000, addDays(issue, r.int(2, 10)).getTime()));

    tables.invoice.push({
      id, companyId: coId(co), number: f.number, seq, clientId: `client_${f.client}`, projectId: projectIds.get(f.project)?.id ?? null,
      issueDate: issue, dueDate: due, currency: "INR", subtotal: f.amount, taxRate: 0, taxAmount: 0, discount: 0, total: f.amount,
      paidAmount: paid, status, notes: `Thank you for your business. Payment is due by ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(due)}.`,
      sentAt: f.draft ? null : issue, pdfFileId: null, createdAt: issue, updatedAt: day(-1),
    });

    lines.forEach(([description, qty, rate], order) => {
      tables.invoiceLineItem.push({ id: `item_${id}_${order}`, invoiceId: id, description, qty, rate, amount: qty * rate, order });
    });

    if (paid > 0) {
      tables.payment.push({
        id: `pay_${id}`, invoiceId: id, amount: paid, date: payDate,
        method: co === "VTH" && f.number !== "VTH-013" ? "BANK_TRANSFER" : r.pick(["UPI", "BANK_TRANSFER", "WISE", "PAYPAL"] as const),
        reference: `TXN${r.int(100000, 999999)}`, createdById: uid("dhrumil"), createdAt: payDate,
      });
    }
  }

  ["Sent to Raj with the CRM milestone summary.", "Raj confirmed ₹1,00,000 advance via bank transfer.", "Balance due after training & handover.", "Reminder scheduled for 30 Oct.", "Client asked for GST invoice copy, attached."].forEach((body, i) => {
    tables.comment.push({
      id: `comm_inv_vth_019_${i}`, entityType: "INVOICE", entityId: "invoice_vth_019", authorId: uid(i % 2 ? "sheen" : "dhrumil"), body, mentions: [], createdAt: at("2026-10-18", `1${i}:00`),
    });
  });

  // 9. Goals
  const thresholds = companySettingsSchema.parse({}).goalThresholds;
  for (const g of F.GOALS) {
    const start = at(g.start, "00:00");
    const end = at(g.end, "23:59");
    const prog = goalProgress({ startValue: 0, currentValue: g.current, targetValue: g.target });
    const goalId = `goal_${g.key}`;
    tables.goal.push({
      id: goalId, companyId: g.co ? coId(g.co) : null, scope: g.scope, title: g.title, subtitle: g.subtitle ?? null,
      description: g.description ?? g.subtitle ?? null, category: g.category, metricType: "MANUAL", unit: g.unit,
      startValue: 0, currentValue: g.current, targetValue: g.target, startDate: start, endDate: end, ownerId: uid(g.owner),
      status: goalStatus({ progress: prog, startDate: start, endDate: end, now: NOW, thresholds }),
      icon: g.icon ?? null, createdAt: start, updatedAt: day(-1),
    });
    if (g.members) {
      g.members.forEach((m) => tables.goalMember.push({ goalId, userId: uid(m) }));
    }
  }
  F.VTH_REVENUE_MILESTONES.forEach(([title, date, done], order) => {
    tables.goalMilestone.push({ id: `gm_vth_${order}`, goalId: "goal_vth_monthly_revenue", title, date: at(date), done, order });
  });

  // 10. Folders & Files
  const folderRoot = (category: string, name: string, color: string) => ({ id: `folder_${category.toLowerCase()}`, parentId: null, name, category, companyId: null, clientId: null, projectId: null, color, deletedAt: null });
  const FOLDER_ROOTS = [
    folderRoot("CLIENT_FILES", "Client Files", "#007AFF"), folderRoot("PROJECT_FILES", "Project Files", "#5856D6"), folderRoot("DESIGN_ASSETS", "Design Assets", "#FF4D31"),
    folderRoot("VIDEO_ASSETS", "Video Assets", "#FF9500"), folderRoot("DOCUMENTS", "Documents", "#34C759"), folderRoot("TEAM_RESOURCES", "Team Resources", "#8E8E93"),
  ];
  const modified: Record<string, string> = { CLIENT_FILES: "2026-10-20", PROJECT_FILES: "2026-10-18", DESIGN_ASSETS: "2026-10-15", VIDEO_ASSETS: "2026-10-12", DOCUMENTS: "2026-10-10", TEAM_RESOURCES: "2026-09-30" };
  FOLDER_ROOTS.forEach((f) => tables.folder.push({ ...f, createdAt: day(-300), updatedAt: at(modified[f.category]!) }));

  const clientFolderKeys = ["bright_labs", "greenbuild_infra", "elite_creators", "rocco_construction", "scaleup_co", "ashoka_buildcon", "flow_marketing", "urban_living", "nextgen_agency", "durrell_properties", "bhaumik_podcast", "fit_life_media", "creative_studio"];
  const clientColors = ["#A78BFA", "#F472B6", "#F9A8D4", "#FDBA74", "#FCD34D"];
  clientFolderKeys.forEach((k, i) => tables.folder.push({ id: `folder_client_${k}`, parentId: "folder_client_files", name: clientIds.get(k)!.name, category: "CLIENT_FILES", companyId: null, clientId: `client_${k}`, projectId: null, color: clientColors[i % 5] ?? "#93C5FD", deletedAt: null, createdAt: day(-200), updatedAt: day(-1) }));

  const projectFolders = ["Website Development", "CRM Development", "Video Editing", "Automation (n8n)", "ERP Development", "Thumbnails", "Podcasts", "Reels", "Landing Pages", "Dashboards"];
  projectFolders.forEach((name, i) => tables.folder.push({ id: `folder_project_${slug(name)}`, parentId: "folder_project_files", name, category: "PROJECT_FILES", companyId: null, clientId: null, projectId: null, color: ["#A855F7", "#3B82F6", "#93C5FD", "#93C5FD"][i] ?? "#93C5FD", deletedAt: null, createdAt: day(-200), updatedAt: day(-1) }));

  const subs: [string, string[]][] = [
    ["DESIGN_ASSETS", ["Logos", "Brand Kits", "UI Kits", "Icons", "Mockups", "Fonts", "Illustrations", "Presentations"]],
    ["VIDEO_ASSETS", ["Raw Footage", "Music", "SFX", "LUTs", "Templates", "Stock"]],
    ["DOCUMENTS", ["Contracts", "Proposals", "Invoices", "SOPs", "Briefs", "Reports", "NDAs", "Meeting Notes", "Requirements", "Handover"]],
    ["TEAM_RESOURCES", ["Style Guides", "Onboarding", "Templates"]],
  ];
  for (const [category, names] of subs) {
    names.forEach((name) => tables.folder.push({ id: `folder_${category.toLowerCase()}_${slug(name)}`, parentId: `folder_${category.toLowerCase()}`, name, category, companyId: null, clientId: null, projectId: null, color: null, deletedAt: null, createdAt: day(-200), updatedAt: day(-1) }));
  }

  const folderFor = (key: string) =>
    key.startsWith("client:") ? `folder_client_${key.slice(7)}` : key === "design" ? "folder_design_assets_mockups" : key === "video" ? "folder_video_assets_templates" : key === "documents" ? "folder_documents_meeting_notes" : key === "project:crm" ? "folder_project_crm_development" : "folder_project_automation_n8n";
  const mimeOf = (ext: string) => ({ pdf: "application/pdf", fig: "application/x-figma", mp4: "video/mp4", png: "image/png", jpg: "image/jpeg", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ai: "application/postscript", psd: "image/vnd.adobe.photoshop", json: "application/json", srt: "application/x-subrip", mp3: "audio/mpeg", mov: "video/quicktime", zip: "application/zip" })[ext] ?? "application/octet-stream";

  F.FILE_ROWS.forEach((f, i) => {
    const ext = f.name.split(".").pop()!.toLowerCase();
    const id = i === 0 ? "file_project_brief" : `file_${slug(f.name)}`;
    const project = f.project ? projectIds.get(f.project) : undefined;
    tables.file.push({
      id, folderId: folderFor(f.folder), name: f.name, mime: mimeOf(ext), ext: ext.toUpperCase(), size: Math.round(f.size), storageKey: `seed/${id}/${f.name}`,
      version: 1, companyId: project ? coId(project.co) : null, clientId: f.client ? `client_${f.client}` : project?.client ? `client_${project.client}` : null,
      projectId: project?.id ?? null, taskId: null, uploadedById: uid(i === 0 ? "dhrumil" : r.pick(STAFF)), status: f.status, tags: f.tags ?? [], description: f.description ?? null,
      starred: false, sharedWithPortal: f.status === "FINAL", deletedAt: null, createdAt: at(f.modified, "10:30"), updatedAt: at(f.modified, "10:30"),
    });
  });

  F.DRAWER_TASK.files.forEach(([name, size, mime], i) => {
    tables.file.push({
      id: `file_task_${i}`, folderId: "folder_client_bright_labs", name, mime, ext: name.split(".").pop()!.toUpperCase(), size, storageKey: `seed/file_task_${i}/${name}`,
      version: 1, companyId: "vmh", clientId: "client_bright_labs", projectId: "project_bright_labs_shorts", taskId: taskIds.get(F.DRAWER_TASK.title) ?? null,
      uploadedById: uid("hardik"), status: null, tags: [], description: null, starred: false, sharedWithPortal: false, deletedAt: null,
      createdAt: at("2026-10-18", "14:00"), updatedAt: at("2026-10-18", "14:00"),
    });
  });

  const extByCat: Record<string, string[]> = { CLIENT_FILES: ["pdf", "docx", "png", "mp4", "jpg"], PROJECT_FILES: ["fig", "pdf", "png", "json", "xlsx", "mp4"], DESIGN_ASSETS: ["png", "ai", "psd", "fig", "jpg"], VIDEO_ASSETS: ["mp4", "mov", "mp3", "zip"], DOCUMENTS: ["pdf", "docx", "xlsx"] };
  const existingFiles = (cat: string) => tables.file.filter((f) => tables.folder.find((x) => x.id === f.folderId)?.category === cat).length;
  for (const [cat, , total] of F.FILE_CATEGORY_COUNTS) {
    const targets = tables.folder.filter((f) => f.category === cat).map((f) => f.id!);
    for (let i = existingFiles(cat); i < total; i++) {
      const ext = r.pick(extByCat[cat]!);
      const folderId = r.pick(targets);
      const name = `${cat === "VIDEO_ASSETS" ? "Clip" : cat === "DOCUMENTS" ? "Document" : cat === "DESIGN_ASSETS" ? "Asset" : "File"}_${String(i + 1).padStart(3, "0")}.${ext}`;
      const when = day(-r.int(11, 200));
      tables.file.push({
        id: `file_${cat.toLowerCase()}_${i}`, folderId, name, mime: mimeOf(ext), ext: ext.toUpperCase(),
        size: ext === "mp4" || ext === "mov" ? r.int(20, 900) * 1024 * 1024 : r.int(40, 9000) * 1024,
        storageKey: `seed/${cat}/${name}`, version: 1, companyId: null, clientId: null, projectId: null, taskId: null,
        uploadedById: uid(r.pick(STAFF)), status: null, tags: [], description: null, starred: false, sharedWithPortal: false, deletedAt: null,
        createdAt: when, updatedAt: when,
      });
    }
  }

  F.FILE_ROWS.slice(0, 9).forEach((f, i) => {
    const id = i === 0 ? "file_project_brief" : `file_${slug(f.name)}`;
    const people = i === 0 ? ["sheen", "hardik"] : STAFF.slice(0, (i % 3) + 1);
    people.forEach((p, idx) => tables.fileShare.push({ id: `share_${id}_${idx}`, fileId: id, userId: uid(p as F.TeamKey), clientContactId: null }));
  });
  [1, 2].forEach((v) => {
    tables.fileVersion.push({ id: `ver_brief_${v}`, fileId: "file_project_brief", version: v, storageKey: `seed/file_project_brief/v${v}`, size: 2.3 * 1024 * 1024 + v * 50_000, uploadedById: uid("dhrumil"), createdAt: at("2026-10-1" + (v + 7), "10:30") });
  });
  const briefFile = tables.file.find((f) => f.id === "file_project_brief");
  if (briefFile) briefFile.version = 2;

  // 11. Campaigns, Agenda, Activity, Notifications, Tags
  for (const [i, c] of F.CAMPAIGNS.entries()) {
    const campId = `campaign_${i + 1}`;
    tables.emailCampaign.push({
      id: campId, companyId: c.co ? coId(c.co) : null, name: c.name, status: "ACTIVE", subject: c.subject,
      sentCount: c.sent, openCount: Math.round((c.sent * c.openPct) / 100), replyCount: Math.round((c.sent * c.replyPct) / 100), meetingsCount: c.meetings,
      audienceFilter: { companies: c.co ? [c.co] : ["VMH", "VTH"], stages: ["NEW", "CONTACTED"] },
      steps: [{ subject: c.subject, body: "Hi {{firstName}},\n\n…", delayDays: 0 }, { subject: `Re: ${c.subject}`, body: "Just following up, {{firstName}}.", delayDays: 3 }],
      scheduledAt: null, createdAt: day(-20 + i * 3), updatedAt: day(-1),
    });
    PROSPECTS.slice(i * 4, i * 4 + 4).forEach((name, n) => {
      tables.campaignRecipient.push({
        id: `recip_${campId}_${n}`, campaignId: campId, email: `hello@${slug(name).replace(/_/g, "")}.com`, name,
        leadId: null, clientId: null, status: (["SENT", "OPENED", "REPLIED", "OPENED"] as const)[n]!, step: 0,
        sentAt: day(-5), openedAt: n ? day(-4) : null, repliedAt: n === 2 ? day(-3) : null, meetingBookedAt: null,
      });
    });
  }

  F.AGENDA.forEach((e, i) => {
    const start = at("2026-10-22", e.time);
    tables.calendarEvent.push({
      id: `event_${i}`, title: e.title, type: e.type, companyId: e.co ? coId(e.co) : null, start, end: new Date(start.getTime() + e.minutes * 60_000),
      clientId: e.client ? `client_${e.client}` : null, leadId: null, projectId: e.project ? `project_${e.project}` : null, attendeeIds: [uid("dhrumil"), uid("hardik")],
      createdAt: day(-10),
    });
  });
  const sprintStart = at("2026-10-23", "11:00");
  tables.calendarEvent.push({
    id: "event_sprint_gb", title: "Sprint Planning - GreenBuild", type: "MEETING", companyId: "vth", start: sprintStart, end: at("2026-10-23", "12:00"),
    clientId: null, leadId: null, projectId: "project_greenbuild_crm", attendeeIds: [uid("sheen"), uid("sheen")], createdAt: day(-5),
  });
  const reviewStart = at("2026-10-23", "15:00");
  tables.calendarEvent.push({
    id: "event_content_elite", title: "Content Review - Elite Creators", type: "REVIEW", companyId: "vmh", start: reviewStart, end: at("2026-10-23", "15:30"),
    clientId: "client_elite_creators", leadId: null, projectId: null, attendeeIds: [uid("hardik")], createdAt: day(-5),
  });

  const sampleActivities = [
    { companyId: "vmh", actorId: uid("sheen"), verb: "uploaded", entityType: "FILE", entityId: "file_short_01_final_mp4", summary: "Priya uploaded final video for Alex Johnson", meta: null, createdAt: minutesAgo(2) },
    { companyId: "vth", actorId: uid("hardik"), verb: "completed", entityType: "TASK", entityId: taskIds.get("Build Lead Module") ?? "task_1", summary: "Rohan marked task as completed", meta: null, createdAt: minutesAgo(15) },
    { companyId: "vth", actorId: null, verb: "paid", entityType: "PAYMENT", entityId: "invoice_vth_013", summary: "Payment received from Bright Labs (₹1,20,000)", meta: null, createdAt: minutesAgo(60) },
    { companyId: null, actorId: uid("dhrumil"), verb: "created", entityType: "LEAD", entityId: "lead_scaleup_co", summary: "New lead added: ScaleUp Co.", meta: null, createdAt: minutesAgo(120) },
    { companyId: "vth", actorId: uid("hardik"), verb: "updated", entityType: "GOAL", entityId: "goal_vth_monthly_revenue", summary: "Rohan updated progress to 75%", meta: null, createdAt: minutesAgo(125) },
    { companyId: "vth", actorId: uid("sheen"), verb: "completed", entityType: "GOAL", entityId: "goal_vth_monthly_revenue", summary: "Priya marked milestone as completed", meta: null, createdAt: minutesAgo(300) },
    { companyId: "vth", actorId: uid("hardik"), verb: "commented", entityType: "GOAL", entityId: "goal_vth_monthly_revenue", summary: "Aman added a new comment", meta: null, createdAt: at("2026-10-18", "10:30") },
    { companyId: "vth", actorId: uid("sheen"), verb: "status", entityType: "GOAL", entityId: "goal_vth_monthly_revenue", summary: "Neha changed status to On Track", meta: null, createdAt: at("2026-10-17", "16:15") },
    { companyId: "vmh", actorId: uid("hardik"), verb: "timer_started", entityType: "TIME_ENTRY", entityId: "edit_short_1", summary: "Rohan started tracking time", meta: { detail: "Edit Short #1 — Bright Labs" }, createdAt: at("2026-10-20", "10:00") },
    { companyId: "vth", actorId: uid("sheen"), verb: "timer_stopped", entityType: "TIME_ENTRY", entityId: "ui_design", summary: "Sheen stopped tracking time", meta: { detail: "UI Design — GreenBuild Infra" }, createdAt: at("2026-10-20", "13:15") },
    { companyId: "vmh", actorId: uid("hardik"), verb: "time_edited", entityType: "TIME_ENTRY", entityId: "episode_edit", summary: "Hardik edited time entry", meta: { detail: "Episode Edit — Bhaumik Podcast" }, createdAt: at("2026-10-19", "18:00") },
    { companyId: "vth", actorId: uid("sheen"), verb: "time_note", entityType: "TIME_ENTRY", entityId: "workflow_setup", summary: "Sheen added a note", meta: { detail: "“Completed workflow setup and tested.”" }, createdAt: at("2026-10-19", "17:45") },
    { companyId: "vmh", actorId: uid("hardik"), verb: "moved", entityType: "LEAD", entityId: "lead_elite_creators", summary: "Hardik moved Elite Creators to Negotiation", meta: null, createdAt: day(-1, "15:00") },
  ];
  sampleActivities.forEach((act, i) => tables.activity.push({ id: `act_${i}`, ...act }));

  [["hardik", "2026-10-21", "10:30", "Looks great! Can we make the caption bold?"], ["sheen", "2026-10-21", "11:15", "Sure, updating in next version."], ["dhrumil", "2026-10-20", "18:45", "Client approved Short #1. Moving to Short #2."]].forEach(([who, d, t, body], i) => {
    tables.comment.push({ id: `comm_proj_${i}`, entityType: "PROJECT", entityId: "project_bright_labs_shorts", authorId: uid(who as F.TeamKey), body, mentions: [], createdAt: at(d, t) });
  });

  [
    { userId: uid("dhrumil"), type: "approval", title: "Bright Labs approved Short #1", link: "/projects?id=project_bright_labs_shorts", createdAt: minutesAgo(30) },
    { userId: uid("dhrumil"), type: "invoice_paid", title: "Payment received: #VTH-013 (₹1,20,000)", link: "/invoices?id=invoice_vth_013", createdAt: minutesAgo(60) },
    { userId: uid("dhrumil"), type: "over_capacity", title: "Sheen is over capacity this week", link: "/team", createdAt: minutesAgo(180) },
    { userId: uid("dhrumil"), type: "lead_stage", title: "Elite Creators moved to Negotiation", link: "/leads", createdAt: day(-1), readAt: day(-1, "16:00") },
  ].forEach((n, i) => tables.notification.push({ id: `notif_${i}`, ...n, body: null, readAt: (n as any).readAt ?? null }));

  [["Editing", "#7C3AED"], ["Shorts", "#64748B"], ["YouTube", "#64748B"], ["Brief", "#2563EB"], ["Client", "#2563EB"], ["Website", "#2563EB"], ["retainer", "#047857"], ["product-launch", "#EA580C"], ["website", "#2563EB"], ["crm", "#2563EB"]].forEach(([name, color], i) => {
    tables.tag.push({ id: `tag_${i}`, name, color });
  });

  // 12. Cross-sell Alerts
  tables.crossSellAlert.push(
    { id: "alert_bright_labs", clientId: "client_bright_labs", fromCompanyId: "vmh", toCompanyId: "vth", rule: "vmh-keywords-to-vth", reason: "Might need a website or CRM based on recent conversations.", status: "OPEN", leadId: null, createdAt: day(-2), updatedAt: day(-2) },
    { id: "alert_alex_johnson", clientId: "client_alex_johnson", fromCompanyId: "vmh", toCompanyId: "vth", rule: "vmh-keywords-to-vth", reason: "Mentioned on our last call that their merch store needs a new website and a simple CRM.", status: "OPEN", leadId: null, createdAt: day(-1), updatedAt: day(-1) },
  );

  // 13. Content Items (for Content Planner)
  tables.contentItem.push(
    { id: "content_1", companyId: "vmh", title: "Top 5 Video Editing Trends in 2027", channel: "YOUTUBE", stage: "IDEA", ownerId: uid("sheen"), hook: "Why short form is dominating video strategy", notes: "Analyze TikTok & YouTube Shorts metrics", shootDate: day(2), publishDate: day(7), publishedAt: null, link: null, position: 0, createdAt: day(-3), updatedAt: day(-1) },
    { id: "content_2", companyId: "vmh", title: "Behind The Scenes: Color Grading Masterclass", channel: "INSTAGRAM", stage: "FILMING", ownerId: uid("hardik"), hook: "From LOG to cinematic in 60 seconds", notes: "Use DaVinci Resolve screenshots", shootDate: day(0), publishDate: day(4), publishedAt: null, link: null, position: 1, createdAt: day(-2), updatedAt: day(-1) },
    { id: "content_3", companyId: "vth", title: "Automating Lead Scoring with n8n", channel: "LINKEDIN", stage: "PUBLISHED", ownerId: uid("hardik"), hook: "Save 10 hours a week on CRM data entry", notes: "Include workflow architecture diagram", shootDate: day(-5), publishDate: day(-1), publishedAt: day(-1), link: "https://linkedin.com", position: 2, createdAt: day(-7), updatedAt: day(-1) },
  );

  // 14. Notes (for Dashboard notebook)
  tables.note.push(
    { id: "note_1", companyId: "vmh", authorId: uid("dhrumil"), title: "Q4 Video Target", body: "Focus on onboarding 5 new retainer clients for YouTube shorts.", pinned: true, createdAt: day(-10), updatedAt: day(-2) },
    { id: "note_2", companyId: "vth", authorId: uid("dhrumil"), title: "VTH Infrastructure", body: "Migrate client deployments to Cloudflare Workers and verify latency.", pinned: false, createdAt: day(-5), updatedAt: day(-1) },
  );

  // 15. Recurring Tasks
  tables.recurringTask.push(
    { id: "rec_1", companyId: "vmh", title: "Daily Cloud Video Project Backup", assigneeId: uid("sheen"), projectId: null, priority: "HIGH", estimatedMinutes: 30, weekdays: [1, 2, 3, 4, 5], active: true, lastRunOn: shiftDate("2026-10-22", 0), createdById: uid("dhrumil"), createdAt: day(-30), updatedAt: day(-1) },
    { id: "rec_2", companyId: "vth", title: "Weekly Client CRM Health Check", assigneeId: uid("hardik"), projectId: null, priority: "MEDIUM", estimatedMinutes: 60, weekdays: [1], active: true, lastRunOn: shiftDate("2026-10-22", -3), createdById: uid("dhrumil"), createdAt: day(-30), updatedAt: day(-1) },
  );

  // Write all tables
  for (const [model, rows] of Object.entries(tables)) {
    const filePath = path.join(outDir, `${model}.json`);
    fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), "utf8");
    console.log(`Wrote ${rows.length} rows to ${model}.json`);
  }
}

function shiftDate(pdfDate: string, days: number): string {
  const d = new Date(`${pdfDate}T00:00:00Z`);
  return new Date(d.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

seed().then(() => console.log("Mock data generation complete!")).catch(console.error);
