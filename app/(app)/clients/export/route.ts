import { getRequestContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import { listClients } from "@/lib/clients";
import { subScope } from "@/lib/search-params";
import { toCsv } from "@/lib/csv";

/** CSV of the filtered client list (opens in Excel). */
export async function GET(request: Request) {
  const ctx = await getRequestContext();
  assertCan(ctx.user, "view", "client");
  const q = new URL(request.url).searchParams;
  const rows = await listClients({ companyIds: subScope(ctx.companyIds, q.get("co")), q: q.get("q"), status: q.get("status"), tag: q.get("tag"), owner: q.get("owner") });
  const csv = toCsv(
    ["Client", "Domain", "Company", "Type", "Status", "Active Projects", "Total Projects", "Total Revenue (INR)", "Owner", "Last Activity"],
    rows.map((r) => [r.name, r.domain, r.companies.join(" + "), r.type, r.status, r.activeProjects, r.totalProjects, r.revenue, r.owner, r.lastActivityAt.toISOString()]),
  );
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="clients.csv"` } });
}
