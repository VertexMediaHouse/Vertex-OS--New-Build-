"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity";
import type { ActionResult } from "@/lib/validation/result";

const id = z.string().min(1).max(64);
const STAGES = ["IDEA", "SCRIPTING", "FILMING", "EDITING", "SCHEDULED", "PUBLISHED"] as const;

const contentSchema = z.object({
  title: z.string().trim().min(1, "Give it a title").max(200),
  companyId: z.enum(["vmh", "vth"]),
  channel: z.enum(["YOUTUBE", "INSTAGRAM", "LINKEDIN", "SHORTS", "PODCAST", "OTHER"]).default("YOUTUBE"),
  stage: z.enum(STAGES).default("IDEA"),
  ownerId: z.string().max(64).optional().or(z.literal("")),
  hook: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(5000).optional(),
  shootDate: z.string().optional(),
  publishDate: z.string().optional(),
  link: z.string().trim().max(500).optional(),
});

const day = (s?: string) => (s ? new Date(`${s}T12:00:00+05:30`) : null);

async function itemFor(action: "update" | "delete", itemId: string) {
  const { user } = await getRequestContext();
  const item = await db.contentItem.findUniqueOrThrow({ where: { id: id.parse(itemId) } });
  assertCan(user, action, "content", item.companyId);
  return { user, item };
}

export async function saveContent(itemId: string | null, input: z.input<typeof contentSchema>): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const parsed = contentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const data = {
    title: d.title,
    channel: d.channel,
    stage: d.stage,
    ownerId: d.ownerId || null,
    hook: d.hook || null,
    notes: d.notes || null,
    shootDate: day(d.shootDate),
    publishDate: day(d.publishDate),
    link: d.link || null,
    // Published is the end of the line: stamp it the first time it lands there.
    publishedAt: d.stage === "PUBLISHED" ? new Date() : null,
  };
  if (itemId) {
    const { item } = await itemFor("update", itemId);
    await db.contentItem.update({ where: { id: item.id }, data: { ...data, publishedAt: d.stage === "PUBLISHED" ? (item.publishedAt ?? new Date()) : null } });
  } else {
    assertCan(user, "create", "content", d.companyId);
    const last = await db.contentItem.aggregate({ _max: { position: true }, where: { stage: d.stage } });
    await db.contentItem.create({ data: { ...data, companyId: d.companyId, position: Number(last._max.position ?? -1) + 1 } });
  }
  refresh();
  return { ok: true };
}

/** Drag between stages. Positions order the column, like the task and lead boards. */
export async function moveContent(itemId: string, stage: string, beforeId: string | null) {
  const { user, item } = await itemFor("update", itemId);
  const s = z.enum(STAGES).parse(stage);
  const bId = z.string().max(64).nullable().parse(beforeId);
  await db.$transaction(async (tx) => {
    const before = bId ? await tx.contentItem.findUnique({ where: { id: bId }, select: { position: true } }) : null;
    let position: number;
    if (before) {
      await tx.contentItem.updateMany({ where: { stage: s, position: { gte: before.position } }, data: { position: { increment: 1 } } });
      position = before.position;
    } else {
      position = Number((await tx.contentItem.aggregate({ _max: { position: true }, where: { stage: s } }))._max.position ?? -1) + 1;
    }
    await tx.contentItem.update({
      where: { id: item.id },
      data: { stage: s, position, publishedAt: s === "PUBLISHED" ? (item.publishedAt ?? new Date()) : null },
    });
    if (item.stage !== s) {
      await logActivity(tx, {
        companyId: item.companyId,
        actorId: user.id,
        verb: "moved",
        entityType: "CAMPAIGN",
        entityId: item.id,
        summary: `${user.name} moved "${item.title}" to ${s[0]! + s.slice(1).toLowerCase()}`,
      });
    }
  });
  refresh();
}

export async function deleteContent(itemId: string): Promise<ActionResult> {
  const { item } = await itemFor("delete", itemId);
  await db.contentItem.delete({ where: { id: item.id } });
  refresh();
  return { ok: true };
}
