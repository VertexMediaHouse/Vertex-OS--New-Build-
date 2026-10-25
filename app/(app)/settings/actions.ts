"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestContext, getStaffUser } from "@/lib/auth/context";
import { assertCan, RESOURCES } from "@/lib/auth/permissions";
import { companySettingsSchema, parseCompanySettings } from "@/lib/settings";
import type { ActionResult } from "@/lib/validation/result";

export async function updateProfile(input: { name: string; timezone: string }): Promise<ActionResult> {
  const user = await getStaffUser();
  const d = z.object({ name: z.string().trim().min(1).max(120), timezone: z.string().max(60).refine((tz) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } }, "Unknown timezone") }).safeParse(input);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  await db.user.update({ where: { id: user.id }, data: d.data });
  refresh();
  return { ok: true };
}

const companySchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).optional(),
  gstin: z.string().trim().toUpperCase().regex(/^$|^[0-9]{2}[A-Z0-9]{13}$/, "GSTIN should be 15 characters").optional(),
  invoicePrefix: z.string().trim().min(1).max(10).regex(/^[A-Z0-9-]+$/i),
  nextInvoiceNumber: z.coerce.number().int().min(1).max(1_000_000),
  currency: z.enum(["INR", "USD"]),
  upi: z.string().trim().max(120).optional(),
  accountName: z.string().trim().max(120).optional(),
  accountNumber: z.string().trim().max(40).optional(),
  ifsc: z.string().trim().max(20).optional(),
  settings: companySettingsSchema,
});

export async function updateCompany(companyId: string, input: z.input<typeof companySchema>): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const id = z.enum(["vmh", "vth"]).parse(companyId);
  assertCan(user, "update", "settings", id);
  const d = companySchema.safeParse(input);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  const { upi, accountName, accountNumber, ifsc, settings, ...rest } = d.data;
  const current = await db.company.findUniqueOrThrow({ where: { id } });
  const maxSeq = await db.invoice.aggregate({ _max: { seq: true }, where: { companyId: id } });
  if (rest.nextInvoiceNumber <= (maxSeq._max.seq ?? 0)) return { ok: false, error: `Next number must be above ${maxSeq._max.seq} (already used).` };
  await db.company.update({ where: { id }, data: { ...rest, gstin: rest.gstin || null, bankDetails: { upi, accountName, accountNumber, ifsc }, settings: { ...parseCompanySettings(current.settings), ...settings } } });
  await db.activity.create({ data: { companyId: id, actorId: user.id, verb: "settings", entityType: "CLIENT", entityId: id, summary: `${user.name} updated ${rest.name} settings` } });
  refresh();
  return { ok: true };
}

/**
 * Which modules one person may open in one company. An empty list means "whatever their
 * role allows"; any list narrows it. Only someone who can edit that company's settings
 * may change it, and nobody can widen a role beyond what the role already permits.
 */
export async function setMemberModules(userId: string, companyId: string, modules: string[]): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const co = z.enum(["vmh", "vth"]).parse(companyId);
  assertCan(user, "update", "settings", co);
  const target = z.string().min(1).max(64).parse(userId);
  if (target === user.id) return { ok: false, error: "You can't change your own modules." };
  const picked = z.array(z.enum(RESOURCES)).max(RESOURCES.length).parse(modules);
  const member = await db.user.findUnique({ where: { id: target }, select: { isOwner: true } });
  if (member?.isOwner) return { ok: false, error: "The owner always sees everything." };
  await db.membership.update({
    where: { userId_companyId: { userId: target, companyId: co } },
    // All modules ticked is the same as no restriction; store it as none.
    data: { modules: picked.length === RESOURCES.length ? [] : picked },
  });
  refresh();
  return { ok: true };
}
