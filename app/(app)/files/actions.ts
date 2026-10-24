"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity";
import { canSeeFile } from "@/lib/files/access";
import { MAX_UPLOAD_BYTES, newKey, signKey, uploadUrl, verifyKeyOwner } from "@/lib/storage";
import type { ActionResult } from "@/lib/validation/result";

const id = z.string().min(1).max(64);
const meta = z.object({ name: z.string().trim().min(1).max(255), size: z.number().int().min(0).max(MAX_UPLOAD_BYTES), mime: z.string().max(200) });

async function folderCompany(folderId: string | null | undefined) {
  if (!folderId) return { companyId: null, clientId: null, projectId: null };
  const f = await db.folder.findUniqueOrThrow({ where: { id: folderId } });
  return { companyId: f.companyId, clientId: f.clientId, projectId: f.projectId };
}

/** Step 1: a signed URL the browser PUTs the bytes to (direct to storage). */
export async function requestUpload(input: z.input<typeof meta>) {
  const { user } = await getRequestContext();
  assertCan(user, "create", "file");
  const m = meta.parse(input);
  const key = newKey(m.name);
  return { key, keySig: signKey(key), url: await uploadUrl(key, m.mime || "application/octet-stream") };
}

/** Step 2: record the file (or a new version of an existing one). */
export async function completeUpload(input: z.input<typeof meta> & { key: string; keySig: string; folderId?: string | null; fileId?: string | null; projectId?: string | null; taskId?: string | null }): Promise<ActionResult> {
  const { user } = await getRequestContext();
  assertCan(user, "create", "file");
  const m = meta.parse(input);
  const key = z.string().min(1).max(500).parse(input.key);
  // Only a key this server handed out in step 1 may be recorded.
  if (!verifyKeyOwner(key, z.string().max(200).parse(input.keySig))) return { ok: false, error: "That upload link is not valid." };
  const ext = (m.name.split(".").pop() ?? "").toUpperCase().slice(0, 10);
  if (input.fileId) {
    const existing = await canSeeFile(user, id.parse(input.fileId));
    if (!existing) return { ok: false, error: "File not found." };
    await db.$transaction(async (tx) => {
      await tx.fileVersion.create({ data: { fileId: existing.id, version: existing.version, storageKey: existing.storageKey, size: existing.size, uploadedById: existing.uploadedById, createdAt: existing.updatedAt } });
      await tx.file.update({ where: { id: existing.id }, data: { storageKey: key, size: m.size, version: existing.version + 1, mime: m.mime, uploadedById: user.id } });
      await logActivity(tx, { companyId: existing.companyId, actorId: user.id, verb: "uploaded", entityType: "FILE", entityId: existing.id, summary: `${user.name} uploaded version ${existing.version + 1} of ${existing.name}` });
    });
    refresh();
    return { ok: true, id: existing.id };
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
  refresh();
  return { ok: true, id: file.id };
}

export async function createFolder(name: string, parentId: string | null): Promise<ActionResult> {
  const { user } = await getRequestContext();
  assertCan(user, "create", "file");
  const parent = parentId ? await db.folder.findUniqueOrThrow({ where: { id: id.parse(parentId) } }) : null;
  // A folder inherits its parent company, so check the right to create there.
  if (parent?.companyId) assertCan(user, "create", "file", parent.companyId);
  const f = await db.folder.create({ data: { name: z.string().trim().min(1).max(120).parse(name), parentId: parent?.id ?? null, category: parent?.category ?? "DOCUMENTS", companyId: parent?.companyId, clientId: parent?.clientId, projectId: parent?.projectId } });
  refresh();
  return { ok: true, id: f.id };
}

async function editable(fileId: string) {
  const { user } = await getRequestContext();
  const f = await canSeeFile(user, id.parse(fileId));
  if (!f) throw new Error("File not found.");
  assertCan(user, "update", "file", f.companyId ?? undefined);
  return { user, f };
}

export async function toggleStar(fileId: string) {
  const { f } = await editable(fileId);
  await db.file.update({ where: { id: f.id }, data: { starred: !f.starred } });
  refresh();
}

export async function updateFile(fileId: string, patch: { name?: string; folderId?: string | null; description?: string; status?: string | null; tags?: string[]; sharedWithPortal?: boolean }) {
  const { user, f } = await editable(fileId);
  const d = z.object({ name: z.string().trim().min(1).max(255).optional(), folderId: id.nullable().optional(), description: z.string().max(2000).optional(), status: z.enum(["DRAFT", "REVIEW", "FINAL"]).nullable().optional(), tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(), sharedWithPortal: z.boolean().optional() }).parse(patch);
  await db.$transaction([
    db.file.update({ where: { id: f.id }, data: d }),
    db.activity.create({ data: { companyId: f.companyId, actorId: user.id, verb: "updated", entityType: "FILE", entityId: f.id, summary: `${user.name} updated ${d.name ?? f.name}` } }),
  ]);
  refresh();
}

export async function shareFile(fileId: string, userIds: string[]) {
  const { user, f } = await editable(fileId);
  const ids = z.array(id).max(100).parse(userIds);
  await db.$transaction([
    db.fileShare.deleteMany({ where: { fileId: f.id, userId: { not: null } } }),
    db.fileShare.createMany({ data: ids.map((userId) => ({ fileId: f.id, userId })) }),
    db.activity.create({ data: { companyId: f.companyId, actorId: user.id, verb: "shared", entityType: "FILE", entityId: f.id, summary: `${user.name} shared ${f.name}` } }),
  ]);
  refresh();
}

/** Soft delete: kept in Trash for 30 days, then purged by the files.purge job. */
export async function trashFile(fileId: string, restore = false) {
  const { user, f } = await editable(fileId);
  await db.$transaction([
    db.file.update({ where: { id: f.id }, data: { deletedAt: restore ? null : new Date() } }),
    db.activity.create({ data: { companyId: f.companyId, actorId: user.id, verb: restore ? "restored" : "trashed", entityType: "FILE", entityId: f.id, summary: `${user.name} ${restore ? "restored" : "moved to Trash"} ${f.name}` } }),
  ]);
  refresh();
}
