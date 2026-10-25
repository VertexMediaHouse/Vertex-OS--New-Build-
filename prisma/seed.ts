// Demo data that reproduces the design PDF. Run with `npm run db:seed` (wipes and refills
// the database in DATABASE_URL). Fixture rows: prisma/seed/fixtures.ts.
import "./seed/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { Prisma, PrismaClient } from "../lib/db/generated/client";
import { addDays, now, startOfDayIST, startOfWeekIST } from "../lib/clock";
import { goalProgress, goalStatus } from "../lib/metrics/goals";
import { invoiceStatus } from "../lib/invoices/status";
import { companySettingsSchema } from "../lib/settings";
import { runCrossSellRules } from "../lib/crosssell";
import * as F from "./seed/fixtures";
import { at, day, minutesAgo, rng, slug, splitInto, splitTotal, weekdays } from "./seed/util";

// The seed deletes everything first, so it only runs against a local database. NODE_ENV is
// usually unset in a terminal, so the host is what decides.
const dbHost = new URL(process.env.DATABASE_URL ?? "postgres://nowhere").hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(dbHost) && !process.argv.includes("--force")) {
  throw new Error(`Refusing to wipe the database at ${dbHost}: it isn't local. Pass --force if you really mean it.`);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const r = rng();
const coId = (c: F.Co) => c.toLowerCase();
const uid = (k: F.TeamKey) => `user_${k}`;
const NOW = now();
const TODAY = startOfDayIST(NOW);
const STAFF: F.TeamKey[] = ["sheen", "hardik"];

// Generated clients (page 4 says 68). Names are fictional.
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

async function wipe() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`truncate table ${tables.map((t) => `"${t.tablename}"`).join(", ")} cascade`);
}

async function companies() {
  const settings = companySettingsSchema.parse({});
  await db.company.createMany({
    data: [
      { id: "vmh", code: "VMH", name: "Vertex Media House", tagline: "Video Editing", color: "#7231FB", invoicePrefix: "VMH", nextInvoiceNumber: 22, address: "Vertex Media House, Ahmedabad, Gujarat, India", gstin: "24ABCDE1234F1Z5", settings, bankDetails: { accountName: "Vertex Media House", upi: "vertexmedia@upi" } },
      { id: "vth", code: "VTH", name: "Vertex Tech House", tagline: "Web, CRM, ERP, Automation", color: "#00B675", invoicePrefix: "VTH", nextInvoiceNumber: 20, address: "Vertex Tech House, Ahmedabad, Gujarat, India", gstin: "24ABCDE1234F2Z4", settings, bankDetails: { accountName: "Vertex Tech House", upi: "vertextech@upi" } },
    ],
  });
}

async function users() {
  const hash = await hashPassword(process.env.SEED_PASSWORD || "vertex123");
  for (const t of F.TEAM) {
    await db.user.create({
      data: {
        id: uid(t.key),
        name: t.name,
        email: t.email,
        emailVerified: true,
        isOwner: t.isOwner ?? false,
        title: t.title,
        weeklyCapacityHours: Math.round(F.WEEK_TARGET_MIN[t.key] / 60),
        createdAt: day(-400),
        accounts: { create: { id: `acc_${t.key}`, providerId: "credential", accountId: uid(t.key), password: hash } },
        memberships: { create: t.companies.map((c) => ({ companyId: coId(c), role: t.role })) },
      },
    });
  }
}

type ClientRow = { id: string; name: string; companies: F.Co[] };
const clientIds = new Map<string, ClientRow>();

async function clients() {
  const rows: Prisma.ClientCreateManyInput[] = [];
  const links: Prisma.ClientCompanyCreateManyInput[] = [];
  const contacts: Prisma.ClientContactCreateManyInput[] = [];

  for (const c of F.CLIENTS) {
    const id = `client_${c.key}`;
    clientIds.set(c.key, { id, name: c.name, companies: c.companies });
    rows.push({
      id, name: c.name, domain: c.domain, type: c.type, status: c.status ?? "ACTIVE", ownerId: uid(c.owner),
      tags: c.tags ?? [], notes: c.notes, address: c.address ?? "Ahmedabad, Gujarat, India",
      lastActivityAt: minutesAgo(c.lastActivity), createdAt: day(-(c.createdDaysAgo ?? r.int(60, 600))),
    });
    c.companies.forEach((co) => links.push({ clientId: id, companyId: coId(co) }));
  }

  // Padding: 25 VMH-only, 24 VTH-only. Status mix keeps the page-4 segment totals.
  const statuses = [...Array(3).fill("ON_HOLD"), ...Array(6).fill("COMPLETED"), ...Array(3).fill("INACTIVE")];
  PADDED_CLIENT_NAMES.forEach((name, i) => {
    const co: F.Co = i % 2 === 0 && i < 50 ? "VMH" : "VTH";
    const key = slug(name);
    const id = `client_${key}`;
    clientIds.set(key, { id, name, companies: [co] });
    rows.push({
      id, name, domain: `${key.replace(/_/g, "")}.com`, type: r.pick(co === "VMH" ? VMH_TYPES : VTH_TYPES),
      status: (statuses[i] as "ON_HOLD" | "COMPLETED" | "INACTIVE" | undefined) ?? "ACTIVE",
      ownerId: uid(STAFF[i % STAFF.length]!), tags: [], address: "India",
      lastActivityAt: minutesAgo(r.int(1, 40) * 24 * 60), createdAt: day(i < 2 ? -r.int(4, 18) : -r.int(40, 700)),
    });
    links.push({ clientId: id, companyId: coId(co) });
  });

  for (const [key, list] of Object.entries(F.CONTACTS)) {
    list.forEach((p, i) => contacts.push({ id: `contact_${key}_${i}`, clientId: `client_${key}`, ...p, isPrimary: p.isPrimary ?? false }));
  }
  for (const [key, c] of clientIds) {
    if (F.CONTACTS[key]) continue;
    const person = r.pick(PEOPLE);
    contacts.push({
      id: `contact_${key}_0`, clientId: c.id, name: person, title: `Founder, ${c.name}`, isPrimary: true,
      email: `${person.split(" ")[0]!.toLowerCase()}@${key.replace(/_/g, "")}.com`, phone: `+91 98${r.int(10000000, 99999999)}`,
      location: "IST (India)", timezone: "Asia/Kolkata",
    });
  }

  await db.client.createMany({ data: rows });
  await db.clientCompany.createMany({ data: links });
  await db.clientContact.createMany({ data: contacts });
}

