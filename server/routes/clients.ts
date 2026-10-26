// Ported from app/(app)/clients/{page.tsx,[id]/page.tsx,actions.ts,export/route.ts}.
// Sorting and paging stay on the server, where the RSC did them.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { staffContext, type Env } from "../context";
import { logActivity } from "@/lib/activity";
import { assertCan, can, isMemberOnly, type CurrentUser } from "@/lib/auth/permissions";
import { now, startOfMonthIST } from "@/lib/clock";
import { listClients, logoColor } from "@/lib/clients";
import { invitePortalContact } from "@/lib/clients/portal-invite";
import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { scopedClientWhere } from "@/lib/db/scope";
import { readParams, subScope } from "@/lib/search-params";
import { CLIENT_STATUS } from "@/lib/status";
import { clientSchema, CLIENT_STATUSES } from "@/lib/validation/client";
import type { ActionResult } from "@/lib/validation/result";

const PAGE = 10;

async function loadClient(id: string) {
  return db.client.findUniqueOrThrow({ where: { id: z.string().max(64).parse(id) }, include: { companies: true } });
}

/** The user must be allowed in every company the client belongs to. */
async function assertClient(user: CurrentUser, action: "update" | "delete", id: string) {
  const client = await loadClient(id);
  client.companies.forEach((c) => assertCan(user, action, "client", c.companyId));
  return client;
}

