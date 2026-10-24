import "server-only";
import { db } from "@/lib/db";
import type { InvoicePdfData } from "./pdf";

/** Invoice with everything the drawer, preview and PDF need. */
export async function loadInvoice(id: string, companyIds: string[]) {
  return db.invoice.findFirst({
    where: { id, companyId: { in: companyIds } },
    include: { client: { include: { contacts: { where: { isPrimary: true } } } }, project: { select: { id: true, name: true } }, company: true, lineItems: { orderBy: { order: "asc" } }, payments: { orderBy: { date: "desc" } } },
  });
}

export function pdfData(inv: NonNullable<Awaited<ReturnType<typeof loadInvoice>>>): InvoicePdfData {
  return {
    number: inv.number, companyCode: inv.company.code, companyAddress: inv.company.address, gstin: inv.company.gstin, issueDate: inv.issueDate, dueDate: inv.dueDate, currency: inv.currency,
    billTo: { name: inv.client.name, address: inv.client.address }, project: inv.project?.name ?? null,
    lines: inv.lineItems.map((l) => ({ description: l.description, qty: Number(l.qty), rate: Number(l.rate), amount: Number(l.amount) })),
    subtotal: Number(inv.subtotal), taxRate: Number(inv.taxRate), taxAmount: Number(inv.taxAmount), discount: Number(inv.discount), total: Number(inv.total), paid: Number(inv.paidAmount), notes: inv.notes,
  };
}