async function leads() {
  const rows: Prisma.LeadCreateManyInput[] = [];
  let position = 0;
  for (const l of F.LEADS) {
    const lastActivity = l.activityDaysAgo !== undefined ? day(-l.activityDaysAgo, "11:00") : day(-l.createdDaysAgo, "10:00");
    rows.push({
      id: `lead_${slug(l.name)}`, companyId: coId(l.co), name: l.name, service: l.service, value: l.value, stage: l.stage,
      source: l.source, ownerId: uid(l.owner), clientId: l.client ? `client_${l.client}` : null, position: position++,
      contactName: r.pick(PEOPLE), email: `hello@${slug(l.name).replace(/_/g, "")}.com`,
      lastActivityAt: lastActivity, createdAt: day(-l.createdDaysAgo, "10:00"), wonAt: l.stage === "WON" ? lastActivity : null,
    });
  }
  // Hidden cards: exact column totals; sources fill the page-3 source chart (8/6/5/4/4/3/2).
  const vmhSources = ["FIVERR", "FIVERR", "FIVERR", "FIVERR", "INSTAGRAM", "OTHER", "OTHER", "EMAIL", "EMAIL", "EMAIL", "REFERRAL"] as const;
  const vthSources = ["WEBSITE", "WEBSITE", "REFERRAL", "REFERRAL", "LINKEDIN", "LINKEDIN"] as const;
  let vmhI = 0, vthI = 0, prospect = 0;
  for (const [stage, [count, total, vmhCount]] of Object.entries(F.HIDDEN_LEADS)) {
    const values = splitInto(total, count, 5000, r);
    for (let i = 0; i < count; i++) {
      const co: F.Co = i < vmhCount ? "VMH" : "VTH";
      const name = PROSPECTS[prospect++]!;
      const created = r.int(1, 20);
      rows.push({
        id: `lead_${slug(name)}`, companyId: coId(co), name, service: r.pick(co === "VMH" ? VMH_TYPES : VTH_TYPES), value: values[i]!,
        stage: stage as F.LeadFx["stage"], source: co === "VMH" ? vmhSources[vmhI++]! : vthSources[vthI++]!,
        ownerId: uid(r.pick(STAFF)), position: position++, contactName: r.pick(PEOPLE),
        email: `contact@${slug(name).replace(/_/g, "")}.com`, lastActivityAt: day(-r.int(0, created), "12:00"), createdAt: day(-created, "10:00"),
      });
    }
  }
  await db.lead.createMany({ data: rows });
}

const projectIds = new Map<string, { id: string; co: F.Co; client?: string; members: F.TeamKey[] }>();