export const clients = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const user = c.get("user");
    const companyIds = c.get("companyIds");
    if (!can(user, "view", "client")) return c.json({ canView: false as const });
    const p = readParams(c.req.query());
    const all = await listClients({ companyIds });
    const archived = p.str("archived") === "1";
    const filtered = await listClients({ companyIds: subScope(companyIds, p.str("co")), q: p.str("q"), status: p.str("status"), tag: p.str("tag"), owner: p.str("owner"), archived });
    const { field, dir } = p.sort(["name", "revenue", "lastActivity"], "lastActivity");
    const key = (x: (typeof filtered)[number]) => (field === "name" ? x.name.toLowerCase() : field === "revenue" ? x.revenue : x.lastActivityAt.getTime());
    filtered.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * (dir === "asc" ? 1 : -1));
    const pageRows = filtered.slice((p.page - 1) * PAGE, p.page * PAGE);
    const [owners, tags] = await Promise.all([
      db.user.findMany({ where: { kind: "STAFF", memberships: { some: { companyId: { in: companyIds } } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      db.tag.findMany({ orderBy: { name: "asc" } }),
    ]);
    return c.json({
      canView: true as const,
      all,
      pageRows,
      total: filtered.length,
      pageSize: PAGE,
      page: p.page,
      archived,
      owners,
      tags,
      scope: c.get("scope"),
      creatable: companyIds.filter((x): x is "vmh" | "vth" => can(user, "create", "client", x)),
      month: startOfMonthIST(now()).toISOString(),
    });
  })
  /** CSV of the filtered client list (opens in Excel). */
  .get("/export", async (c) => {
    const user = c.get("user");
    assertCan(user, "view", "client");
    const q = c.req.query();
    const rows = await listClients({ companyIds: subScope(c.get("companyIds"), q.co ?? null), q: q.q, status: q.status, tag: q.tag, owner: q.owner });
    const csv = toCsv(
      ["Client", "Domain", "Company", "Type", "Status", "Active Projects", "Total Projects", "Total Revenue (INR)", "Owner", "Last Activity"],
      rows.map((r) => [r.name, r.domain, r.companies.join(" + "), r.type, r.status, r.activeProjects, r.totalProjects, r.revenue, r.owner, r.lastActivityAt.toISOString()]),
    );
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="clients.csv"` } });
  })
  .get("/:id", async (c) => {
    const user = c.get("user");
    const companyIds = c.get("companyIds");
    const id = c.req.param("id");
    const client = await db.client.findFirst({
      where: { id, companies: { some: { companyId: { in: companyIds } } } },
      include: {
        owner: { select: { name: true } },
        companies: true,
        contacts: { orderBy: { isPrimary: "desc" } },
        projects: { where: { companyId: { in: companyIds } }, orderBy: { startDate: "desc" } },
        invoices: { where: { companyId: { in: companyIds } }, orderBy: { issueDate: "desc" }, take: 10 },
        files: {
          where: {
            deletedAt: null,
            companyId: { in: companyIds },
            // Same rule as the Files page: members see their own uploads, shares and project files.
            ...(isMemberOnly(user) && { OR: [{ uploadedById: user.id }, { shares: { some: { userId: user.id } } }, { project: { members: { some: { userId: user.id } } } }] }),
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
        },
      },
    });
    if (!client) throw new HTTPException(404, { message: "Client not found." });
    const [activity, notes, invoiced, owners] = await Promise.all([
      db.activity.findMany({ where: { OR: [{ entityType: "CLIENT", entityId: id }, { entityId: { in: client.projects.map((p) => p.id) } }] }, orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { name: true } } } }),
      db.comment.findMany({ where: { entityType: "CLIENT", entityId: id }, orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } }),
      // Every invoice, not just the 10 shown below.
      db.invoice.aggregate({ _sum: { total: true }, where: { clientId: id, companyId: { in: companyIds }, status: { notIn: ["DRAFT", "CANCELLED"] } } }),
      db.user.findMany({ where: { kind: "STAFF", memberships: { some: { companyId: { in: companyIds } } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    return c.json({
      client,
      activity,
      notes,
      owners,
      color: logoColor(client.name),
      billed: Number(invoiced._sum.total ?? 0),
      editable: client.companies.every((x) => can(user, "update", "client", x.companyId)),
      editableCompanies: companyIds.filter((x): x is "vmh" | "vth" => can(user, "update", "client", x)),
    });
  })
  .post("/", async (c) => {
    const user = c.get("user");
    const parsed = clientSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json<ActionResult>({ ok: false, error: parsed.error.issues[0]!.message });
    const { companies, contactName, contactEmail, ...d } = parsed.data;
    companies.forEach((x) => assertCan(user, "create", "client", x));
    const client = await db.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          ...d, ownerId: d.ownerId || user.id, tags: d.tags ?? [],
          companies: { create: companies.map((companyId) => ({ companyId })) },
          contacts: contactName ? { create: { name: contactName, email: contactEmail || null, isPrimary: true } } : undefined,
        },
      });
      // Every client gets a folder under Client Files.
      await tx.folder.create({ data: { name: client.name, category: "CLIENT_FILES", parentId: "folder_client_files", clientId: client.id } });
      await logActivity(tx, { companyId: companies.length === 1 ? companies[0]! : null, actorId: user.id, verb: "created", entityType: "CLIENT", entityId: client.id, summary: `New client added: ${client.name}` });
      return client;
    });
    // Onboarding: the contact gets their own portal login and a link to set a password.
    // A failure here must not undo the client, so it is reported, not thrown — the project's
    // Client Access tab can send it again.
    if (contactEmail) {
      const contact = await db.clientContact.findFirst({ where: { clientId: client.id, isPrimary: true }, select: { id: true } });
      const invited = contact && (await invitePortalContact(contact.id));
      if (invited && !invited.ok) {
        return c.json<ActionResult>({ ok: true, id: client.id, warning: `Client added, but the portal invite failed: ${invited.error}` });
      }
    }
    return c.json<ActionResult>({ ok: true, id: client.id });
  })
  .post("/status", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ ids: string[]; status: string }>();
    const s = z.enum(CLIENT_STATUSES).parse(body.status);
    for (const id of z.array(z.string().max(64)).max(200).parse(body.ids)) {
      const client = await assertClient(user, "update", id);
      if (client.status === s) continue;
      await db.$transaction([
        db.client.update({ where: { id }, data: { status: s, lastActivityAt: new Date() } }),
        db.activity.create({ data: { companyId: client.companies.length === 1 ? client.companies[0]!.companyId : null, actorId: user.id, verb: "status", entityType: "CLIENT", entityId: id, summary: `${user.name} set ${client.name} to ${CLIENT_STATUS[s]!.label}` } }),
      ]);
    }
    return c.json<ActionResult>({ ok: true });
  })
  /** Edit the client's own details. Adds a primary contact when the client has none yet. */
  .post("/update", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ id: string; input: unknown }>();
    const parsed = clientSchema.safeParse(body.input);
    if (!parsed.success) return c.json<ActionResult>({ ok: false, error: parsed.error.issues[0]!.message });
    const client = await assertClient(user, "update", body.id);
    const { companies, contactName, contactEmail, ...d } = parsed.data;
    companies.forEach((x) => assertCan(user, "update", "client", x));
    const removed = client.companies.filter((x) => !companies.includes(x.companyId as "vmh")).map((x) => x.companyId);
    if (removed.length) {
      // Projects and invoices keep their own company, so removing one would leave them
      // pointing at a client that no longer belongs there.
      const stillUsed = await db.project.findFirst({ where: { clientId: client.id, companyId: { in: removed } }, select: { companyId: true } });
      if (stillUsed) return c.json<ActionResult>({ ok: false, error: `${client.name} still has projects in ${stillUsed.companyId.toUpperCase()}.` });
    }
    await db.$transaction(async (tx) => {
      await tx.client.update({ where: { id: client.id }, data: { ...d, ownerId: d.ownerId || client.ownerId, tags: d.tags ?? [], lastActivityAt: new Date() } });
      if (removed.length) await tx.clientCompany.deleteMany({ where: { clientId: client.id, companyId: { in: removed } } });
      for (const companyId of companies) {
        await tx.clientCompany.upsert({ where: { clientId_companyId: { clientId: client.id, companyId } }, create: { clientId: client.id, companyId }, update: {} });
      }
      if (contactName && (await tx.clientContact.count({ where: { clientId: client.id } })) === 0) {
        await tx.clientContact.create({ data: { clientId: client.id, name: contactName, email: contactEmail || null, isPrimary: true } });
      }
      await logActivity(tx, { companyId: companies.length === 1 ? companies[0]! : null, actorId: user.id, verb: "updated", entityType: "CLIENT", entityId: client.id, summary: `${user.name} updated ${d.name}` });
    });
    return c.json<ActionResult>({ ok: true, id: client.id });
  })
  /** Archive hides the client everywhere; restore brings it back (nothing is deleted). */
  .post("/archive", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ ids: string[]; restore?: boolean }>();
    const back = z.boolean().parse(body.restore ?? false);
    for (const id of z.array(z.string().max(64)).max(200).parse(body.ids)) {
      const client = await assertClient(user, "delete", id);
      await db.$transaction([
        db.client.update({ where: { id }, data: { archivedAt: back ? null : new Date() } }),
        db.activity.create({ data: { actorId: user.id, verb: back ? "restored" : "archived", entityType: "CLIENT", entityId: id, summary: `${user.name} ${back ? "restored" : "archived"} ${client.name}` } }),
      ]);
    }
    return c.json<ActionResult>({ ok: true });
  })
  /**
   * Hard delete, for a client added by mistake. Anything with real history behind it —
   * projects, invoices, leads — is refused and should be archived instead.
   */
  .post("/delete", async (c) => {
    const user = c.get("user");
    const { clientId } = await c.req.json<{ clientId: string }>();
    const client = await assertClient(user, "delete", clientId);
    const [projects, invoices, leadCount] = await Promise.all([
      db.project.count({ where: { clientId: client.id } }),
      db.invoice.count({ where: { clientId: client.id } }),
      db.lead.count({ where: { clientId: client.id } }),
    ]);
    const held = [projects && `${projects} project${projects > 1 ? "s" : ""}`, invoices && `${invoices} invoice${invoices > 1 ? "s" : ""}`, leadCount && `${leadCount} lead${leadCount > 1 ? "s" : ""}`].filter(Boolean);
    if (held.length) return c.json<ActionResult>({ ok: false, error: `${client.name} still has ${held.join(" and ")}. Archive it instead, or remove those first.` });
    await db.$transaction([
      db.client.delete({ where: { id: client.id } }),
      db.activity.create({ data: { actorId: user.id, verb: "deleted", entityType: "CLIENT", entityId: client.id, summary: `${user.name} deleted ${client.name}` } }),
    ]);
    return c.json<ActionResult>({ ok: true });
  });
