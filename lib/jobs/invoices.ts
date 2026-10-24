import type { PrismaClient } from "@/lib/db/generated/client";
import { invoiceStatus } from "@/lib/invoices/status";
import { notify } from "@/lib/activity";

/** Daily: flip Pending ↔ Overdue by due date and tell the company admins about new overdue invoices. */
export async function markOverdueInvoices(db: PrismaClient, now: Date): Promise<number> {
  const open = await db.invoice.findMany({ where: { status: { in: ["PENDING", "OVERDUE"] } }, include: { client: { select: { name: true } } } });
  let changed = 0;
  for (const inv of open) {
    const next = invoiceStatus({ current: inv.status, total: Number(inv.total), paid: Number(inv.paidAmount), dueDate: inv.dueDate, now });
    if (next === inv.status) continue;
    changed++;
    await db.$transaction(async (tx) => {
      await tx.invoice.update({ where: { id: inv.id }, data: { status: next } });
      if (next === "OVERDUE") {
        const admins = await tx.user.findMany({ where: { OR: [{ isOwner: true }, { memberships: { some: { companyId: inv.companyId, role: "ADMIN" } } }] }, select: { id: true } });
        await notify(tx, { userIds: admins.map((a) => a.id), type: "invoice_overdue", title: `#${inv.number} (${inv.client.name}) is overdue`, link: `/invoices?id=${inv.id}` });
      }
    });
  }
  return changed;
}
