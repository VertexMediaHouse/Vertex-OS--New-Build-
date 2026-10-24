"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import { logActivity, notify } from "@/lib/activity";
import { LEAD_STAGE } from "@/lib/status";
import type { ActionResult } from "@/lib/validation/result";
import { leadSchema, STAGES } from "@/lib/validation/lead";


export async function createLead(input: z.input<typeof leadSchema>): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  assertCan(user, "create", "lead", d.companyId);
  const lead = await db.$transaction(async (tx) => {
    const lead = await tx.lead.create({ data: { ...d, ownerId: d.ownerId || user.id, email: d.email || null, stage: "NEW" } });
    await logActivity(tx, { companyId: d.companyId, actorId: user.id, verb: "created", entityType: "LEAD", entityId: lead.id, summary: `New lead added: ${lead.name}` });
    if (lead.ownerId !== user.id) await notify(tx, { userIds: [lead.ownerId!], type: "lead_assigned", title: `You own a new lead: ${lead.name}`, link: `/leads?id=${lead.id}` });
    return lead;
  });
  refresh();
  return { ok: true, id: lead.id };
}

const moveSchema = z.object({ id: z.string().max(64), stage: z.enum(STAGES), index: z.number().int().min(0).max(10_000) });

/** Kanban drop: change stage and position. Positions in the target column are renumbered. */
export async function moveLead(id: string, stage: string, index: number): Promise<void> {
  const { user } = await getRequestContext();
  const m = moveSchema.parse({ id, stage, index });
  const lead = await db.lead.findUniqueOrThrow({ where: { id: m.id } });
  assertCan(user, "update", "lead", lead.companyId);
  await db.$transaction(async (tx) => {
    const column = await tx.lead.findMany({ where: { stage: m.stage, id: { not: m.id } }, orderBy: { position: "asc" }, select: { id: true } });
    column.splice(Math.min(m.index, column.length), 0, { id: m.id });
    await Promise.all(column.map((c, i) => tx.lead.update({ where: { id: c.id }, data: { position: i } })));
    await tx.lead.update({
      where: { id: m.id },
      data: { stage: m.stage, lastActivityAt: new Date(), wonAt: m.stage === "WON" ? (lead.wonAt ?? new Date()) : null, lostAt: m.stage === "LOST" ? new Date() : null },
    });
    if (lead.stage !== m.stage) {
      await logActivity(tx, { companyId: lead.companyId, actorId: user.id, verb: "moved", entityType: "LEAD", entityId: lead.id, summary: `${user.name} moved ${lead.name} to ${LEAD_STAGE[m.stage]!.label}` });
      if (lead.ownerId) await notify(tx, { userIds: [lead.ownerId], exceptUserId: user.id, type: "lead_stage", title: `${lead.name} moved to ${LEAD_STAGE[m.stage]!.label}`, link: `/leads?id=${lead.id}` });
    }
  });
  refresh();
}

export async function updateLead(id: string, input: z.input<typeof leadSchema>): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const lead = await db.lead.findUniqueOrThrow({ where: { id: z.string().max(64).parse(id) } });
  assertCan(user, "update", "lead", lead.companyId);
  assertCan(user, "update", "lead", parsed.data.companyId);
  await db.$transaction(async (tx) => {
    await tx.lead.update({ where: { id }, data: { ...parsed.data, ownerId: parsed.data.ownerId || lead.ownerId, email: parsed.data.email || null, lastActivityAt: new Date() } });
    await logActivity(tx, { companyId: lead.companyId, actorId: user.id, verb: "updated", entityType: "LEAD", entityId: id, summary: `${user.name} updated ${lead.name}` });
  });
  refresh();
  return { ok: true };
}

/** Won lead → client (reusing a linked client) in the lead's company, plus an optional project. */
export async function convertLead(id: string, withProject: boolean): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const lead = await db.lead.findUniqueOrThrow({ where: { id: z.string().max(64).parse(id) } });
  assertCan(user, "create", "client", lead.companyId);
  const clientId = await db.$transaction(async (tx) => {
    const client =
      (lead.clientId && (await tx.client.findUnique({ where: { id: lead.clientId } }))) ||
      (await tx.client.create({ data: { name: lead.name, type: lead.service, ownerId: lead.ownerId ?? user.id, status: "ACTIVE", notes: lead.notes } }));
    await tx.clientCompany.upsert({ where: { clientId_companyId: { clientId: client.id, companyId: lead.companyId } }, create: { clientId: client.id, companyId: lead.companyId }, update: {} });
    if (lead.contactName || lead.email) {
      const has = await tx.clientContact.count({ where: { clientId: client.id } });
      if (!has) await tx.clientContact.create({ data: { clientId: client.id, name: lead.contactName ?? lead.name, email: lead.email, phone: lead.phone, isPrimary: true } });
    }
    await tx.folder.create({ data: { name: client.name, category: "CLIENT_FILES", parentId: "folder_client_files", clientId: client.id } }).catch(() => undefined);
    if (withProject) {
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
  refresh();
  return { ok: true, id: clientId };
}