async function projects() {
  const all: F.ProjectFx[] = [...F.PROJECTS];
  // Generated VMH projects on generated VMH clients.
  const vmhPadClients = [...clientIds.entries()].filter(([k, c]) => !F.CLIENTS.some((f) => f.key === k) && c.companies[0] === "VMH");
  let i = 0;
  for (const [status, count] of F.PADDED_VMH_PROJECTS) {
    for (let n = 0; n < count; n++, i++) {
      const [key, c] = vmhPadClients[i]!;
      const type = r.pick(VMH_TYPES);
      const done = status === "COMPLETED";
      all.push({
        key: `pad_${key}`, client: key, name: type, co: "VMH", status, progress: done ? 100 : status === "NOT_STARTED" ? 0 : r.int(25, 90),
        typeLabel: type, category: type === "Thumbnail Design" ? "DESIGN" : "VIDEO_EDITING", value: r.int(4, 12) * 5000,
        billing: "MONTHLY_RETAINER", start: done ? "2026-09-01" : "2026-10-01", due: done ? "2026-09-30" : "2026-11-15",
        completed: done ? "2026-09-29" : undefined, members: [r.pick(STAFF), r.pick(STAFF)].filter((v, idx, a) => a.indexOf(v) === idx),
      });
      void c;
    }
  }
  // Generated clients' VMH projects only; VTH stays at the page-6 dozen.

  for (const p of all) {
    const id = `project_${p.key}`;
    projectIds.set(p.key, { id, co: p.co, client: p.client, members: p.members });
    const client = F.CLIENTS.find((c) => c.key === p.client);
    await db.project.create({
      data: {
        id, companyId: coId(p.co), clientId: `client_${p.client}`, name: p.name, typeLabel: p.typeLabel, category: p.category,
        template: p.co, status: p.status as never, priority: p.priority ?? "MEDIUM", value: p.value, billingType: p.billing,
        retainerHours: p.retainerHours, startDate: at(p.start), dueDate: at(p.due), completedAt: p.completed ? at(p.completed, "17:00") : null,
        progress: p.progress, summary: p.summary ?? `${p.typeLabel} for ${client?.name ?? clientIds.get(p.client)?.name}`,
        description: p.description ?? `${p.typeLabel} project for ${client?.name ?? clientIds.get(p.client)?.name}.`,
        members: { create: p.members.map((m) => ({ userId: uid(m) })) },
        createdAt: at(p.start, "08:00"),
      },
    });
  }


  // Internal projects (no client): "VTH Internal / System Setup" on the timesheet.
  for (const [key, co, name] of [["vth_internal", "VTH", "System Setup"], ["vmh_internal", "VMH", "Operations"]] as const) {
    projectIds.set(key, { id: `project_${key}`, co, members: ["dhrumil"] });
    await db.project.create({
      data: {
        id: `project_${key}`, companyId: coId(co), clientId: null, name, typeLabel: "Internal", category: "OTHER", template: co,
        status: "IN_PROGRESS", billingType: "TIME_AND_MATERIALS", startDate: at("2026-01-01"), description: `${co} internal work`,
        members: { create: ["dhrumil", ...STAFF].map((m) => ({ userId: uid(m as F.TeamKey) })) },
      },
    });
  }

  // Bright Labs shorts: deliverables 8 / 12 this cycle, 4-point timeline, approvals.
  const bright = "project_bright_labs_shorts";
  await db.deliverable.createMany({
    data: ["12 Edited YouTube Shorts (Monthly)", "12 Thumbnails", "Captions & Subtitles", "Background Music & SFX", "Final Files (1080x1920)"].map(
      (title, order) => ({ projectId: bright, title, targetCount: 12, completedCount: 8, cycleMonth: at("2026-10-01", "00:00"), order }),
    ),
  });
  await db.timelinePhase.createMany({
    data: [["Project Started", "2026-10-01", "COMPLETED"], ["First Drafts", "2026-10-05", "COMPLETED"], ["Client Review", "2026-10-15", "COMPLETED"], ["Final Delivery", "2026-10-25", "PENDING"]].map(
      ([label, date, status], order) => ({ projectId: bright, label: label!, date: at(date!), status: status as "COMPLETED" | "PENDING", order }),
    ),
  });

  // GreenBuild CRM: key deliverables %, 7 milestones, 8 timeline phases.
  const gb = "project_greenbuild_crm";
  await db.deliverable.createMany({
    data: ([["CRM Module (Leads, Clients, Projects)", 100], ["User Roles & Permissions", 100], ["Email & Form Integrations", 80], ["Reporting Dashboard", 60], ["n8n Automation Workflows", 40], ["Testing & Deployment", 0], ["Training & Handover", 0]] as const).map(
      ([title, percent], order) => ({ projectId: gb, title, percent, order }),
    ),
  });
  await db.milestone.createMany({
    data: ([["Requirement Gathering", "2026-09-05", "COMPLETED"], ["UI/UX Design Approval", "2026-09-12", "COMPLETED"], ["Core CRM Development", "2026-09-28", "COMPLETED"], ["Integration Setup", "2026-10-10", "IN_PROGRESS"], ["Testing & QA", "2026-10-20", "PENDING"], ["Client Review", "2026-10-25", "PENDING"], ["Final Deployment", "2026-10-30", "PENDING"]] as const).map(
      ([title, due, status], order) => ({ projectId: gb, title, dueDate: at(due), status, order }),
    ),
  });
  await db.timelinePhase.createMany({
    data: ([["Start", "2026-09-01", "COMPLETED"], ["Requirements", "2026-09-05", "COMPLETED"], ["Design", "2026-09-12", "COMPLETED"], ["Development", "2026-09-28", "COMPLETED"], ["Integration", "2026-10-10", "IN_PROGRESS"], ["Testing", "2026-10-20", "PENDING"], ["Review", "2026-10-25", "PENDING"], ["Deployment", "2026-10-30", "PENDING"]] as const).map(
      ([label, date, status], order) => ({ projectId: gb, label, date: at(date), status, order }),
    ),
  });

  // Other VTH projects: a few milestones each (dashboard "Milestones Due This Week").
  const vthMilestones: [string, string, string, string][] = [
    ["rocco_web_crm", "Client UAT", "2026-10-23", "PENDING"],
    ["ashoka_website", "Homepage Development", "2026-10-24", "IN_PROGRESS"],
    ["nextgen_automation", "Workflow Handover", "2026-10-21", "PENDING"],
    ["vidhi_erp", "Requirements Sign-off", "2026-10-30", "PENDING"],
    ["elite_automation", "Dashboard Prototype", "2026-11-02", "PENDING"],
  ];
  await db.milestone.createMany({
    data: vthMilestones.map(([p, title, due, status], order) => ({ projectId: `project_${p}`, title, dueDate: at(due), status: status as "PENDING", order })),
  });

  // Generic deliverables for the rest so every project shows something.
  for (const [key, p] of projectIds) {
    if (key === "bright_labs_shorts" || key === "greenbuild_crm" || key.endsWith("_internal")) continue;
    const fx = all.find((x) => x.key === key)!;
    await db.deliverable.createMany({
      data:
        p.co === "VMH"
          ? [{ projectId: p.id, title: `${fx.typeLabel} deliverables`, targetCount: 8, completedCount: Math.round((fx.progress / 100) * 8), order: 0 }]
          : [{ projectId: p.id, title: "Design", percent: Math.min(100, fx.progress + 30), order: 0 }, { projectId: p.id, title: "Development", percent: fx.progress, order: 1 }],
    });
  }

  // Approvals: page 5 project + page 1 waiting list.
  await db.approval.createMany({
    data: [
      ...F.BRIGHT_APPROVALS.map(([title, status, date]) => ({
        projectId: bright, title, status, requestedAt: at(date, "09:00"),
        respondedAt: status === "PENDING" ? null : at(date, "15:00"), respondedByContactId: status === "PENDING" ? null : "contact_bright_labs_0",
        comment: status === "REVISION" ? "Please tighten the intro and use the new logo." : null,
      })),
      ...F.APPROVALS_WAITING.map(([p, title, days]) => ({ projectId: `project_${p}`, title, status: "PENDING" as const, requestedAt: minutesAgo(days * 24 * 60 + 30) })),
    ],
  });

  // VTH Delivery Board: 3 open bugs, 7 open support tickets.
  await db.bug.createMany({
    data: [["greenbuild_crm", "Lead import skips rows with empty phone", "HIGH"], ["rocco_web_crm", "Contact form email not sent on Safari", "MEDIUM"], ["ashoka_website", "Hero image stretched on tablets", "LOW"], ["durrell_crm", "Rent reminder sent twice", "MEDIUM"]].map(
      ([p, title, severity], i) => ({ projectId: `project_${p}`, title: title!, severity: severity as "HIGH", status: i === 3 ? "RESOLVED" : "OPEN", createdAt: day(-(i + 2)), resolvedAt: i === 3 ? day(-1) : null }),
    ),
  });
  const ticketClients = ["greenbuild_infra", "rocco_construction", "durrell_properties", "ashoka_buildcon", "nextgen_agency", "scaleup_co", "urban_living", "vidhi_enterprise"];
  await db.supportTicket.createMany({
    data: ticketClients.map((c, i) => ({
      clientId: `client_${c}`, title: ["Add a new user", "Change dashboard colours", "Export not downloading", "Update office address", "Workflow failed overnight", "Reset admin password", "Add WhatsApp button", "Invoice template tweak"][i]!,
      status: i === 7 ? "RESOLVED" : "OPEN", createdAt: day(-(i + 1)),
    })),
  });
}

const taskIds = new Map<string, string>();

