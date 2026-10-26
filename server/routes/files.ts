// Ported from app/(app)/files/{page.tsx,actions.ts} and app/api/files/[id]/download/route.ts.
import { Hono } from "hono";
import { z } from "zod";
import { requireUser, staffContext, type Env } from "../context";
import { logActivity } from "@/lib/activity";
import { assertCan, can, isMemberOnly } from "@/lib/auth/permissions";
import { now } from "@/lib/clock";
import { db, Prisma } from "@/lib/db";
import { canSeeFile } from "@/lib/files/access";
import { formatRelative } from "@/lib/format";
import { downloadUrl, MAX_UPLOAD_BYTES, newKey, signKey, uploadUrl, verifyKeyOwner } from "@/lib/storage";
import type { ActionResult } from "@/lib/validation/result";

const id = z.string().min(1).max(64);
const meta = z.object({ name: z.string().trim().min(1).max(255), size: z.number().int().min(0).max(MAX_UPLOAD_BYTES), mime: z.string().max(200) });

async function folderCompany(folderId: string | null | undefined) {
  if (!folderId) return { companyId: null, clientId: null, projectId: null };
  const f = await db.folder.findUniqueOrThrow({ where: { id: folderId } });
  return { companyId: f.companyId, clientId: f.clientId, projectId: f.projectId };
}

