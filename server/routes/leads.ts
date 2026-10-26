// Ported from app/(app)/leads/{page.tsx,actions.ts,export/route.ts}. Query and mutation
// bodies are unchanged; only the context and input plumbing differs, and refresh() is
// gone (the frontend invalidates its queries instead).
import { Hono } from "hono";
import { z } from "zod";
import { staffContext, type Env } from "../context";
import { logActivity, notify } from "@/lib/activity";
import { assertCan, can } from "@/lib/auth/permissions";
import { addDays, now } from "@/lib/clock";
import { toCsv } from "@/lib/csv";
import { db, type Prisma } from "@/lib/db";
import { scopedWhere } from "@/lib/db/scope";
import { readParams, subScope } from "@/lib/search-params";
import { LEAD_STAGE } from "@/lib/status";
import { leadSchema, STAGES } from "@/lib/validation/lead";
import type { ActionResult } from "@/lib/validation/result";

const moveSchema = z.object({ id: z.string().max(64), stage: z.enum(STAGES), beforeId: z.string().max(64).nullable() });

export const leads = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const user = c.get("user");
    const scopeName = c.get("scope");
    const ctxCompanyIds = c.get("companyIds");
    if (!can(user, "view", "lead")) return c.json({ canView: false as const });
    const p = readParams(c.req.query());
    const t = now();
    const companyIds = subScope(ctxCompanyIds, p.str("co"));
    const scope = { companyIds: ctxCompanyIds };
    const q = p.str("q");
    const where: Prisma.LeadWhereInput = {
      companyId: { in: companyIds },
      ...(p.str("source") && { source: p.str("source") as Prisma.LeadWhereInput["source"] }),
      ...(p.str("owner") && { ownerId: p.str("owner")! }),
      ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { service: { contains: q, mode: "insensitive" } }] }),
      createdAt: { lt: p.period.to },
    };
    const inPeriod = { gte: p.period.from, lt: p.period.to };
    const prev = { gte: p.period.prevFrom, lt: p.period.prevTo };
    const all = { ...scopedWhere(scope), stage: { not: "LOST" as const } };

    // The board hides leads won or lost over 30 days ago, so it doesn't grow without end.
    // Search and the Lost toggle must still find them. AND, because `where` uses OR.
    const recentOnly = !q && !p.str("lost");
    const [list, counts, owners, kpi] = await Promise.all([
      db.lead.findMany({
        where: {
          ...where,
          stage: p.str("lost") ? undefined : { not: "LOST" },
          ...(recentOnly && { AND: [{ OR: [{ stage: { notIn: ["WON", "LOST"] } }, { lastActivityAt: { gte: addDays(t, -30) } }] }] }),
        },
        orderBy: [{ position: "asc" }],
        include: { owner: { select: { name: true } } },
      }),
      db.lead.groupBy({ by: ["companyId"], _count: true, where: all }),
      db.user.findMany({ where: { kind: "STAFF", memberships: { some: { companyId: { in: ctxCompanyIds } } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      Promise.all([
        db.lead.groupBy({ by: ["companyId"], _count: true, _sum: { value: true }, where: all }),
        db.lead.groupBy({ by: ["companyId"], _sum: { value: true }, where: { ...scopedWhere(scope), stage: { in: ["NEW", "CONTACTED", "PROPOSAL", "NEGOTIATION"] } } }),
        db.lead.groupBy({ by: ["companyId"], _count: true, where: { ...all, createdAt: inPeriod } }),
        db.lead.count({ where: { ...all, createdAt: prev } }),
        db.lead.groupBy({ by: ["companyId"], _count: true, where: { ...scopedWhere(scope), stage: "WON", wonAt: inPeriod } }),
        db.lead.count({ where: { ...scopedWhere(scope), stage: "WON", wonAt: prev } }),
        db.lead.groupBy({ by: ["companyId"], _count: true, where: { ...scopedWhere(scope), stage: "LOST", lostAt: inPeriod } }),
        db.lead.groupBy({ by: ["companyId"], _count: true, where: { ...scopedWhere(scope), stage: { in: ["NEW", "CONTACTED", "PROPOSAL", "NEGOTIATION"] }, createdAt: inPeriod } }),
      ]),
    ]);
    const [totals, pipeline, created, createdPrev, won, wonPrev, lost, openNew] = kpi;
    const allowedCo = ctxCompanyIds.filter((x): x is "vmh" | "vth" => x === "vmh" || x === "vth").filter((x) => can(user, "create", "lead", x));
    return c.json({
      canView: true as const,
      leads: list,
      counts,
      owners,
      kpi: { totals, pipeline, created, createdPrev, won, wonPrev, lost, openNew },
      scope: scopeName,
      allowedCo,
    });
  })
  /** CSV of the filtered lead list (opens in Excel). Mirrors the filters on /leads. */
  .get("/export", async (c) => {
    const user = c.get("user");
    assertCan(user, "view", "lead");
    const q = c.req.query();
    const search = q.q;
    const where: Prisma.LeadWhereInput = {
      companyId: { in: subScope(c.get("companyIds"), q.co ?? null) },
      ...(q.source && { source: q.source as Prisma.LeadWhereInput["source"] }),
      ...(q.owner && { ownerId: q.owner }),
      // The board hides Lost; an export of "everything" should not.
      ...(search && { OR: [{ name: { contains: search, mode: "insensitive" } }, { service: { contains: search, mode: "insensitive" } }] }),
    };
    const rows = await db.lead.findMany({
      where,
      orderBy: [{ stage: "asc" }, { createdAt: "desc" }],
      include: { owner: { select: { name: true } }, client: { select: { name: true } } },
    });
    const csv = toCsv(
      ["Name", "Company", "Service", "Stage", "Value (INR)", "Source", "Contact", "Email", "Phone", "Owner", "Client", "Created", "Last activity", "Won", "Lost", "Notes"],
      rows.map((l) => [
        l.name,
        l.companyId.toUpperCase(),
        l.service,
        l.stage,
        Number(l.value),
        l.source,
        l.contactName ?? "",
        l.email ?? "",
        l.phone ?? "",
        l.owner?.name ?? "",
        l.client?.name ?? "",
        l.createdAt.toISOString().slice(0, 10),
        l.lastActivityAt.toISOString().slice(0, 10),
        l.wonAt ? l.wonAt.toISOString().slice(0, 10) : "",
        l.lostAt ? l.lostAt.toISOString().slice(0, 10) : "",
        l.notes ?? "",
      ]),
    );
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="leads.csv"` } });
  })
  /** The ?id= drawer. */
  .get("/:id", async (c) => {
    const user = c.get("user");
    const companyIds = c.get("companyIds");
    const id = c.req.param("id");
    const lead = await db.lead.findFirst({ where: { id, ...scopedWhere({ companyIds }) }, include: { owner: { select: { name: true } }, client: { select: { id: true, name: true } } } });
    if (!lead) return c.json({ lead: null });
    const [activity, events] = await Promise.all([
      db.activity.findMany({ where: { entityType: "LEAD", entityId: id }, orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true } } } }),
      db.calendarEvent.findMany({ where: { leadId: id }, orderBy: { start: "asc" } }),
    ]);
    return c.json({
      lead,
      activity,
      events,
      canDelete: can(user, "delete", "lead", lead.companyId),
      canConvert: can(user, "create", "client", lead.companyId),
    });
  })
  .post("/", async (c) => {
    const user = c.get("user");
    const parsed = leadSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json<ActionResult>({ ok: false, error: parsed.error.issues[0]!.message });
    const d = parsed.data;
    assertCan(user, "create", "lead", d.companyId);
    const lead = await db.$transaction(async (tx) => {
      const lead = await tx.lead.create({ data: { ...d, ownerId: d.ownerId || user.id, email: d.email || null, stage: "NEW" } });
      await logActivity(tx, { companyId: d.companyId, actorId: user.id, verb: "created", entityType: "LEAD", entityId: lead.id, summary: `New lead added: ${lead.name}` });
      if (lead.ownerId !== user.id) await notify(tx, { userIds: [lead.ownerId!], type: "lead_assigned", title: `You own a new lead: ${lead.name}`, link: `/leads?id=${lead.id}` });
      return lead;
    });
    return c.json<ActionResult>({ ok: true, id: lead.id });
  })
  /** Kanban drop: change stage, and slot the lead in just above the card it was dropped on. */
  .post("/move", async (c) => {
    const user = c.get("user");
    const m = moveSchema.parse(await c.req.json());
    const lead = await db.lead.findUniqueOrThrow({ where: { id: m.id } });
    assertCan(user, "update", "lead", lead.companyId);
    await db.$transaction(async (tx) => {
      // Make room with one update instead of renumbering the whole column; the board may be
      // filtered, so only the dropped-on card's own position can be trusted.
      const before = m.beforeId ? await tx.lead.findUnique({ where: { id: m.beforeId }, select: { position: true } }) : null;
      let position: number;
      if (before) {
        await tx.lead.updateMany({ where: { stage: m.stage, position: { gte: before.position } }, data: { position: { increment: 1 } } });
        position = before.position;
      } else {
        position = Number((await tx.lead.aggregate({ _max: { position: true }, where: { stage: m.stage } }))._max.position ?? -1) + 1;
      }
      await tx.lead.update({
        where: { id: m.id },
        data: { stage: m.stage, position, lastActivityAt: new Date(), wonAt: m.stage === "WON" ? (lead.wonAt ?? new Date()) : null, lostAt: m.stage === "LOST" ? new Date() : null },
      });
      if (lead.stage !== m.stage) {
        await logActivity(tx, { companyId: lead.companyId, actorId: user.id, verb: "moved", entityType: "LEAD", entityId: lead.id, summary: `${user.name} moved ${lead.name} to ${LEAD_STAGE[m.stage]!.label}` });
        if (lead.ownerId) await notify(tx, { userIds: [lead.ownerId], exceptUserId: user.id, type: "lead_stage", title: `${lead.name} moved to ${LEAD_STAGE[m.stage]!.label}`, link: `/leads?id=${lead.id}` });
      }
    });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/update", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ id: string; input: unknown }>();
    const parsed = leadSchema.safeParse(body.input);
    if (!parsed.success) return c.json<ActionResult>({ ok: false, error: parsed.error.issues[0]!.message });
    const id = z.string().max(64).parse(body.id);
    const lead = await db.lead.findUniqueOrThrow({ where: { id } });
    assertCan(user, "update", "lead", lead.companyId);
    assertCan(user, "update", "lead", parsed.data.companyId);
    const ownerId = parsed.data.ownerId || lead.ownerId;
    await db.$transaction(async (tx) => {
      await tx.lead.update({ where: { id }, data: { ...parsed.data, ownerId, email: parsed.data.email || null, lastActivityAt: new Date() } });
      await logActivity(tx, { companyId: lead.companyId, actorId: user.id, verb: "updated", entityType: "LEAD", entityId: id, summary: `${user.name} updated ${lead.name}` });
      if (ownerId && ownerId !== lead.ownerId) await notify(tx, { userIds: [ownerId], exceptUserId: user.id, type: "lead_assigned", title: `You own a new lead: ${parsed.data.name}`, link: `/leads?id=${id}` });
    });
    return c.json<ActionResult>({ ok: true });
  })
  /** Won lead → client (reusing a linked client) in the lead's company, plus an optional project. */
  .post("/convert", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ id: string; withProject: boolean }>();
    const id = z.string().max(64).parse(body.id);
    const lead = await db.lead.findUniqueOrThrow({ where: { id } });
    assertCan(user, "create", "client", lead.companyId);
    if (lead.stage === "WON" && lead.clientId) return c.json<ActionResult>({ ok: false, error: "This lead was already converted to a client." });
    const clientId = await db.$transaction(async (tx) => {
      const client =
        (lead.clientId && (await tx.client.findUnique({ where: { id: lead.clientId } }))) ||
        (await tx.client.create({ data: { name: lead.name, type: lead.service, ownerId: lead.ownerId ?? user.id, status: "ACTIVE", notes: lead.notes } }));
      await tx.clientCompany.upsert({ where: { clientId_companyId: { clientId: client.id, companyId: lead.companyId } }, create: { clientId: client.id, companyId: lead.companyId }, update: {} });
      if (lead.contactName || lead.email) {
        const has = await tx.clientContact.count({ where: { clientId: client.id } });
        if (!has) await tx.clientContact.create({ data: { clientId: client.id, name: lead.contactName ?? lead.name, email: lead.email, phone: lead.phone, isPrimary: true } });
      }
      if (!lead.clientId) await tx.folder.create({ data: { name: client.name, category: "CLIENT_FILES", parentId: "folder_client_files", clientId: client.id } });
      if (body.withProject) {
        const vmh = lead.companyId === "vmh";
        await tx.project.create({
          data: {
            companyId: lead.companyId, clientId: client.id, name: lead.service, typeLabel: lead.service, category: vmh ? "VIDEO_EDITING" : "WEBSITE_DEVELOPMENT", template: vmh ? "VMH" : "VTH",
            status: vmh ? "NOT_STARTED" : "PLANNING", billingType: vmh ? "MONTHLY_RETAINER" : "FIXED_SCOPE", value: lead.value, startDate: new Date(), members: { create: { userId: lead.ownerId ?? user.id } },
          },
        });
      }
      await tx.lead.update({ where: { id }, data: { stage: "WON", wonAt: lead.wonAt ?? new Date(), clientId: client.id, lastActivityAt: new Date() } });
      await logActivity(tx, { companyId: lead.companyId, actorId: user.id, verb: "converted", entityType: "LEAD", entityId: id, summary: `${user.name} converted ${lead.name} to a client` });
      return client.id;
    });
    return c.json<ActionResult>({ ok: true, id: clientId });
  })
  /** Hard delete, for a lead added by mistake. A lead already converted to a client stays. */
  .post("/delete", async (c) => {
    const user = c.get("user");
    const { leadId } = await c.req.json<{ leadId: string }>();
    const lead = await db.lead.findUniqueOrThrow({ where: { id: z.string().max(64).parse(leadId) } });
    assertCan(user, "delete", "lead", lead.companyId);
    if (lead.clientId) return c.json<ActionResult>({ ok: false, error: `${lead.name} is linked to a client. Mark it Lost instead.` });
    await db.$transaction([
      db.lead.delete({ where: { id: lead.id } }),
      db.activity.create({ data: { companyId: lead.companyId, actorId: user.id, verb: "deleted", entityType: "LEAD", entityId: lead.id, summary: `${user.name} deleted lead ${lead.name}` } }),
    ]);
    return c.json<ActionResult>({ ok: true });
  });