async function tasks() {
  const counts = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, CLIENT_REVIEW: 0, COMPLETED: 0 };
  const rows: Prisma.TaskCreateManyInput[] = [];
  const weekStart = startOfWeekIST(NOW);

  const push = (t: F.TaskFx, position: number) => {
    const id = `task_${slug(t.title)}`;
    taskIds.set(t.title, id);
    counts[t.status]++;
    const due = at(t.due, "18:00");
    const done = t.status === "COMPLETED";
    // Completed this week unless the due date is before the week started.
    const completedAt = done ? (due < weekStart ? due : new Date(Math.min(NOW.getTime() - 3600_000, Math.max(weekStart.getTime() + 3600_000, due.getTime())))) : null;
    const delivered = t.stage === "DELIVERED" ? completedAt : null;
    rows.push({
      id, companyId: coId(t.co), projectId: `project_${t.project}`, title: t.title, status: t.status, priority: t.priority,
      assigneeId: uid(t.assignee), createdById: uid("dhrumil"), startDate: addDays(due, -3), dueDate: due, completedAt,
      progress: t.progress ?? (done ? 100 : 0), position, productionStage: t.stage, deliveredAt: delivered,
      editingStartedAt: t.stage ? addDays(delivered ?? due, -(r.int(20, 36) / 24)) : null,
      description: `${t.title} for ${clientIds.get(t.client)?.name}.`, createdAt: addDays(due, -5),
    });
  };
  F.TASKS.forEach((t, i) => push(t, i));

  // Fill each column up to the page-7 board totals with tasks on active projects.
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
  let dueToday = 4; // fixtures already due today; page 1 shows 8
  let position = 100;
  for (const status of Object.keys(fillers) as (keyof typeof counts)[]) {
    const titles = [...fillers[status]];
    while (counts[status] < F.BOARD_COUNTS[status]) {
      const title = titles.shift()!;
      const co: F.Co = isVmhTitle(title) ? "VMH" : "VTH";
      // Bright Labs gets the extra Edit Short tasks (page 5 "x / 12"); GreenBuild gets 3 (page 6 "12 total").
      const project = /Edit Short #[7-9]|Short #1 Delivered/.test(title)
        ? "bright_labs_shorts"
        : /Write Test Cases|API Rate Limiting|Dashboard Charts/.test(title)
          ? "greenbuild_crm"
          : r.pick(co === "VMH" ? vmhProjects : vthProjects)[0];
      const pr = projectIds.get(project)!;
      const done = status === "COMPLETED";
      const dueDay = done ? r.int(-3, 0) : status !== "TODO" && dueToday-- > 0 ? 0 : r.int(1, 12);
      const staff = pr.members.filter((m) => m !== "dhrumil");
      push(
        {
          title, client: pr.client!, project, co: pr.co, status, priority: r.pick(["LOW", "MEDIUM", "MEDIUM", "HIGH"] as const),
          due: shiftDate("2026-10-22", dueDay),
          progress: done || status === "CLIENT_REVIEW" ? 100 : status === "TODO" ? 0 : r.int(20, 90), assignee: r.pick(staff.length ? staff : STAFF),
          stage: pr.co === "VMH" ? ({ TODO: undefined, IN_PROGRESS: "EDITING", IN_REVIEW: "INTERNAL_QC", CLIENT_REVIEW: "CLIENT_REVIEW", COMPLETED: "DELIVERED" } as const)[status] : undefined,
        },
        position++,
      );
    }
  }
  await db.task.createMany({ data: rows });

  // Estimates on this week's open tasks feed the dashboard workload ("planned" hours).
  for (const [who, total] of Object.entries(F.WEEK_PLANNED_MIN) as [F.TeamKey, number][]) {
    const open = await db.task.findMany({ where: { assigneeId: uid(who), status: { not: "COMPLETED" }, dueDate: { gte: weekStart, lt: addDays(weekStart, 7) } }, select: { id: true } });
    if (open.length) await db.task.updateMany({ where: { id: { in: open.map((t) => t.id) } }, data: { estimatedMinutes: Math.round(total / open.length) } });
  }

  // Drawer task (page 7): checklist 3/5 → progress 60%, tags, description, comments, files.
  const drawer = taskIds.get(F.DRAWER_TASK.title)!;
  const doneItems = F.DRAWER_TASK.checklist.filter((c) => c[1]).length;
  await db.task.update({
    where: { id: drawer },
    data: {
      startDate: at(F.DRAWER_TASK.start), tags: F.DRAWER_TASK.tags, description: F.DRAWER_TASK.description,
      progress: Math.round((doneItems / F.DRAWER_TASK.checklist.length) * 100),
      checklist: { create: F.DRAWER_TASK.checklist.map(([text, done, who], order) => ({ text, done, assigneeId: uid(who), order })) },
    },
  });
  await db.comment.createMany({
    data: F.DRAWER_TASK.comments.map(([who, date, time, body]) => ({
      entityType: "TASK" as const, entityId: drawer, authorId: uid(who), body, createdAt: at(date, time),
      mentions: body.includes("@Hardik") ? [uid("hardik")] : [],
    })),
  });
}

