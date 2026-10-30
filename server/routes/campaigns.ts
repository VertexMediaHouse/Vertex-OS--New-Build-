// Ported from app/(app)/campaigns/{page.tsx,new/page.tsx,actions.ts}.
import { Hono } from "hono";
import { z } from "zod";
import { staffContext, type Env } from "../context";
import { logActivity } from "@/lib/activity";
import { allowedCompanyIds, assertCan, can } from "@/lib/auth/permissions";
import { audienceSchema, resolveAudience, stepSchema } from "@/lib/campaigns";
import { db } from "@/lib/db";
import type { ActionResult } from "@/lib/validation/result";

const id = z.string().min(1).max(64);

export const campaigns = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const user = c.get("user");
    if (!can(user, "view", "campaign")) return c.json({ canView: false as const });
    const list = await db.emailCampaign.findMany({ where: { OR: [{ companyId: { in: c.get("companyIds") } }, { companyId: null }] }, orderBy: { createdAt: "desc" } });
    return c.json({ canView: true as const, list, canCreate: can(user, "create", "campaign") });
  })
  /** Companies the builder may campaign for. */
  .get("/options", (c) => {
    const user = c.get("user");
    return c.json({ companies: c.get("companyIds").filter((x): x is "vmh" | "vth" => can(user, "create", "campaign", x)) });
  })
  .get("/:id", async (c) => {
    const campaign = await db.emailCampaign.findUnique({ where: { id: c.req.param("id") }, include: { recipients: { orderBy: { sentAt: "desc" }, take: 100 } } });
    return c.json({ campaign, canDelete: campaign ? can(c.get("user"), "delete", "campaign", campaign.companyId ?? undefined) : false });
  })
  .post("/", async (c) => {
    const user = c.get("user");
    const d = z.object({ name: z.string().trim().min(1).max(160), companyId: z.enum(["vmh", "vth", ""]), audience: audienceSchema, steps: z.array(stepSchema).min(1).max(10), scheduledAt: z.string().optional(), activate: z.boolean() }).safeParse(await c.req.json());
    if (!d.success) return c.json<ActionResult>({ ok: false, error: d.error.issues[0]!.message });
    assertCan(user, "create", "campaign", d.data.companyId || undefined);
    // The audience companies come from the form, so they are clamped to the companies this
    // user may campaign for: a VMH-only manager can never reach VTH contacts.
    const allowed = (d.data.companyId ? [d.data.companyId] : allowedCompanyIds(user)).filter((x) => can(user, "create", "campaign", x));
    const audience = { ...d.data.audience, companies: allowed.map((x) => x.toUpperCase() as "VMH" | "VTH") };
    const recipients = await resolveAudience(db, audience);
    if (!recipients.length) return c.json<ActionResult>({ ok: false, error: "No contacts with an email match that audience." });
    const created = await db.emailCampaign.create({
      data: {
        name: d.data.name, companyId: d.data.companyId || null, subject: d.data.steps[0]!.subject, audienceFilter: audience, steps: d.data.steps, status: d.data.activate ? "ACTIVE" : "DRAFT",
        scheduledAt: d.data.scheduledAt ? new Date(d.data.scheduledAt) : null,
        recipients: { createMany: { data: recipients.map((r) => ({ email: r.email, name: r.name, leadId: r.leadId, clientId: r.clientId })), skipDuplicates: true } },
      },
    });
    await logActivity(db, { companyId: created.companyId, actorId: user.id, verb: "created", entityType: "CAMPAIGN", entityId: created.id, summary: `${user.name} created campaign ${created.name} (${recipients.length} recipients)` });
    return c.json<ActionResult>({ ok: true, id: created.id });
  })
  .post("/status", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ campaignId: string; status: "ACTIVE" | "PAUSED" | "COMPLETED" }>();
    const campaign = await db.emailCampaign.findUniqueOrThrow({ where: { id: id.parse(body.campaignId) } });
    assertCan(user, "update", "campaign", campaign.companyId ?? undefined);
    await db.emailCampaign.update({ where: { id: campaign.id }, data: { status: z.enum(["ACTIVE", "PAUSED", "COMPLETED"]).parse(body.status) } });
    return c.json<ActionResult>({ ok: true });
  })
  /** Reply received: stop the sequence for them and create/advance their lead. Meeting booked: count it. */
  .post("/recipient", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ recipientId: string; what: "replied" | "meeting" }>();
    const r = await db.campaignRecipient.findUniqueOrThrow({ where: { id: id.parse(body.recipientId) }, include: { campaign: true } });
    assertCan(user, "update", "campaign", r.campaign.companyId ?? undefined);
    await db.$transaction(async (tx) => {
      if (body.what === "replied" && !r.repliedAt) {
        await tx.campaignRecipient.update({ where: { id: r.id }, data: { repliedAt: new Date(), status: "REPLIED" } });
        await tx.emailCampaign.update({ where: { id: r.campaignId }, data: { replyCount: { increment: 1 } } });
        const companyId = r.campaign.companyId ?? "vmh";
        if (r.leadId) await tx.lead.updateMany({ where: { id: r.leadId, stage: "NEW" }, data: { stage: "CONTACTED", lastActivityAt: new Date() } });
        else await tx.lead.create({ data: { companyId, name: r.name ?? r.email, email: r.email, service: "From campaign", value: 0, stage: "CONTACTED", source: "EMAIL", ownerId: user.id, clientId: r.clientId, notes: `Replied to ${r.campaign.name}` } });
      }
      if (body.what === "meeting" && !r.meetingBookedAt) {
        await tx.campaignRecipient.update({ where: { id: r.id }, data: { meetingBookedAt: new Date() } });
        await tx.emailCampaign.update({ where: { id: r.campaignId }, data: { meetingsCount: { increment: 1 } } });
      }
    });
    return c.json<ActionResult>({ ok: true });
  })

  .post("/delete", async (c) => {
    const user = c.get("user");
    const { campaignId } = await c.req.json<{ campaignId: string }>();
    const campaign = await db.emailCampaign.findUniqueOrThrow({ where: { id: id.parse(campaignId) } });
    assertCan(user, "delete", "campaign", campaign.companyId ?? undefined);
    // A campaign that has gone out is a record of what was sent to whom; deleting it
    // would drop the recipients' send/open/reply history with it.
    if (campaign.sentCount > 0 || campaign.status === "ACTIVE") {
      return c.json<ActionResult>({ ok: false, error: `${campaign.name} has already been sent to ${campaign.sentCount} recipient${campaign.sentCount === 1 ? "" : "s"}. Pause it instead.` });
    }
    await db.$transaction([
      db.campaignRecipient.deleteMany({ where: { campaignId: campaign.id } }),
      db.emailCampaign.delete({ where: { id: campaign.id } }),
      db.activity.create({ data: { companyId: campaign.companyId, actorId: user.id, verb: "deleted", entityType: "CAMPAIGN", entityId: campaign.id, summary: `${user.name} deleted campaign ${campaign.name}` } }),
    ]);
    return c.json<ActionResult>({ ok: true });
  });
