"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db, Prisma } from "@/lib/db";
import { getRequestContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import { logActivity, notify } from "@/lib/activity";
import { invoiceStatus, invoiceTotals } from "@/lib/invoices/status";
import { sendEmail } from "@/lib/email";
import { formatDate, formatMoney } from "@/lib/format";
import { now } from "@/lib/clock";
import type { ActionResult } from "@/lib/validation/result";

const id = z.string().min(1).max(64);

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

/** Creates an invoice with the next number in the company's own sequence (#VMH-022). */
export async function createInvoice(input: z.input<typeof invoiceSchema>): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  assertCan(user, "create", "invoice", d.companyId);
  if (d.dueDate < d.issueDate) return { ok: false, error: "Due date is before the issue date." };
  const totals = invoiceTotals(d.lines, d.taxRate, d.discount);
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
  refresh();
  return { ok: true, id: invoice.id };
}

const paymentSchema = z.object({
  amount: z.coerce.number().positive().max(1e10),
  date: z.coerce.date(),
  method: z.enum(["BANK_TRANSFER", "UPI", "CARD", "PAYPAL", "WISE", "CASH", "OTHER"]),
  reference: z.string().trim().max(120).optional(),
});

/** Partial payments allowed; can't exceed the balance. Status follows the money. */
export async function recordPayment(invoiceId: string, input: z.input<typeof paymentSchema>): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const p = parsed.data;
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: id.parse(invoiceId) }, include: { client: true, project: { include: { members: true } } } });
  assertCan(user, "update", "invoice", inv.companyId);
  if (inv.status === "CANCELLED" || inv.status === "DRAFT") return { ok: false, error: "Send the invoice before recording payments." };
  const balance = new Prisma.Decimal(inv.total).minus(inv.paidAmount);
  if (balance.lessThan(p.amount)) return { ok: false, error: `That's more than the balance (${formatMoney(balance, inv.currency)}).` };
  await db.$transaction(async (tx) => {
    await tx.payment.create({ data: { invoiceId: inv.id, ...p, createdById: user.id } });
    const paid = new Prisma.Decimal(inv.paidAmount).plus(p.amount);
    const status = invoiceStatus({ current: inv.status, total: Number(inv.total), paid: Number(paid), dueDate: inv.dueDate, now: now() });
    await tx.invoice.update({ where: { id: inv.id }, data: { paidAmount: paid, status } });
    // Financial changes always land in the audit trail.
    await logActivity(tx, { companyId: inv.companyId, actorId: user.id, verb: "paid", entityType: "PAYMENT", entityId: inv.id, summary: `Payment received from ${inv.client.name} (${formatMoney(p.amount, inv.currency)})`, meta: { amount: p.amount, method: p.method, reference: p.reference ?? null } });
    if (status === "PAID") await notify(tx, { userIds: inv.project?.members.map((m) => m.userId) ?? [], exceptUserId: user.id, type: "invoice_paid", title: `#${inv.number} is fully paid`, link: `/invoices?id=${inv.id}` });
  });
  refresh();
  return { ok: true };
}

export async function sendReminder(invoiceId: string): Promise<ActionResult> {
  const { user } = await getRequestContext();
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: id.parse(invoiceId) }, include: { client: { include: { contacts: { where: { isPrimary: true } } } }, company: true } });
  assertCan(user, "update", "invoice", inv.companyId);
  const to = inv.client.contacts[0]?.email;
  if (!to) return { ok: false, error: "The client has no primary contact email." };
  const balance = Number(inv.total) - Number(inv.paidAmount);
  const link = `${process.env.BETTER_AUTH_URL ?? ""}/api/invoices/${inv.id}/pdf`;
  await sendEmail({
    to,
    subject: `Reminder: invoice #${inv.number} from ${inv.company.name}`,
    html: `<p>Hi ${inv.client.contacts[0]!.name},</p><p>A friendly reminder that invoice <b>#${inv.number}</b> has <b>${formatMoney(balance, inv.currency)}</b> outstanding, due ${formatDate(inv.dueDate)}.</p><p><a href="${link}">View the invoice (PDF)</a></p><p>Thank you,<br>${inv.company.name}</p>`,
  });
  await logActivity(db, { companyId: inv.companyId, actorId: user.id, verb: "reminded", entityType: "INVOICE", entityId: inv.id, summary: `${user.name} sent a reminder for #${inv.number}` });
  refresh();
  return { ok: true };
}

export async function setInvoiceState(invoiceId: string, state: "SEND" | "CANCEL") {
  const { user } = await getRequestContext();
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: id.parse(invoiceId) } });
  assertCan(user, "update", "invoice", inv.companyId);
  const s = z.enum(["SEND", "CANCEL"]).parse(state);
  const status = s === "CANCEL" ? "CANCELLED" : invoiceStatus({ current: "PENDING", total: Number(inv.total), paid: Number(inv.paidAmount), dueDate: inv.dueDate, now: now() });
  await db.$transaction([
    db.invoice.update({ where: { id: inv.id }, data: { status, sentAt: s === "SEND" ? new Date() : inv.sentAt } }),
    // Cancelling frees its time entries for another invoice.
    ...(s === "CANCEL" ? [db.timeEntry.updateMany({ where: { invoiceId: inv.id }, data: { invoiceId: null } })] : []),
    db.activity.create({ data: { companyId: inv.companyId, actorId: user.id, verb: s === "CANCEL" ? "cancelled" : "sent", entityType: "INVOICE", entityId: inv.id, summary: `${user.name} ${s === "CANCEL" ? "cancelled" : "sent"} invoice #${inv.number}` } }),
  ]);
  refresh();
}
