import "server-only";
import { z } from "zod";
import type { PrismaClient } from "@/lib/db/generated/client";
import { sendEmail } from "@/lib/email";

export const stepSchema = z.object({ subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(20_000), delayDays: z.number().int().min(0).max(90) });
export const audienceSchema = z.object({
  source: z.enum(["leads", "clients"]),
  companies: z.array(z.enum(["VMH", "VTH"])).default([]),
  stages: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});
export type Audience = z.infer<typeof audienceSchema>;

/** {{firstName}} / {{company}} / {{name}} merge fields. Values are HTML-escaped. */
export function merge(template: string, vars: Record<string, string | null | undefined>): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => esc(vars[k] ?? ""));
}

/** Contacts matching the audience filter: [{ email, name, leadId?, clientId? }]. */
export async function resolveAudience(db: PrismaClient, a: Audience) {
  const companyIds = a.companies.map((c) => c.toLowerCase());
  if (a.source === "leads") {
    const leads = await db.lead.findMany({ where: { email: { not: null }, ...(companyIds.length && { companyId: { in: companyIds } }), ...(a.stages.length && { stage: { in: a.stages as never } }) }, select: { id: true, email: true, contactName: true, name: true } });
    return leads.map((l) => ({ email: l.email!, name: l.contactName ?? l.name, company: l.name, leadId: l.id, clientId: null as string | null }));
  }
  const contacts = await db.clientContact.findMany({ where: { email: { not: null }, isPrimary: true, client: { archivedAt: null, ...(companyIds.length && { companies: { some: { companyId: { in: companyIds } } } }), ...(a.tags.length && { tags: { hasSome: a.tags } }) } }, select: { email: true, name: true, clientId: true, client: { select: { name: true } } } });
  return contacts.map((c) => ({ email: c.email!, name: c.name, company: c.client.name, leadId: null as string | null, clientId: c.clientId }));
}

/** Every 10 minutes: send each active campaign's due step to recipients who haven't replied. */
export async function sendDueCampaignSteps(db: PrismaClient, now: Date): Promise<number> {
  const campaigns = await db.emailCampaign.findMany({ where: { status: "ACTIVE", OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }] } });
  // Stop well before the next run (every 10 minutes) so two runs can't overlap and send
  // the same step twice. Recipients are ordered oldest-first, so the next run continues.
  const until = Date.now() + 5 * 60_000;
  let sent = 0;
  for (const c of campaigns) {
    if (Date.now() > until) break;
    const steps = z.array(stepSchema).catch([]).parse(c.steps);
    // Never-sent recipients first, so a list larger than one batch still goes out in order.
    const recipients = await db.campaignRecipient.findMany({
      where: { campaignId: c.id, status: { in: ["QUEUED", "SENT", "OPENED"] }, step: { lt: steps.length } },
      orderBy: { sentAt: { sort: "asc", nulls: "first" } },
      take: 200,
      include: { lead: { select: { name: true } }, client: { select: { name: true } } },
    });
    for (const r of recipients) {
      if (Date.now() > until) break;
      const step = steps[r.step]!;
      const dueAt = r.sentAt ? new Date(r.sentAt.getTime() + step.delayDays * 86_400_000) : now;
      if (r.step > 0 && dueAt > now) continue;
      const vars = { firstName: r.name?.split(" ")[0], name: r.name, company: r.lead?.name ?? r.client?.name ?? r.name };
      const pixel = `<img src="${process.env.BETTER_AUTH_URL ?? ""}/api/track/open/${r.id}" width="1" height="1" alt="">`;
      try {
        await sendEmail({ to: r.email, subject: merge(step.subject, vars), html: `${merge(step.body, vars).replace(/\n/g, "<br>")}${pixel}` });
        await db.campaignRecipient.update({ where: { id: r.id }, data: { status: r.status === "QUEUED" ? "SENT" : r.status, sentAt: now, step: r.step + 1 } });
        if (r.step === 0) await db.emailCampaign.update({ where: { id: c.id }, data: { sentCount: { increment: 1 } } });
        sent++;
        // shortcut: fixed pause to stay under Resend's rate limit, fine for a few hundred
        // recipients per run; read the limit from the response headers for bigger lists.
        await new Promise((done) => setTimeout(done, 600));
      } catch (e) {
        // A send error is usually ours (rate limit, network), not a dead address, so the
        // next run retries. Only the provider's bounce webhook should set BOUNCED.
        console.error(`[campaigns] send failed for ${r.email}`, e);
      }
    }
  }
  return sent;
}
