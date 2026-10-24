import { getRequestContext, getCurrentUser } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { loadInvoice, pdfData } from "@/lib/invoices/load";
import { renderInvoicePdf } from "@/lib/invoices/pdf";

/** Staff see invoices in their companies; portal clients see their own (non-draft) invoices. */
export async function GET(_req: Request, { params }: RouteContext<"/api/invoices/[id]/pdf">) {
  const { id } = await params;
  const user = await getCurrentUser();
  let companyIds: string[];
  if (user.kind === "CLIENT") {
    const contact = await db.clientContact.findUnique({ where: { userId: user.id } });
    const inv = contact?.portalAccess ? await db.invoice.findFirst({ where: { id, clientId: contact.clientId, status: { not: "DRAFT" } } }) : null;
    if (!inv) return new Response("Not found", { status: 404 });
    companyIds = [inv.companyId];
  } else {
    companyIds = (await getRequestContext()).companyIds;
  }
  const inv = await loadInvoice(id, companyIds);
  if (!inv) return new Response("Not found", { status: 404 });
  if (user.kind !== "CLIENT" && !can(user, "view", "invoice", inv.companyId)) return new Response("Not found", { status: 404 });
  const pdf = await renderInvoicePdf(pdfData(inv));
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${inv.number}.pdf"` } });
}