function shiftDate(pdfDate: string, days: number): string {
  const d = new Date(`${pdfDate}T00:00:00Z`);
  return new Date(d.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

const WEEK_START = "2026-10-19";
const weekUsed: Partial<Record<F.TeamKey, number>> = {};

async function timeEntries() {
  const rows: Prisma.TimeEntryCreateManyInput[] = [];
  const left = structuredClone(F.TIME_BUCKETS);
  const weekStart = startOfWeekIST(NOW);

  const occ = new Map<string, [number, number][]>(); // who|date → busy minute ranges
  const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
  const add = (who: F.TeamKey, project: string, date: string, start: string, minutes: number, billable: boolean, note: string, taskId?: string) => {
    const p = projectIds.get(project)!;
    const k = `${who}|${date}`;
    (occ.get(k) ?? occ.set(k, []).get(k)!).push([toMin(start), toMin(start) + minutes]);
    if (date >= WEEK_START) weekUsed[who] = (weekUsed[who] ?? 0) + minutes;
    const s = at(date, start);
    const recent = s >= weekStart;
    rows.push({
      userId: uid(who), companyId: coId(p.co), projectId: p.id, taskId, start: s, end: new Date(s.getTime() + minutes * 60_000), durationMin: minutes,
      note, billable, status: billable && recent && r.next() < 0.5 ? "PENDING" : "APPROVED", approvedById: billable && recent ? null : uid("dhrumil"),
      category: !billable && project.endsWith("_internal") && note.toLowerCase().includes("meeting") ? "MEETINGS" : null,
    });
    const bucket = `${p.co}_${billable ? "B" : "N"}` as keyof (typeof left)["hardik"];
    left[who][bucket] -= minutes;
  };

  // Visible timesheet rows (page 8).
  for (const t of F.TIME_ROWS) {
    const [sh, sm] = t.start.split(":").map(Number);
    const [eh, em] = t.end.split(":").map(Number);
    add(t.who, t.project, t.date, t.start, eh! * 60 + em! - (sh! * 60 + sm!), t.billable, t.task, taskIds.get(t.task));
  }

  // The drawer task's "Time (2h 30m)".
  add("hardik", "bright_labs_shorts", "2026-10-19", "10:00", 90, true, "Rough cut + captions", taskIds.get(F.DRAWER_TASK.title));
  add("hardik", "bright_labs_shorts", "2026-10-21", "10:00", 60, true, "Music and brand pass", taskIds.get(F.DRAWER_TASK.title));

  // GreenBuild minutes come first out of the right buckets (page 6 Time Tracking card).
  const gbPlan: [F.TeamKey, boolean, number][] = [["sheen", true, 800 - 90 + 845], ["hardik", true, 650], ["dhrumil", false, 255]];
  // This week first, up to each person's target (dashboard Team Workload), then earlier days, latest first.
  const days = weekdays("2026-10-01", "2026-10-21");
  const place = (who: F.TeamKey, minutes: number) => {
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
    throw new Error(`No room for ${minutes}m of ${who}'s time`);
  };
  for (const [who, billable, minutes] of gbPlan) {
    for (const chunk of splitTotal(minutes, 60, 180, 15, r)) {
      const { date, start } = place(who, chunk);
      add(who, "greenbuild_crm", date, start, chunk, billable, billable ? r.pick(["CRM development", "API work", "UI build", "Bug fixes"]) : "Client meeting");
    }
  }

  // Everything else: spread each remaining bucket over the member's projects in that company.
  for (const who of Object.keys(left) as F.TeamKey[]) {
    for (const bucket of ["VMH_B", "VMH_N", "VTH_B", "VTH_N"] as const) {
      const co = bucket.slice(0, 3) as F.Co;
      const billable = bucket.endsWith("_B");
      const options = [...projectIds.entries()]
        .filter(([k, p]) => p.co === co && (billable ? !k.endsWith("_internal") && k !== "greenbuild_crm" && (p.members.includes(who) || who === "dhrumil") : k.endsWith("_internal")))
        .map(([k]) => k);
      if (left[who][bucket] <= 0) continue;
      for (const chunk of splitTotal(left[who][bucket], 45, 180, 15, r)) {
        const { date, start } = place(who, chunk);
        const project = r.pick(options.length ? options : [`${co.toLowerCase()}_internal`]);
        add(who, project, date, start, chunk, billable, billable ? r.pick(["Editing", "Revisions", "Development", "Design", "QA"]) : r.pick(["Team meeting", "Internal planning", "Tooling", "Client meeting"]));
      }
    }
  }
  await db.timeEntry.createMany({ data: rows });
}

async function invoices() {
  const fixtures = [...F.INVOICES];
  // Earlier invoices so numbering is continuous: VMH-001…016, VTH-001…014.
  const vmhPad = [...clientIds.entries()].filter(([, c]) => c.companies.includes("VMH")).map(([k]) => k);
  const vthPad = [...clientIds.entries()].filter(([, c]) => c.companies.includes("VTH")).map(([k]) => k);
  const pad = (co: F.Co, n: number, issue: string): F.InvoiceFx => {
    const client = co === "VMH" ? vmhPad[(n * 7) % vmhPad.length]! : vthPad[(n * 5) % vthPad.length]!;
    const project = [...projectIds.entries()].find(([k, p]) => p.client === client && p.co === co && !k.endsWith("_internal"))?.[0] ?? `${co.toLowerCase()}_internal`;
    return { number: `${co}-${String(n).padStart(3, "0")}`, client, project, issue, due: shiftDate(issue, 15), amount: co === "VMH" ? r.int(6, 40) * 1000 : r.int(5, 20) * 10000, paidPct: 100 };
  };
  for (let n = 1; n <= 16; n++) fixtures.push(pad("VMH", n, shiftDate("2026-06-01", Math.round((n - 1) * 7.5))));
  for (let n = 1; n <= 14; n++) fixtures.push(pad("VTH", n, shiftDate("2026-06-05", (n - 1) * 8)));
  const tweak = (num: string, patch: Partial<F.InvoiceFx>) => Object.assign(fixtures.find((f) => f.number === num)!, patch);
  tweak("VTH-013", { client: "bright_labs", project: "bright_labs_website", issue: "2026-09-15", due: "2026-09-30", amount: 120000 }); // paid today (page 1 activity)
  tweak("VMH-016", { draft: true, paidPct: 0 });
  tweak("VTH-014", { draft: true, paidPct: 0 });
  tweak("VTH-012", { paidPct: 0 });
  tweak("VMH-014", { paidPct: 0 });
  // Pending with longer terms, so the page-9 tabs read Paid 28 · Pending 6 · Overdue 4 · Draft 2.
  tweak("VTH-010", { due: "2026-11-05", paidPct: 0 });
  tweak("VMH-015", { due: "2026-10-30", paidPct: 0 });
  tweak("VMH-013", { due: "2026-10-25", paidPct: 0 });

  for (const f of fixtures) {
    const co = f.number.slice(0, 3) as F.Co;
    const seq = Number(f.number.slice(4));
    const issue = at(f.issue, "10:00");
    const due = at(f.due, "18:00");
    const paid = Math.round((f.amount * f.paidPct) / 100);
    const lines = f.number === "VTH-019" ? F.VTH019_LINES : ([[ projectLabel(f.project), 1, f.amount ]] as [string, number, number][]);
    const status = invoiceStatus({ current: f.draft ? "DRAFT" : "PENDING", total: f.amount, paid, dueDate: due, now: NOW });
    const id = `invoice_${f.number.toLowerCase().replace("-", "_")}`;
    const payDate = f.number === "VTH-013" ? minutesAgo(60) : new Date(Math.min(NOW.getTime() - 86_400_000, addDays(issue, r.int(2, 10)).getTime()));
    await db.invoice.create({
      data: {
        id, companyId: coId(co), number: f.number, seq, clientId: `client_${f.client}`, projectId: projectIds.get(f.project)?.id,
        issueDate: issue, dueDate: due, subtotal: f.amount, total: f.amount, paidAmount: paid, status,
        notes: `Thank you for your business. Payment is due by ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(due)}.`,
        sentAt: f.draft ? null : issue, createdAt: issue,
        lineItems: { create: lines.map(([description, qty, rate], order) => ({ description, qty, rate, amount: qty * rate, order })) },
        payments: paid > 0 ? { create: [{ amount: paid, date: payDate, method: co === "VTH" && f.number !== "VTH-013" ? "BANK_TRANSFER" : r.pick(["UPI", "BANK_TRANSFER", "WISE", "PAYPAL"] as const), reference: `TXN${r.int(100000, 999999)}`, createdById: uid("dhrumil") }] } : undefined,
      },
    });
  }
  await db.comment.createMany({
    data: ["Sent to Raj with the CRM milestone summary.", "Raj confirmed ₹1,00,000 advance via bank transfer.", "Balance due after training & handover.", "Reminder scheduled for 30 Oct.", "Client asked for GST invoice copy, attached."].map((body, i) => ({
      entityType: "INVOICE" as const, entityId: "invoice_vth_019", authorId: uid(i % 2 ? "sheen" : "dhrumil"), body, createdAt: at("2026-10-18", `1${i}:00`),
    })),
  });
}

function projectLabel(key: string): string {
  return F.PROJECTS.find((p) => p.key === key)?.typeLabel ?? "Professional services";
}

async function goals() {
  const thresholds = companySettingsSchema.parse({}).goalThresholds;
  for (const g of F.GOALS) {
    const start = at(g.start, "00:00");
    const end = at(g.end, "23:59");
    const progress = goalProgress({ startValue: 0, currentValue: g.current, targetValue: g.target });
    await db.goal.create({
      data: {
        id: `goal_${g.key}`, companyId: g.co ? coId(g.co) : null, scope: g.scope, title: g.title, subtitle: g.subtitle,
        description: g.description ?? g.subtitle, category: g.category as never, unit: g.unit, currentValue: g.current, targetValue: g.target,
        startDate: start, endDate: end, ownerId: uid(g.owner), icon: g.icon,
        status: goalStatus({ progress, startDate: start, endDate: end, now: NOW, thresholds }),
        members: g.members ? { create: g.members.map((m) => ({ userId: uid(m) })) } : undefined,
      },
    });
  }
  await db.goalMilestone.createMany({
    data: F.VTH_REVENUE_MILESTONES.map(([title, date, done], order) => ({ goalId: "goal_vth_monthly_revenue", title, date: at(date), done, order })),
  });
}

async function files() {
  const root = (category: string, name: string, color: string) => ({ id: `folder_${category.toLowerCase()}`, name, category: category as never, color });
  const roots = [
    root("CLIENT_FILES", "Client Files", "#308CFC"), root("PROJECT_FILES", "Project Files", "#902EFC"), root("DESIGN_ASSETS", "Design Assets", "#FC6C78"),
    root("VIDEO_ASSETS", "Video Assets", "#FC9C0E"), root("DOCUMENTS", "Documents", "#04CC88"), root("TEAM_RESOURCES", "Team Resources", "#64748B"),
  ];
  const modified: Record<string, string> = { CLIENT_FILES: "2026-10-20", PROJECT_FILES: "2026-10-18", DESIGN_ASSETS: "2026-10-15", VIDEO_ASSETS: "2026-10-12", DOCUMENTS: "2026-10-10", TEAM_RESOURCES: "2026-09-30" };
  await db.folder.createMany({ data: roots.map((f) => ({ ...f, updatedAt: at(modified[f.category]!), createdAt: day(-300) })) });

  const folders: Prisma.FolderCreateManyInput[] = [];
  const clientFolderKeys = ["bright_labs", "greenbuild_infra", "elite_creators", "rocco_construction", "scaleup_co", "ashoka_buildcon", "flow_marketing", "urban_living", "nextgen_agency", "durrell_properties", "bhaumik_podcast", "fit_life_media", "creative_studio"];
  const clientColors = ["#A78BFA", "#F472B6", "#F9A8D4", "#FDBA74", "#FCD34D"];
  clientFolderKeys.forEach((k, i) => folders.push({ id: `folder_client_${k}`, parentId: "folder_client_files", name: clientIds.get(k)!.name, category: "CLIENT_FILES", clientId: `client_${k}`, color: clientColors[i % 5] ?? "#93C5FD" }));
  const projectFolders = ["Website Development", "CRM Development", "Video Editing", "Automation (n8n)", "ERP Development", "Thumbnails", "Podcasts", "Reels", "Landing Pages", "Dashboards"];
  projectFolders.forEach((name, i) => folders.push({ id: `folder_project_${slug(name)}`, parentId: "folder_project_files", name, category: "PROJECT_FILES", color: ["#A855F7", "#3B82F6", "#93C5FD", "#93C5FD"][i] ?? "#93C5FD" }));
  const subs: [string, string[]][] = [
    ["DESIGN_ASSETS", ["Logos", "Brand Kits", "UI Kits", "Icons", "Mockups", "Fonts", "Illustrations", "Presentations"]],
    ["VIDEO_ASSETS", ["Raw Footage", "Music", "SFX", "LUTs", "Templates", "Stock"]],
    ["DOCUMENTS", ["Contracts", "Proposals", "Invoices", "SOPs", "Briefs", "Reports", "NDAs", "Meeting Notes", "Requirements", "Handover"]],
    ["TEAM_RESOURCES", ["Style Guides", "Onboarding", "Templates"]],
  ];
  for (const [category, names] of subs) names.forEach((name) => folders.push({ id: `folder_${category.toLowerCase()}_${slug(name)}`, parentId: `folder_${category.toLowerCase()}`, name, category: category as never }));
  await db.folder.createMany({ data: folders });

  const fileRows: Prisma.FileCreateManyInput[] = [];
  const folderFor = (key: string) =>
    key.startsWith("client:") ? `folder_client_${key.slice(7)}` : key === "design" ? "folder_design_assets_mockups" : key === "video" ? "folder_video_assets_templates" : key === "documents" ? "folder_documents_meeting_notes" : key === "project:crm" ? "folder_project_crm_development" : "folder_project_automation_n8n";
  const mimeOf = (ext: string) => ({ pdf: "application/pdf", fig: "application/x-figma", mp4: "video/mp4", png: "image/png", jpg: "image/jpeg", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ai: "application/postscript", psd: "image/vnd.adobe.photoshop", json: "application/json", srt: "application/x-subrip", mp3: "audio/mpeg", mov: "video/quicktime", zip: "application/zip" })[ext] ?? "application/octet-stream";

  F.FILE_ROWS.forEach((f, i) => {
    const ext = f.name.split(".").pop()!.toLowerCase();
    const id = i === 0 ? "file_project_brief" : `file_${slug(f.name)}`;
    const project = f.project ? projectIds.get(f.project) : undefined;
    fileRows.push({
      id, folderId: folderFor(f.folder), name: f.name, mime: mimeOf(ext), ext: ext.toUpperCase(), size: Math.round(f.size), storageKey: `seed/${id}/${f.name}`,
      companyId: project ? coId(project.co) : null, clientId: f.client ? `client_${f.client}` : project?.client ? `client_${project.client}` : null, projectId: project?.id,
      uploadedById: uid(i === 0 ? "dhrumil" : r.pick(STAFF)), status: f.status, tags: f.tags ?? [], description: f.description,
      createdAt: at(f.modified, "10:30"), updatedAt: at(f.modified, "10:30"), sharedWithPortal: f.status === "FINAL",
    });
  });
  // Drawer task's 3 files.
  F.DRAWER_TASK.files.forEach(([name, size, mime], i) =>
    fileRows.push({ id: `file_task_${i}`, folderId: "folder_client_bright_labs", name, mime, ext: name.split(".").pop()!.toUpperCase(), size, storageKey: `seed/file_task_${i}/${name}`, companyId: "vmh", clientId: "client_bright_labs", projectId: "project_bright_labs_shorts", taskId: taskIds.get(F.DRAWER_TASK.title), uploadedById: uid("hardik"), createdAt: at("2026-10-18", "14:00"), updatedAt: at("2026-10-18", "14:00") }),
  );

  // Bulk files so the page-12 category cards add up (248 / 320 / 156 / 210 / 96).
  const extByCat: Record<string, string[]> = { CLIENT_FILES: ["pdf", "docx", "png", "mp4", "jpg"], PROJECT_FILES: ["fig", "pdf", "png", "json", "xlsx", "mp4"], DESIGN_ASSETS: ["png", "ai", "psd", "fig", "jpg"], VIDEO_ASSETS: ["mp4", "mov", "mp3", "zip"], DOCUMENTS: ["pdf", "docx", "xlsx"] };
  const existing = (cat: string) => fileRows.filter((f) => folders.find((x) => x.id === f.folderId)?.category === cat).length;
  for (const [cat, , total] of F.FILE_CATEGORY_COUNTS) {
    const targets = folders.filter((f) => f.category === cat).map((f) => f.id!);
    for (let i = existing(cat); i < total; i++) {
      const ext = r.pick(extByCat[cat]!);
      const folderId = r.pick(targets);
      const name = `${cat === "VIDEO_ASSETS" ? "Clip" : cat === "DOCUMENTS" ? "Document" : cat === "DESIGN_ASSETS" ? "Asset" : "File"}_${String(i + 1).padStart(3, "0")}.${ext}`;
      const when = day(-r.int(11, 200));
      fileRows.push({ id: `file_${cat.toLowerCase()}_${i}`, folderId, name, mime: mimeOf(ext), ext: ext.toUpperCase(), size: ext === "mp4" || ext === "mov" ? r.int(20, 900) * 1024 * 1024 : r.int(40, 9000) * 1024, storageKey: `seed/${cat}/${name}`, uploadedById: uid(r.pick(STAFF)), createdAt: when, updatedAt: when });
    }
  }
  await db.file.createMany({ data: fileRows });

  // Shared With avatars on the page-12 rows.
  const shares: Prisma.FileShareCreateManyInput[] = [];
  F.FILE_ROWS.slice(0, 9).forEach((f, i) => {
    const id = i === 0 ? "file_project_brief" : `file_${slug(f.name)}`;
    const people = i === 0 ? ["sheen", "hardik"] : STAFF.slice(0, (i % 3) + 1);
    people.forEach((p) => shares.push({ fileId: id, userId: uid(p as F.TeamKey) }));
  });
  await db.fileShare.createMany({ data: shares });
  await db.fileVersion.createMany({ data: [1, 2].map((v) => ({ fileId: "file_project_brief", version: v, storageKey: `seed/file_project_brief/v${v}`, size: 2.3 * 1024 * 1024 + v * 50_000, uploadedById: uid("dhrumil"), createdAt: at("2026-10-1" + (v + 7), "10:30") })) });
  await db.file.update({ where: { id: "file_project_brief" }, data: { version: 2 } });
}

async function campaignsAgendaActivity() {
  for (const [i, c] of F.CAMPAIGNS.entries()) {
    await db.emailCampaign.create({
      data: {
        id: `campaign_${i + 1}`, companyId: c.co ? coId(c.co) : null, name: c.name, status: "ACTIVE", subject: c.subject,
        sentCount: c.sent, openCount: Math.round((c.sent * c.openPct) / 100), replyCount: Math.round((c.sent * c.replyPct) / 100), meetingsCount: c.meetings,
        audienceFilter: { companies: c.co ? [c.co] : ["VMH", "VTH"], stages: ["NEW", "CONTACTED"] },
        steps: [{ subject: c.subject, body: "Hi {{firstName}},\n\n…", delayDays: 0 }, { subject: `Re: ${c.subject}`, body: "Just following up, {{firstName}}.", delayDays: 3 }],
        createdAt: day(-20 + i * 3),
        recipients: { create: PROSPECTS.slice(i * 4, i * 4 + 4).map((name, n) => ({ email: `hello@${slug(name).replace(/_/g, "")}.com`, name, status: (["SENT", "OPENED", "REPLIED", "OPENED"] as const)[n]!, sentAt: day(-5), openedAt: n ? day(-4) : null, repliedAt: n === 2 ? day(-3) : null })) },
      },
    });
  }

  await db.calendarEvent.createMany({
    data: [
      ...F.AGENDA.map((e) => {
        const start = at("2026-10-22", e.time);
        return { title: e.title, type: e.type, companyId: e.co ? coId(e.co) : null, start, end: new Date(start.getTime() + e.minutes * 60_000), clientId: e.client ? `client_${e.client}` : null, projectId: e.project ? `project_${e.project}` : null, attendeeIds: [uid("dhrumil"), uid("hardik")] };
      }),
      { title: "Sprint Planning - GreenBuild", type: "MEETING" as const, companyId: "vth", start: at("2026-10-23", "11:00"), end: at("2026-10-23", "12:00"), projectId: "project_greenbuild_crm", attendeeIds: [uid("sheen"), uid("sheen")] },
      { title: "Content Review - Elite Creators", type: "REVIEW" as const, companyId: "vmh", start: at("2026-10-23", "15:00"), end: at("2026-10-23", "15:30"), clientId: "client_elite_creators", attendeeIds: [uid("hardik")] },
    ],
  });

  // Recent Activity (page 1), goal activity (page 10), time log activity (page 8), plus history.
  await db.activity.createMany({
    data: [
      { companyId: "vmh", actorId: uid("sheen"), verb: "uploaded", entityType: "FILE" as const, entityId: "file_short_01_final_mp4", summary: "Priya uploaded final video for Alex Johnson", createdAt: minutesAgo(2) },
      { companyId: "vth", actorId: uid("hardik"), verb: "completed", entityType: "TASK" as const, entityId: taskIds.get("Build Lead Module")!, summary: "Rohan marked task as completed", createdAt: minutesAgo(15) },
      { companyId: "vth", actorId: null, verb: "paid", entityType: "PAYMENT" as const, entityId: "invoice_vth_013", summary: "Payment received from Bright Labs (₹1,20,000)", createdAt: minutesAgo(60) },
      { companyId: null, actorId: uid("dhrumil"), verb: "created", entityType: "LEAD" as const, entityId: "lead_scaleup_co", summary: "New lead added: ScaleUp Co.", createdAt: minutesAgo(120) },
      { companyId: "vth", actorId: uid("hardik"), verb: "updated", entityType: "GOAL" as const, entityId: "goal_vth_monthly_revenue", summary: "Rohan updated progress to 75%", createdAt: minutesAgo(125) },
      { companyId: "vth", actorId: uid("sheen"), verb: "completed", entityType: "GOAL" as const, entityId: "goal_vth_monthly_revenue", summary: "Priya marked milestone as completed", createdAt: minutesAgo(300) },
      { companyId: "vth", actorId: uid("hardik"), verb: "commented", entityType: "GOAL" as const, entityId: "goal_vth_monthly_revenue", summary: "Aman added a new comment", createdAt: at("2026-10-18", "10:30") },
      { companyId: "vth", actorId: uid("sheen"), verb: "status", entityType: "GOAL" as const, entityId: "goal_vth_monthly_revenue", summary: "Neha changed status to On Track", createdAt: at("2026-10-17", "16:15") },
      { companyId: "vmh", actorId: uid("hardik"), verb: "timer_started", entityType: "TIME_ENTRY" as const, entityId: "edit_short_1", summary: "Rohan started tracking time", meta: { detail: "Edit Short #1 — Bright Labs" }, createdAt: at("2026-10-20", "10:00") },
      { companyId: "vth", actorId: uid("sheen"), verb: "timer_stopped", entityType: "TIME_ENTRY" as const, entityId: "ui_design", summary: "Sheen stopped tracking time", meta: { detail: "UI Design — GreenBuild Infra" }, createdAt: at("2026-10-20", "13:15") },
      { companyId: "vmh", actorId: uid("hardik"), verb: "time_edited", entityType: "TIME_ENTRY" as const, entityId: "episode_edit", summary: "Hardik edited time entry", meta: { detail: "Episode Edit — Bhaumik Podcast" }, createdAt: at("2026-10-19", "18:00") },
      { companyId: "vth", actorId: uid("sheen"), verb: "time_note", entityType: "TIME_ENTRY" as const, entityId: "workflow_setup", summary: "Sheen added a note", meta: { detail: "“Completed workflow setup and tested.”" }, createdAt: at("2026-10-19", "17:45") },
      { companyId: "vmh", actorId: uid("hardik"), verb: "moved", entityType: "LEAD" as const, entityId: "lead_elite_creators", summary: "Hardik moved Elite Creators to Negotiation", createdAt: day(-1, "15:00") },
      { companyId: "vth", actorId: uid("sheen"), verb: "completed", entityType: "TASK" as const, entityId: taskIds.get("Lead Module Completed")!, summary: "Sheen completed Lead Module for GreenBuild Infra", createdAt: day(-1, "12:00") },
    ],
  });

  // Project notes (page 5).
  await db.comment.createMany({
    data: [["hardik", "2026-10-21", "10:30", "Looks great! Can we make the caption bold?"], ["sheen", "2026-10-21", "11:15", "Sure, updating in next version."], ["dhrumil", "2026-10-20", "18:45", "Client approved Short #1. Moving to Short #2."]].map(([who, date, time, body]) => ({
      entityType: "PROJECT" as const, entityId: "project_bright_labs_shorts", authorId: uid(who as F.TeamKey), body: body!, createdAt: at(date!, time!),
    })),
  });

  // 3 unread notifications for the owner.
  await db.notification.createMany({
    data: [
      { userId: uid("dhrumil"), type: "approval", title: "Bright Labs approved Short #1", link: "/projects?id=project_bright_labs_shorts", createdAt: minutesAgo(30) },
      { userId: uid("dhrumil"), type: "invoice_paid", title: "Payment received: #VTH-013 (₹1,20,000)", link: "/invoices?id=invoice_vth_013", createdAt: minutesAgo(60) },
      { userId: uid("dhrumil"), type: "over_capacity", title: "Sheen is over capacity this week", link: "/team", createdAt: minutesAgo(180) },
      { userId: uid("dhrumil"), type: "lead_stage", title: "Elite Creators moved to Negotiation", link: "/leads", createdAt: day(-1), readAt: day(-1, "16:00") },
    ],
  });

  // Cross-sell alerts (page 1) come from the rules engine.
  await runCrossSellRules(db);

  await db.tag.createMany({
    data: [["Editing", "#7C3AED"], ["Shorts", "#64748B"], ["YouTube", "#64748B"], ["Brief", "#2563EB"], ["Client", "#2563EB"], ["Website", "#2563EB"], ["retainer", "#047857"], ["product-launch", "#EA580C"], ["website", "#2563EB"], ["crm", "#2563EB"]].map(([name, color]) => ({ name: name!, color: color! })),
  });
}

async function main() {
  const started = Date.now();
  await wipe();
  await companies();
  await users();
  await clients();
  await leads();
  await projects();
  await tasks();
  await timeEntries();
  await invoices();
  await goals();
  await files();
  await campaignsAgendaActivity();
  console.log(`Seeded in ${((Date.now() - started) / 1000).toFixed(1)}s (today = ${new Date(TODAY.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10)}).`);
  console.log(`Log in as dhrumil@vertexmediahouse.com / ${process.env.SEED_PASSWORD || "vertex123"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