export const files = new Hono<Env>()
  .get("/", ...staffContext, async (c) => {
    const user = c.get("user");
    const companyIds = c.get("companyIds");
    if (!can(user, "view", "file")) return c.json({ denied: true as const });
    const view = c.req.query("view") ?? "all"; // all | recent | starred | shared | trash
    const folderId = c.req.query("folder");
    const q = c.req.query("q");
    const mine = isMemberOnly(user);
    const scopeWhere: Prisma.FileWhereInput = {
      OR: [{ companyId: { in: companyIds } }, { companyId: null }],
      ...(mine && { AND: [{ OR: [{ uploadedById: user.id }, { shares: { some: { userId: user.id } } }, { project: { members: { some: { userId: user.id } } } }] }] }),
    };
    const where: Prisma.FileWhereInput = {
      ...scopeWhere,
      deletedAt: view === "trash" ? { not: null } : null,
      ...(view === "starred" && { starred: true }),
      ...(view === "shared" && { shares: { some: { userId: user.id } } }),
      ...(folderId && view === "all" && { folderId }),
      ...(c.req.query("type") && { ext: c.req.query("type")! }),
      ...(c.req.query("co") && { companyId: c.req.query("co")! }),
      ...(c.req.query("client") && { clientId: c.req.query("client")! }),
      ...(c.req.query("project") && { projectId: c.req.query("project")! }),
      ...(q && { name: { contains: q, mode: "insensitive" } }),
    };
    const sortParam = c.req.query("sort");
    const sort = sortParam === "name" ? { name: "asc" as const } : sortParam === "size" ? { size: "desc" as const } : { updatedAt: "desc" as const };
    const [folders, catCounts, rows, subfolders, types, clients, projects, people] = await Promise.all([
      db.folder.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, parentId: true, category: true, color: true, updatedAt: true } }),
      db.file.groupBy({ by: ["folderId"], _count: true, where: { ...scopeWhere, deletedAt: null } }),
      db.file.findMany({ where, orderBy: sort, take: 60, include: { shares: { include: { user: { select: { name: true, image: true } } } } } }),
      view === "all" ? db.folder.findMany({ where: { parentId: folderId ?? null, deletedAt: null }, orderBy: { name: "asc" } }) : Promise.resolve([]),
      db.file.groupBy({ by: ["ext"], where: { ...scopeWhere, deletedAt: null } }),
      db.client.findMany({ where: { files: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      db.project.findMany({ where: { files: { some: {} }, companyId: { in: companyIds } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      db.user.findMany({ where: { kind: "STAFF", memberships: { some: { companyId: { in: companyIds } } } }, select: { id: true, name: true } }),
    ]);
    return c.json({
      denied: false as const,
      folders, catCounts, files: rows, subfolders, types, clients, projects, people,
      scope: c.get("scope"),
      canCreate: can(user, "create", "file"),
    });
  })
  /** Side-panel payload for one file. */
  .get("/:id/panel", ...staffContext, async (c) => {
    const user = c.get("user");
    const fileId = c.req.param("id");
    // canSeeFile holds the real rule (members: own uploads, shares, their projects' files).
    if (!(await canSeeFile(user, fileId))) return c.json({ found: false as const });
    const f = await db.file.findFirst({ where: { id: fileId, OR: [{ companyId: { in: c.get("companyIds") } }, { companyId: null }] }, include: { folder: { include: { parent: true } }, uploadedBy: { select: { name: true, image: true } }, shares: { include: { user: { select: { id: true, name: true, image: true } } } }, versions: { orderBy: { version: "desc" }, include: { uploadedBy: { select: { name: true } } } } } });
    if (!f) return c.json({ found: false as const });
    const rows = await db.activity.findMany({ where: { entityType: "FILE", entityId: fileId }, orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true, image: true } } } });
    const t = now();
    return c.json({
      found: true as const,
      file: f,
      activity: rows.map((a) => ({ id: a.id, actor: a.actor, summary: a.summary, time: formatRelative(a.createdAt, t) })),
      canUpdate: can(user, "update", "file", f.companyId ?? undefined),
    });
  })
  /** Checks access, then redirects to a short-lived signed storage URL. ?v=N downloads an older version. */
  .get("/:id/download", requireUser, async (c) => {
    const fileId = c.req.param("id");
    const file = await canSeeFile(c.get("user"), fileId);
    if (!file) return c.text("Not found", 404);
    const v = Number(c.req.query("v"));
    const version = v ? await db.fileVersion.findUnique({ where: { fileId_version: { fileId, version: v } } }) : null;
    return c.redirect(await downloadUrl(version?.storageKey ?? file.storageKey, file.name), 302);
  })
  /** Step 1: a signed URL the browser PUTs the bytes to (direct to storage). */
  .post("/upload-url", ...staffContext, async (c) => {
    const user = c.get("user");
    assertCan(user, "create", "file");
    const m = meta.parse(await c.req.json());
    const key = newKey(m.name);
    return c.json({ key, keySig: signKey(key), url: await uploadUrl(key, m.mime || "application/octet-stream") });
  })
  /** Step 2: record the file (or a new version of an existing one). */
  .post("/complete", ...staffContext, async (c) => {
    const user = c.get("user");
    assertCan(user, "create", "file");
    const input = await c.req.json<z.input<typeof meta> & { key: string; keySig: string; folderId?: string | null; fileId?: string | null; projectId?: string | null; taskId?: string | null }>();
    const m = meta.parse(input);
    const key = z.string().min(1).max(500).parse(input.key);
    // Only a key this server handed out in step 1 may be recorded.
    if (!verifyKeyOwner(key, z.string().max(200).parse(input.keySig))) return c.json<ActionResult>({ ok: false, error: "That upload link is not valid." });
    const ext = (m.name.split(".").pop() ?? "").toUpperCase().slice(0, 10);
    if (input.fileId) {
      const existing = await canSeeFile(user, id.parse(input.fileId));
      if (!existing) return c.json<ActionResult>({ ok: false, error: "File not found." });
      await db.$transaction(async (tx) => {
        await tx.fileVersion.create({ data: { fileId: existing.id, version: existing.version, storageKey: existing.storageKey, size: existing.size, uploadedById: existing.uploadedById, createdAt: existing.updatedAt } });
        await tx.file.update({ where: { id: existing.id }, data: { storageKey: key, size: m.size, version: existing.version + 1, mime: m.mime, uploadedById: user.id } });
        await logActivity(tx, { companyId: existing.companyId, actorId: user.id, verb: "uploaded", entityType: "FILE", entityId: existing.id, summary: `${user.name} uploaded version ${existing.version + 1} of ${existing.name}` });
      });
      return c.json<ActionResult>({ ok: true, id: existing.id });
    }
    const ctxIds = await folderCompany(input.folderId);
    const project = input.projectId ? await db.project.findUnique({ where: { id: id.parse(input.projectId) } }) : null;
    const companyId = project?.companyId ?? ctxIds.companyId;
    if (companyId) assertCan(user, "create", "file", companyId);
    const file = await db.$transaction(async (tx) => {
      const f = await tx.file.create({
        data: { name: m.name, mime: m.mime || "application/octet-stream", ext, size: m.size, storageKey: key, folderId: input.folderId || null, companyId, clientId: project?.clientId ?? ctxIds.clientId, projectId: project?.id ?? ctxIds.projectId, taskId: input.taskId || null, uploadedById: user.id },
      });
      await logActivity(tx, { companyId, actorId: user.id, verb: "uploaded", entityType: "FILE", entityId: f.id, summary: `${user.name} uploaded ${f.name}` });
      return f;
    });
    return c.json<ActionResult>({ ok: true, id: file.id });
  })
  .post("/folders", ...staffContext, async (c) => {
    const user = c.get("user");
    assertCan(user, "create", "file");
    const body = await c.req.json<{ name: string; parentId: string | null }>();
    const parent = body.parentId ? await db.folder.findUniqueOrThrow({ where: { id: id.parse(body.parentId) } }) : null;
    // A folder inherits its parent company, so check the right to create there.
    if (parent?.companyId) assertCan(user, "create", "file", parent.companyId);
    const f = await db.folder.create({ data: { name: z.string().trim().min(1).max(120).parse(body.name), parentId: parent?.id ?? null, category: parent?.category ?? "DOCUMENTS", companyId: parent?.companyId, clientId: parent?.clientId, projectId: parent?.projectId } });
    return c.json<ActionResult>({ ok: true, id: f.id });
  })
  .post("/:id/star", ...staffContext, async (c) => {
    const f = await editable(c.get("user"), c.req.param("id"));
    await db.file.update({ where: { id: f.id }, data: { starred: !f.starred } });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/:id/update", ...staffContext, async (c) => {
    const user = c.get("user");
    const f = await editable(user, c.req.param("id"));
    const d = z.object({ name: z.string().trim().min(1).max(255).optional(), folderId: id.nullable().optional(), description: z.string().max(2000).optional(), status: z.enum(["DRAFT", "REVIEW", "FINAL"]).nullable().optional(), tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(), sharedWithPortal: z.boolean().optional() }).parse(await c.req.json());
    await db.$transaction([
      db.file.update({ where: { id: f.id }, data: d }),
      db.activity.create({ data: { companyId: f.companyId, actorId: user.id, verb: "updated", entityType: "FILE", entityId: f.id, summary: `${user.name} updated ${d.name ?? f.name}` } }),
    ]);
    return c.json<ActionResult>({ ok: true });
  })
  .post("/:id/share", ...staffContext, async (c) => {
    const user = c.get("user");
    const f = await editable(user, c.req.param("id"));
    const ids = z.array(id).max(100).parse((await c.req.json<{ userIds: string[] }>()).userIds);
    await db.$transaction([
      db.fileShare.deleteMany({ where: { fileId: f.id, userId: { not: null } } }),
      db.fileShare.createMany({ data: ids.map((userId) => ({ fileId: f.id, userId })) }),
      db.activity.create({ data: { companyId: f.companyId, actorId: user.id, verb: "shared", entityType: "FILE", entityId: f.id, summary: `${user.name} shared ${f.name}` } }),
    ]);
    return c.json<ActionResult>({ ok: true });
  })
  /** Soft delete: kept in Trash for 30 days, then purged by the files.purge job. */
  .post("/:id/trash", ...staffContext, async (c) => {
    const user = c.get("user");
    const f = await editable(user, c.req.param("id"));
    const restore = (await c.req.json<{ restore?: boolean }>()).restore ?? false;
    await db.$transaction([
      db.file.update({ where: { id: f.id }, data: { deletedAt: restore ? null : new Date() } }),
      db.activity.create({ data: { companyId: f.companyId, actorId: user.id, verb: restore ? "restored" : "trashed", entityType: "FILE", entityId: f.id, summary: `${user.name} ${restore ? "restored" : "moved to Trash"} ${f.name}` } }),
    ]);
    return c.json<ActionResult>({ ok: true });
  });

async function editable(user: Parameters<typeof canSeeFile>[0], fileId: string) {
  const f = await canSeeFile(user, id.parse(fileId));
  if (!f) throw new Error("File not found.");
  assertCan(user, "update", "file", f.companyId ?? undefined);
  return f;
}
