"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import type { ActionResult } from "@/lib/validation/result";

export async function createEvent(input: { title: string; type: string; companyId: string; date: string; start: string; minutes: number; clientId?: string; projectId?: string }): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const d = z.object({ title: z.string().trim().min(1).max(160), type: z.enum(["CALL", "REVIEW", "FOLLOW_UP", "MEETING"]), companyId: z.enum(["vmh", "vth", ""]), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.string().regex(/^\d{2}:\d{2}$/), minutes: z.number().int().min(5).max(600), clientId: z.string().max(64).optional(), projectId: z.string().max(64).optional() }).safeParse(input);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  assertCan(user, "create", "task", d.data.companyId || undefined);
  const start = new Date(`${d.data.date}T${d.data.start}:00+05:30`);
  await db.calendarEvent.create({ data: { title: d.data.title, type: d.data.type, companyId: d.data.companyId || null, start, end: new Date(start.getTime() + d.data.minutes * 60_000), clientId: d.data.clientId || null, projectId: d.data.projectId || null, attendeeIds: [user.id] } });
  refresh();
  return { ok: true };
}
