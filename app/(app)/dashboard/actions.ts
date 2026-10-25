"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity";
import type { ActionResult } from "@/lib/validation/result";

const id = z.string().min(1).max(64);

/** Turns a cross-sell alert into a NEW lead in the other company, prefilled with the client. */
export async function createOpportunity(alertId: string) {
  const { user } = await getRequestContext();
  const alert = await db.crossSellAlert.findUniqueOrThrow({ where: { id: id.parse(alertId) }, include: { client: true } });
  assertCan(user, "create", "lead", alert.toCompanyId);
  if (alert.status !== "OPEN") return;
  await db.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: { companyId: alert.toCompanyId, name: alert.client.name, clientId: alert.clientId, service: alert.toCompanyId === "vth" ? "Website / CRM" : "Video Content", value: 0, stage: "NEW", source: "REFERRAL", ownerId: user.id, notes: `Cross-sell: ${alert.reason}` },
    });
    await tx.crossSellAlert.update({ where: { id: alert.id }, data: { status: "CONVERTED", leadId: lead.id } });
    await logActivity(tx, { companyId: alert.toCompanyId, actorId: user.id, verb: "created", entityType: "LEAD", entityId: lead.id, summary: `${user.name} created a cross-sell opportunity for ${alert.client.name}` });
  });
  refresh();
}

export async function dismissAlert(alertId: string) {
  const { user } = await getRequestContext();
  const alert = await db.crossSellAlert.findUniqueOrThrow({ where: { id: id.parse(alertId) } });
  assertCan(user, "update", "lead", alert.toCompanyId);
  await db.crossSellAlert.update({ where: { id: alert.id }, data: { status: "DISMISSED" } });
  refresh();
}

// ── Notebook ────────────────────────────────────────────────────────────

const noteSchema = z.object({
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(1, "Write something first.").max(4000),
  companyId: z.enum(["vmh", "vth", ""]).optional(),
});

/** Notes are personal: you only ever read, write or delete your own. */
async function myNote(noteId: string) {
  const { user } = await getRequestContext();
  const note = await db.note.findUniqueOrThrow({ where: { id: id.parse(noteId) } });
  if (note.authorId !== user.id) throw new Error("That note belongs to someone else.");
  return note;
}

export async function saveNote(noteId: string | null, input: z.input<typeof noteSchema>): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const { companyId, title, body } = parsed.data;
  const data = { title: title || null, body, companyId: companyId || null };
  if (noteId) {
    await myNote(noteId);
    await db.note.update({ where: { id: noteId }, data });
  } else {
    await db.note.create({ data: { ...data, authorId: user.id } });
  }
  refresh();
  return { ok: true };
}

export async function deleteNote(noteId: string): Promise<ActionResult> {
  const note = await myNote(noteId);
  await db.note.delete({ where: { id: note.id } });
  refresh();
  return { ok: true };
}

export async function pinNote(noteId: string, pinned: boolean): Promise<ActionResult> {
  const note = await myNote(noteId);
  await db.note.update({ where: { id: note.id }, data: { pinned } });
  refresh();
  return { ok: true };
}
