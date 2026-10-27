// Ported from app/(app)/settings/{page.tsx,actions.ts}.
import { Hono } from "hono";
import { z } from "zod";
import { staffContext, type Env } from "../context";
import { googleEnabled } from "@/lib/auth/config";
import { assertCan, can, RESOURCES } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { companySettingsSchema, parseCompanySettings } from "@/lib/settings";
import { storageDriver } from "@/lib/storage";
import type { ActionResult } from "@/lib/validation/result";

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

export const settings = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const user = c.get("user");
    if (!can(user, "view", "settings")) return c.json({ allowed: false as const });
    const me = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    const editable = c.get("companyIds").filter((x) => can(user, "update", "settings", x));
    const companies = await db.company.findMany({ where: { id: { in: editable } }, orderBy: { code: "asc" } });
    // Everyone an admin could narrow: staff in a company they control, minus themselves and the owner.
    const staff = editable.length
      ? await db.user.findMany({
          where: { kind: "STAFF", isOwner: false, id: { not: user.id }, memberships: { some: { companyId: { in: editable } } } },
          select: { id: true, name: true, email: true, memberships: { select: { companyId: true, role: true, modules: true } } },
          orderBy: { createdAt: "asc" },
        })
      : [];
    return c.json({
      allowed: true as const,
      me: { name: me.name, timezone: me.timezone },
      editable,
      staff,
      resources: RESOURCES,
      companies: companies.map((x) => {
        const bank = (x.bankDetails ?? {}) as Record<string, string | undefined>;
        return { id: x.id, name: x.name, address: x.address, gstin: x.gstin, invoicePrefix: x.invoicePrefix, nextInvoiceNumber: x.nextInvoiceNumber, currency: x.currency, bank, settings: parseCompanySettings(x.settings) };
      }),
      integrations: {
        email: Boolean(process.env.RESEND_API_KEY),
        storageDriver,
        google: googleEnabled,
        googleSheets: Boolean(process.env.GOOGLE_SHEET_WEBAPP_URL),
      },
    });
  })
  .post("/profile", async (c) => {
    const user = c.get("user");
    const d = z.object({ name: z.string().trim().min(1).max(120), timezone: z.string().max(60).refine((tz) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } }, "Unknown timezone") }).safeParse(await c.req.json());
    if (!d.success) return c.json<ActionResult>({ ok: false, error: d.error.issues[0]!.message });
    await db.user.update({ where: { id: user.id }, data: d.data });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/company", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ companyId: string; input: z.input<typeof companySchema> }>();
    const id = z.enum(["vmh", "vth"]).parse(body.companyId);
    assertCan(user, "update", "settings", id);
    const d = companySchema.safeParse(body.input);
    if (!d.success) return c.json<ActionResult>({ ok: false, error: d.error.issues[0]!.message });
    const { upi, accountName, accountNumber, ifsc, settings: s, ...rest } = d.data;
    const current = await db.company.findUniqueOrThrow({ where: { id } });
    const maxSeq = await db.invoice.aggregate({ _max: { seq: true }, where: { companyId: id } });
    if (rest.nextInvoiceNumber <= (maxSeq._max.seq ?? 0)) return c.json<ActionResult>({ ok: false, error: `Next number must be above ${maxSeq._max.seq} (already used).` });
    await db.company.update({ where: { id }, data: { ...rest, gstin: rest.gstin || null, bankDetails: { upi, accountName, accountNumber, ifsc }, settings: { ...parseCompanySettings(current.settings), ...s } } });
    await db.activity.create({ data: { companyId: id, actorId: user.id, verb: "settings", entityType: "CLIENT", entityId: id, summary: `${user.name} updated ${rest.name} settings` } });
    return c.json<ActionResult>({ ok: true });
  })
  /**
   * Which modules one person may open in one company. An empty list means "whatever their
   * role allows"; any list narrows it. Only someone who can edit that company's settings
   * may change it, and nobody can widen a role beyond what the role already permits.
   */
  .post("/modules", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ userId: string; companyId: string; modules: string[] }>();
    const co = z.enum(["vmh", "vth"]).parse(body.companyId);
    assertCan(user, "update", "settings", co);
    const target = z.string().min(1).max(64).parse(body.userId);
    if (target === user.id) return c.json<ActionResult>({ ok: false, error: "You can't change your own modules." });
    const picked = z.array(z.enum(RESOURCES)).max(RESOURCES.length).parse(body.modules);
    const member = await db.user.findUnique({ where: { id: target }, select: { isOwner: true } });
    if (member?.isOwner) return c.json<ActionResult>({ ok: false, error: "The owner always sees everything." });
    await db.membership.update({
      where: { userId_companyId: { userId: target, companyId: co } },
      // All modules ticked is the same as no restriction; store it as none.
      data: { modules: picked.length === RESOURCES.length ? [] : picked },
    });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/sync-sheets", async (c) => {
    const user = c.get("user");
    if (!can(user, "update", "settings")) return c.json<ActionResult>({ ok: false, error: "Unauthorized" }, 403);
    const body = await c.req.json<{ direction?: "pull" | "push" }>().catch(() => ({ direction: "pull" as const }));
    try {
      if (body.direction === "push") {
        await db.$syncToSheets();
      } else {
        await db.$syncFromSheets();
      }
      return c.json<ActionResult>({ ok: true });
    } catch (err: any) {
      return c.json<ActionResult>({ ok: false, error: err?.message ?? "Sync failed" });
    }
  });
