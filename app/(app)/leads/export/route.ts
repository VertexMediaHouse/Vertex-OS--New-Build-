import { db, type Prisma } from "@/lib/db";
import { getRequestContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import { subScope } from "@/lib/search-params";
import { toCsv } from "@/lib/csv";

/** CSV of the filtered lead list (opens in Excel). Mirrors the filters on /leads. */
export async function GET(request: Request) {
  const ctx = await getRequestContext();
  assertCan(ctx.user, "view", "lead");
  const q = new URL(request.url).searchParams;
  const search = q.get("q");
  const where: Prisma.LeadWhereInput = {
    companyId: { in: subScope(ctx.companyIds, q.get("co")) },
    ...(q.get("source") && { source: q.get("source") as Prisma.LeadWhereInput["source"] }),
    ...(q.get("owner") && { ownerId: q.get("owner")! }),
    // The board hides Lost; an export of "everything" should not.
    ...(search && { OR: [{ name: { contains: search, mode: "insensitive" } }, { service: { contains: search, mode: "insensitive" } }] }),
  };
  const rows = await db.lead.findMany({
    where,
    orderBy: [{ stage: "asc" }, { createdAt: "desc" }],
    include: { owner: { select: { name: true } }, client: { select: { name: true } } },
  });
  const csv = toCsv(
    ["Name", "Company", "Service", "Stage", "Value (INR)", "Source", "Contact", "Email", "Phone", "Owner", "Client", "Created", "Last activity", "Won", "Lost", "Notes"],
    rows.map((l) => [
      l.name,
      l.companyId.toUpperCase(),
      l.service,
      l.stage,
      Number(l.value),
      l.source,
      l.contactName ?? "",
      l.email ?? "",
      l.phone ?? "",
      l.owner?.name ?? "",
      l.client?.name ?? "",
      l.createdAt.toISOString().slice(0, 10),
      l.lastActivityAt.toISOString().slice(0, 10),
      l.wonAt ? l.wonAt.toISOString().slice(0, 10) : "",
      l.lostAt ? l.lostAt.toISOString().slice(0, 10) : "",
      l.notes ?? "",
    ]),
  );
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="leads.csv"` } });
}
