"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity";
import { clientSchema, CLIENT_STATUSES } from "@/lib/validation/client";
import type { ActionResult } from "@/lib/validation/result";
import { CLIENT_STATUS } from "@/lib/status";

async function loadClient(id: string) {
  return db.client.findUniqueOrThrow({ where: { id: z.string().max(64).parse(id) }, include: { companies: true } });
}

/** The user must be allowed in every company the client belongs to. */
async function assertClient(action: "update" | "delete", id: string) {
  const { user } = await getRequestContext();
  const client = await loadClient(id);
  client.companies.forEach((c) => assertCan(user, action, "client", c.companyId));
  return { user, client };
}

export async function createClient(input: z.input<typeof clientSchema>): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const { companies, contactName, contactEmail, ...d } = parsed.data;
  companies.forEach((c) => assertCan(user, "create", "client", c));
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
  refresh();
  return { ok: true, id: client.id };
}

export async function setClientStatus(ids: string[], status: string): Promise<void> {
  const s = z.enum(CLIENT_STATUSES).parse(status);
  for (const id of z.array(z.string().max(64)).max(200).parse(ids)) {
    const { user, client } = await assertClient("update", id);
    if (client.status === s) continue;
    await db.$transaction([
      db.client.update({ where: { id }, data: { status: s, lastActivityAt: new Date() } }),
      db.activity.create({ data: { companyId: client.companies.length === 1 ? client.companies[0]!.companyId : null, actorId: user.id, verb: "status", entityType: "CLIENT", entityId: id, summary: `${user.name} set ${client.name} to ${CLIENT_STATUS[s]!.label}` } }),
    ]);
  }
  refresh();
}

/** Edit the client's own details. Adds a primary contact when the client has none yet. */
export async function updateClient(id: string, input: z.input<typeof clientSchema>): Promise<ActionResult> {
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const { user, client } = await assertClient("update", id);
  const { companies, contactName, contactEmail, ...d } = parsed.data;
  companies.forEach((c) => assertCan(user, "update", "client", c));
  await db.$transaction(async (tx) => {
    await tx.client.update({ where: { id: client.id }, data: { ...d, ownerId: d.ownerId || client.ownerId, tags: d.tags ?? [], lastActivityAt: new Date() } });
    const removed = client.companies.filter((c) => !companies.includes(c.companyId as "vmh")).map((c) => c.companyId);
    if (removed.length) await tx.clientCompany.deleteMany({ where: { clientId: client.id, companyId: { in: removed } } });
    for (const companyId of companies) {
      await tx.clientCompany.upsert({ where: { clientId_companyId: { clientId: client.id, companyId } }, create: { clientId: client.id, companyId }, update: {} });
    }
    if (contactName && (await tx.clientContact.count({ where: { clientId: client.id } })) === 0) {
      await tx.clientContact.create({ data: { clientId: client.id, name: contactName, email: contactEmail || null, isPrimary: true } });
    }
    await logActivity(tx, { companyId: companies.length === 1 ? companies[0]! : null, actorId: user.id, verb: "updated", entityType: "CLIENT", entityId: client.id, summary: `${user.name} updated ${d.name}` });
  });
  refresh();
  return { ok: true, id: client.id };
}

/** Archive hides the client everywhere; restore brings it back (nothing is deleted). */
export async function archiveClients(ids: string[], restore = false): Promise<void> {
  const back = z.boolean().parse(restore);
  for (const id of z.array(z.string().max(64)).max(200).parse(ids)) {
    const { user, client } = await assertClient("delete", id);
    await db.$transaction([
      db.client.update({ where: { id }, data: { archivedAt: back ? null : new Date() } }),
      db.activity.create({ data: { actorId: user.id, verb: back ? "restored" : "archived", entityType: "CLIENT", entityId: id, summary: `${user.name} ${back ? "restored" : "archived"} ${client.name}` } }),
    ]);
  }
  refresh();
}
