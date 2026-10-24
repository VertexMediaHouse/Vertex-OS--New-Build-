"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestContext } from "@/lib/auth/context";
import { allowedCompanyIds, assertCan, can } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity";
import { audienceSchema, resolveAudience, stepSchema } from "@/lib/campaigns";
import type { ActionResult } from "@/lib/validation/result";

const id = z.string().min(1).max(64);

export async function createCampaign(input: { name: string; companyId: string; audience: z.input<typeof audienceSchema>; steps: z.input<typeof stepSchema>[]; scheduledAt?: string; activate: boolean }): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const d = z.object({ name: z.string().trim().min(1).max(160), companyId: z.enum(["vmh", "vth", ""]), audience: audienceSchema, steps: z.array(stepSchema).min(1).max(10), scheduledAt: z.string().optional(), activate: z.boolean() }).safeParse(input);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  assertCan(user, "create", "campaign", d.data.companyId || undefined);
  // The audience companies come from the form, so they are clamped to the companies this
  // user may campaign for: a VMH-only manager can never reach VTH contacts.
  const allowed = (d.data.companyId ? [d.data.companyId] : allowedCompanyIds(user)).filter((c) => can(user, "create", "campaign", c));
  const audience = { ...d.data.audience, companies: allowed.map((c) => c.toUpperCase() as "VMH" | "VTH") };
  const recipients = await resolveAudience(db, audience);
  if (!recipients.length) return { ok: false, error: "No contacts with an email match that audience." };
  const c = await db.emailCampaign.create({
    data: {
      name: d.data.name, companyId: d.data.companyId || null, subject: d.data.steps[0]!.subject, audienceFilter: audience, steps: d.data.steps, status: d.data.activate ? "ACTIVE" : "DRAFT",
      scheduledAt: d.data.scheduledAt ? new Date(d.data.scheduledAt) : null,
      recipients: { createMany: { data: recipients.map((r) => ({ email: r.email, name: r.name, leadId: r.leadId, clientId: r.clientId })), skipDuplicates: true } },
    },
  });
  await logActivity(db, { companyId: c.companyId, actorId: user.id, verb: "created", entityType: "CAMPAIGN", entityId: c.id, summary: `${user.name} created campaign ${c.name} (${recipients.length} recipients)` });
  refresh();
  return { ok: true, id: c.id };
}

export async function setCampaignStatus(campaignId: string, status: "ACTIVE" | "PAUSED" | "COMPLETED") {
  const { user } = await getRequestContext();
  const c = await db.emailCampaign.findUniqueOrThrow({ where: { id: id.parse(campaignId) } });
  assertCan(user, "update", "campaign", c.companyId ?? undefined);
  await db.emailCampaign.update({ where: { id: c.id }, data: { status: z.enum(["ACTIVE", "PAUSED", "COMPLETED"]).parse(status) } });
  refresh();
}

/** Reply received: stop the sequence for them and create/advance their lead. Meeting booked: count it. */
export async function markRecipient(recipientId: string, what: "replied" | "meeting") {
  const { user } = await getRequestContext();
  const r = await db.campaignRecipient.findUniqueOrThrow({ where: { id: id.parse(recipientId) }, include: { campaign: true } });
  assertCan(user, "update", "campaign", r.campaign.companyId ?? undefined);
  await db.$transaction(async (tx) => {
    if (what === "replied" && !r.repliedAt) {
      await tx.campaignRecipient.update({ where: { id: r.id }, data: { repliedAt: new Date(), status: "REPLIED" } });
      await tx.emailCampaign.update({ where: { id: r.campaignId }, data: { replyCount: { increment: 1 } } });
      const companyId = r.campaign.companyId ?? "vmh";
      if (r.leadId) await tx.lead.updateMany({ where: { id: r.leadId, stage: "NEW" }, data: { stage: "CONTACTED", lastActivityAt: new Date() } });
      else await tx.lead.create({ data: { companyId, name: r.name ?? r.email, email: r.email, service: "From campaign", value: 0, stage: "CONTACTED", source: "EMAIL", ownerId: user.id, clientId: r.clientId, notes: `Replied to ${r.campaign.name}` } });
    }
    if (what === "meeting" && !r.meetingBookedAt) {
      await tx.campaignRecipient.update({ where: { id: r.id }, data: { meetingBookedAt: new Date() } });
      await tx.emailCampaign.update({ where: { id: r.campaignId }, data: { meetingsCount: { increment: 1 } } });
    }
  });
  refresh();
}
