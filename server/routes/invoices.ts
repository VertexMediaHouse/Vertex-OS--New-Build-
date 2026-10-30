// Ported from app/(app)/invoices/{page.tsx,new/page.tsx,actions.ts} and
// app/api/invoices/[id]/pdf/route.ts. Query and mutation bodies are unchanged.
import { Hono } from "hono";
import { z } from "zod";
import { requireUser, staffContext, withScope, type Env } from "../context";
import { logActivity, notify } from "@/lib/activity";
import { assertCan, can } from "@/lib/auth/permissions";
import { now } from "@/lib/clock";
import { withLock } from "@/lib/concurrency";
import { db, Prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { formatDate, formatMoney } from "@/lib/format";
import { loadInvoice, pdfData } from "@/lib/invoices/load";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { invoiceStatus, invoiceTotals, type InvoiceStatusName } from "@/lib/invoices/status";
import { parseCompanySettings } from "@/lib/settings";
import { subScope } from "@/lib/search-params";
import type { ActionResult } from "@/lib/validation/result";

const id = z.string().min(1).max(64);
const PAGE = 10;

const invoiceSchema = z.object({
  companyId: z.enum(["vmh", "vth"]),
  clientId: id,
  projectId: id.optional().or(z.literal("")),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  currency: z.enum(["INR", "USD"]),
  taxRate: z.coerce.number().min(0).max(100),
  discount: z.coerce.number().min(0).max(1e10),
  notes: z.string().trim().max(2000).optional(),
  draft: z.boolean(),
  lines: z.array(z.object({ description: z.string().trim().min(1).max(300), qty: z.coerce.number().positive().max(1e6), rate: z.coerce.number().min(0).max(1e10) })).min(1, "Add at least one line"),
  timeEntryIds: z.array(id).max(1000).default([]),
});

const paymentSchema = z.object({
  amount: z.coerce.number().positive().max(1e10),
  date: z.coerce.date(),
  method: z.enum(["BANK_TRANSFER", "UPI", "CARD", "PAYPAL", "WISE", "CASH", "OTHER"]),
  reference: z.string().trim().max(120).optional(),
});

export const invoices = new Hono<Env>()
  .get("/", ...staffContext, async (c) => {
    const user = c.get("user");
    const companyIds = c.get("companyIds");
    if (!can(user, "view", "invoice")) return c.json({ denied: true as const });
    const q = c.req.query("q");
    const status = c.req.query("status");
    const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
    const base: Prisma.InvoiceWhereInput = { companyId: { in: companyIds } };
    const where: Prisma.InvoiceWhereInput = {
      companyId: { in: subScope(companyIds, c.req.query("co") ?? null) },
      ...(status && { status: status as "PAID" }),
      ...(c.req.query("client") && { clientId: c.req.query("client")! }),
      ...(c.req.query("project") && { projectId: c.req.query("project")! }),
      ...(q && { OR: [{ number: { contains: q, mode: "insensitive" } }, { client: { name: { contains: q, mode: "insensitive" } } }, { project: { name: { contains: q, mode: "insensitive" } } }] }),
    };
    const [rows, total, byStatus, agg, clients, projects] = await Promise.all([
      db.invoice.findMany({ where, orderBy: [{ issueDate: "desc" }, { seq: "desc" }], skip: (page - 1) * PAGE, take: PAGE, include: { client: { select: { name: true } }, project: { select: { name: true } } } }),
      db.invoice.count({ where }),
      db.invoice.groupBy({ by: ["status"], _count: true, where: { ...where, status: undefined } }),
      db.invoice.groupBy({ by: ["companyId"], _count: true, _sum: { total: true, paidAmount: true }, where: { ...base, status: { not: "CANCELLED" } } }),
      db.client.findMany({ where: { invoices: { some: base } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      db.project.findMany({ where: { invoices: { some: base } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    return c.json({
      denied: false as const,
      rows, total, byStatus, agg, clients, projects, page,
      pageSize: PAGE,
      scope: c.get("scope"),
      companies: companyIds.filter((x) => can(user, "create", "invoice", x)),
    });
  })
  /** Side-panel payload: the invoice plus its notes and activity. */
  .get("/:id/panel", ...staffContext, async (c) => {
    const user = c.get("user");
    const inv = await loadInvoice(c.req.param("id"), c.get("companyIds"));
    if (!inv) return c.json({ found: false as const });
    const [notes, activity] = await Promise.all([
      db.comment.findMany({ where: { entityType: "INVOICE", entityId: inv.id }, orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } }),
      db.activity.findMany({ where: { entityId: inv.id, entityType: { in: ["INVOICE", "PAYMENT"] } }, orderBy: { createdAt: "desc" }, take: 15, include: { actor: { select: { name: true } } } }),
    ]);
    return c.json({ found: true as const, inv, notes, activity, canUpdate: can(user, "update", "invoice", inv.companyId), canDelete: can(user, "delete", "invoice", inv.companyId) });
  })
  /** Everything the invoice builder needs. */
  .get("/builder", ...staffContext, async (c) => {
    const user = c.get("user");
    const ids = c.get("companyIds").filter((x) => can(user, "create", "invoice", x));
    if (!ids.length) return c.json({ denied: true as const });
    const [companies, clients, projects, entries] = await Promise.all([
      db.company.findMany({ where: { id: { in: ids } } }),
      db.client.findMany({ where: { archivedAt: null, companies: { some: { companyId: { in: ids } } } }, select: { id: true, name: true, companies: { select: { companyId: true } } }, orderBy: { name: "asc" } }),
      db.project.findMany({ where: { companyId: { in: ids } }, select: { id: true, name: true, clientId: true, companyId: true, value: true, billingType: true } }),
      db.timeEntry.findMany({ where: { companyId: { in: ids }, status: "APPROVED", billable: true, invoiceId: null }, orderBy: { start: "desc" }, take: 300, include: { project: { select: { name: true, clientId: true } }, task: { select: { title: true } }, user: { select: { name: true } } } }),
    ]);
    return c.json({
      denied: false as const,
      scope: c.get("scope"),
      companies: companies.map((x) => { const s = parseCompanySettings(x.settings); return { id: x.id as "vmh", name: x.name, taxRate: s.defaultTaxRate, terms: s.paymentTermsDays, hourlyRate: s.defaultHourlyRate }; }),
      clients: clients.map((x) => ({ id: x.id, name: x.name, companyIds: x.companies.map((y: any) => y.companyId) })),
      projects: projects.map((x) => ({ id: x.id, name: x.name, clientId: x.clientId, companyId: x.companyId, value: Number(x.value), billing: x.billingType })),
      entries: entries.map((e) => ({ id: e.id, companyId: e.companyId, clientId: e.project?.clientId ?? null, projectId: e.projectId, hours: Math.round(((e.durationMin ?? 0) / 60) * 100) / 100, label: `${e.start.toISOString().slice(0, 10)} · ${e.user.name} · ${e.task?.title ?? e.note ?? e.project?.name}` })),
    });
  })
  /** Staff see invoices in their companies; portal clients see their own (non-draft) invoices. */
  .get("/:id/pdf", requireUser, withScope, async (c) => {
    const invoiceId = c.req.param("id");
    const user = c.get("user");
    let companyIds: string[];
    if (user.kind === "CLIENT") {
      const contact = await db.clientContact.findUnique({ where: { userId: user.id } });
      const owned = contact?.portalAccess ? await db.invoice.findFirst({ where: { id: invoiceId, clientId: contact.clientId, status: { not: "DRAFT" } } }) : null;
      if (!owned) return c.text("Not found", 404);
      companyIds = [owned.companyId];
    } else {
      companyIds = c.get("companyIds");
    }
    const inv = await loadInvoice(invoiceId, companyIds);
    if (!inv) return c.text("Not found", 404);
    if (user.kind !== "CLIENT" && !can(user, "view", "invoice", inv.companyId)) return c.text("Not found", 404);
    const pdf = await renderInvoicePdf(pdfData(inv));
    return c.body(new Uint8Array(pdf), 200, { "content-type": "application/pdf", "content-disposition": `inline; filename="${inv.number}.pdf"` });
  })
  /** Creates an invoice with the next number in the company's own sequence (#VMH-022). */
  .post("/", ...staffContext, async (c) => {
    const user = c.get("user");
    const parsed = invoiceSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json<ActionResult>({ ok: false, error: parsed.error.issues[0]!.message });
    const d = parsed.data;
    assertCan(user, "create", "invoice", d.companyId);
    if (d.dueDate < d.issueDate) return c.json<ActionResult>({ ok: false, error: "Due date is before the issue date." });
    const totals = invoiceTotals(d.lines, d.taxRate, d.discount);
    // Without this a discount over the subtotal silently saves a ₹0 invoice.
    if (d.discount > totals.subtotal) return c.json<ActionResult>({ ok: false, error: `The discount is more than the subtotal (${formatMoney(totals.subtotal, d.currency)}).` });
    const invoice = await db.$transaction(async (tx) => {
      const company = await tx.company.update({ where: { id: d.companyId }, data: { nextInvoiceNumber: { increment: 1 } } });
      const seq = company.nextInvoiceNumber - 1;
      const inv = await tx.invoice.create({
        data: {
          companyId: d.companyId, clientId: d.clientId, projectId: d.projectId || null, number: `${company.invoicePrefix}-${String(seq).padStart(3, "0")}`, seq,
          issueDate: d.issueDate, dueDate: d.dueDate, currency: d.currency, taxRate: d.taxRate, discount: d.discount, notes: d.notes,
          subtotal: totals.subtotal, taxAmount: totals.taxAmount, total: totals.total, status: d.draft ? "DRAFT" : "PENDING", sentAt: d.draft ? null : new Date(),
          lineItems: { create: d.lines.map((l, order) => ({ ...l, amount: Math.round(l.qty * l.rate * 100) / 100, order })) },
        },
      });
      if (d.timeEntryIds.length) {
        const res = await tx.timeEntry.updateMany({ where: { id: { in: d.timeEntryIds }, companyId: d.companyId, status: "APPROVED", billable: true, invoiceId: null }, data: { invoiceId: inv.id } });
        if (res.count !== d.timeEntryIds.length) throw new Error("Some time entries were already invoiced or aren't approved.");
      }
      await logActivity(tx, { companyId: d.companyId, actorId: user.id, verb: "created", entityType: "INVOICE", entityId: inv.id, summary: `${user.name} created invoice #${inv.number}`, meta: { total: totals.total } });
      return inv;
    });
    return c.json<ActionResult>({ ok: true, id: invoice.id });
  })
  /** Partial payments allowed; can't exceed the balance. Status follows the money. */
  .post("/:id/payments", ...staffContext, async (c) => {
    const user = c.get("user");
    const parsed = paymentSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json<ActionResult>({ ok: false, error: parsed.error.issues[0]!.message });
    const p = parsed.data;
    const inv = await db.invoice.findUniqueOrThrow({ where: { id: id.parse(c.req.param("id")) }, include: { client: true, project: { include: { members: true } } } });
    assertCan(user, "update", "invoice", inv.companyId);
    if (inv.status === "CANCELLED" || inv.status === "DRAFT") return c.json<ActionResult>({ ok: false, error: "Send the invoice before recording payments." });
    // Two people recording a payment at once must not both pass the balance check, and the
    // paid total must count both payments. Postgres used to lock the row (SELECT ... FOR
    // UPDATE); withLock serializes same-invoice payments in-process instead.
    const result = await withLock(`invoice-payment:${inv.id}`, () => db.$transaction(async (tx) => {
      const fresh = await tx.invoice.findUniqueOrThrow({ where: { id: inv.id }, select: { total: true, paidAmount: true, status: true, dueDate: true } });
      const balance = new Prisma.Decimal(fresh.total).minus(fresh.paidAmount);
      if (balance.lessThan(p.amount)) return { ok: false as const, error: `That's more than the balance (${formatMoney(balance, inv.currency)}).` };
      await tx.payment.create({ data: { invoiceId: inv.id, ...p, createdById: user.id } });
      const paid = new Prisma.Decimal(fresh.paidAmount).plus(p.amount);
      const status = invoiceStatus({ current: fresh.status as InvoiceStatusName, total: Number(fresh.total), paid: Number(paid), dueDate: fresh.dueDate, now: now() });
      await tx.invoice.update({ where: { id: inv.id }, data: { paidAmount: paid, status } });
      // Financial changes always land in the audit trail.
      await logActivity(tx, { companyId: inv.companyId, actorId: user.id, verb: "paid", entityType: "PAYMENT", entityId: inv.id, summary: `Payment received from ${inv.client.name} (${formatMoney(p.amount, inv.currency)})`, meta: { amount: p.amount, method: p.method, reference: p.reference ?? null } });
      if (status === "PAID") await notify(tx, { userIds: inv.project?.members.map((m: any) => m.userId) ?? [], exceptUserId: user.id, type: "invoice_paid", title: `#${inv.number} is fully paid`, link: `/invoices?id=${inv.id}` });
      return { ok: true as const };
    }));
    return c.json<ActionResult>(result);
  })
  .post("/:id/reminder", ...staffContext, async (c) => {
    const user = c.get("user");
    // loadInvoice brings the contacts, company and line items the email and PDF both need.
    const inv = await loadInvoice(id.parse(c.req.param("id")), c.get("companyIds"));
    if (!inv) return c.json<ActionResult>({ ok: false, error: "Invoice not found." });
    assertCan(user, "update", "invoice", inv.companyId);
    const to = inv.client.contacts[0]?.email;
    if (!to) return c.json<ActionResult>({ ok: false, error: "The client has no primary contact email." });
    const balance = Number(inv.total) - Number(inv.paidAmount);
    // Attached, not linked: the PDF route needs a login, which most client contacts don't have.
    const pdf = await renderInvoicePdf(pdfData(inv));
    await sendEmail({
      to,
      subject: `Reminder: invoice #${inv.number} from ${inv.company.name}`,
      html: `<p>Hi ${inv.client.contacts[0]!.name},</p><p>A friendly reminder that invoice <b>#${inv.number}</b> has <b>${formatMoney(balance, inv.currency)}</b> outstanding, due ${formatDate(inv.dueDate)}.</p><p>The invoice is attached.</p><p>Thank you,<br>${inv.company.name}</p>`,
      attachments: [{ filename: `${inv.number}.pdf`, content: pdf }],
    });
    await logActivity(db, { companyId: inv.companyId, actorId: user.id, verb: "reminded", entityType: "INVOICE", entityId: inv.id, summary: `${user.name} sent a reminder for #${inv.number}` });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/:id/state", ...staffContext, async (c) => {
    const user = c.get("user");
    const inv = await db.invoice.findUniqueOrThrow({ where: { id: id.parse(c.req.param("id")) } });
    assertCan(user, "update", "invoice", inv.companyId);
    const s = z.enum(["SEND", "CANCEL"]).parse((await c.req.json<{ state: "SEND" | "CANCEL" }>()).state);
    const status = s === "CANCEL" ? "CANCELLED" : invoiceStatus({ current: "PENDING", total: Number(inv.total), paid: Number(inv.paidAmount), dueDate: inv.dueDate, now: now() });
    await db.$transaction([
      db.invoice.update({ where: { id: inv.id }, data: { status, sentAt: s === "SEND" ? new Date() : inv.sentAt } }),
      // Cancelling frees its time entries for another invoice.
      ...(s === "CANCEL" ? [db.timeEntry.updateMany({ where: { invoiceId: inv.id }, data: { invoiceId: null } })] : []),
      db.activity.create({ data: { companyId: inv.companyId, actorId: user.id, verb: s === "CANCEL" ? "cancelled" : "sent", entityType: "INVOICE", entityId: inv.id, summary: `${user.name} ${s === "CANCEL" ? "cancelled" : "sent"} invoice #${inv.number}` } }),
    ]);
    return c.json<ActionResult>({ ok: true });
  })

  .post("/delete", ...staffContext, async (c) => {
    const user = c.get("user");
    const { invoiceId } = await c.req.json<{ invoiceId: string }>();
    const inv = await db.invoice.findUniqueOrThrow({ where: { id: id.parse(invoiceId) } });
    assertCan(user, "delete", "invoice", inv.companyId);
    // Money that has been received is a record, not a draft — deleting it would lose
    // the payment history. Cancelling keeps the number and the audit trail.
    const paid = Number(inv.paidAmount) || 0;
    if (paid > 0) {
      return c.json<ActionResult>({ ok: false, error: `Invoice #${inv.number} has ${formatMoney(paid, inv.currency)} paid against it. Cancel it instead.` });
    }
    if (inv.status === "PAID") {
      return c.json<ActionResult>({ ok: false, error: `Invoice #${inv.number} is marked paid. Cancel it instead.` });
    }
    await db.$transaction([
      // Line items belong to the invoice; its time entries are released, not deleted.
      db.invoiceLineItem.deleteMany({ where: { invoiceId: inv.id } }),
      db.timeEntry.updateMany({ where: { invoiceId: inv.id }, data: { invoiceId: null } }),
      db.invoice.delete({ where: { id: inv.id } }),
      db.activity.create({ data: { companyId: inv.companyId, actorId: user.id, verb: "deleted", entityType: "INVOICE", entityId: inv.id, summary: `${user.name} deleted invoice #${inv.number}` } }),
    ]);
    return c.json<ActionResult>({ ok: true });
  });
