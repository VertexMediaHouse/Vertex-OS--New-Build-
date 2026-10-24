"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity";

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
