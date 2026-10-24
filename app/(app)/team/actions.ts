"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import { auth } from "@/lib/auth/server";
import { logActivity } from "@/lib/activity";
import type { ActionResult } from "@/lib/validation/result";

const roles = z.enum(["ADMIN", "MANAGER", "MEMBER"]);

/** Invite a staff member: creates the account + memberships and emails a set-password link. */
export async function inviteMember(input: { name: string; email: string; title?: string; capacity: number; memberships: { companyId: string; role: string }[] }): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const d = z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().toLowerCase().email().max(200), title: z.string().trim().max(120).optional(), capacity: z.number().int().min(1).max(80), memberships: z.array(z.object({ companyId: z.enum(["vmh", "vth"]), role: roles })).min(1, "Pick a company") }).safeParse(input);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  d.data.memberships.forEach((m) => assertCan(user, "create", "team", m.companyId));
  if (await db.user.findUnique({ where: { email: d.data.email } })) return { ok: false, error: "Someone with that email already has an account." };
  const member = await db.user.create({ data: { name: d.data.name, email: d.data.email, title: d.data.title, weeklyCapacityHours: d.data.capacity, emailVerified: true, memberships: { create: d.data.memberships } } });
  await auth.api.requestPasswordReset({ body: { email: member.email, redirectTo: "/reset-password" } });
  await logActivity(db, { companyId: null, actorId: user.id, verb: "invited", entityType: "CLIENT", entityId: member.id, summary: `${user.name} invited ${member.name} to the team` });
  refresh();
  return { ok: true, id: member.id };
}

export async function updateMember(userId: string, input: { title?: string; capacity?: number; active?: boolean; memberships?: { companyId: string; role: string }[] }) {
  const { user } = await getRequestContext();
  const target = await db.user.findUniqueOrThrow({ where: { id: z.string().max(64).parse(userId) }, include: { memberships: true } });
  if (target.isOwner) throw new Error("The owner's access can't be changed here.");
  const d = z.object({ title: z.string().max(120).optional(), capacity: z.number().int().min(1).max(80).optional(), active: z.boolean().optional(), memberships: z.array(z.object({ companyId: z.enum(["vmh", "vth"]), role: roles })).optional() }).parse(input);
  [...target.memberships.map((m) => m.companyId), ...(d.memberships?.map((m) => m.companyId) ?? [])].forEach((c) => assertCan(user, "update", "team", c));
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: target.id }, data: { title: d.title, weeklyCapacityHours: d.capacity, active: d.active } });
    if (d.memberships) {
      await tx.membership.deleteMany({ where: { userId: target.id } });
      await tx.membership.createMany({ data: d.memberships.map((m) => ({ ...m, userId: target.id })) });
    }
    if (d.active === false) await tx.session.deleteMany({ where: { userId: target.id } });
  });
  refresh();
}
