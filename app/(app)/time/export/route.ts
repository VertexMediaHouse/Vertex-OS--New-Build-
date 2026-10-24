import { getRequestContext } from "@/lib/auth/context";
import { isMemberOnly } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { readParams, subScope } from "@/lib/search-params";
import { toCsv } from "@/lib/csv";

/** CSV timesheet for the selected period and filters. */
export async function GET(request: Request) {
  const ctx = await getRequestContext();
  const p = readParams(Object.fromEntries(new URL(request.url).searchParams));
  const rows = await db.timeEntry.findMany({
    where: {
      companyId: { in: subScope(ctx.companyIds, p.str("co")) },
      start: { gte: p.period.from, lt: p.period.to },
      status: { not: "RUNNING" },
      ...(isMemberOnly(ctx.user) ? { userId: ctx.user.id } : p.str("member") ? { userId: p.str("member")! } : {}),
      ...(p.str("project") && { projectId: p.str("project")! }),
    },
    orderBy: { start: "asc" },
    include: { user: { select: { name: true } }, project: { select: { name: true, client: { select: { name: true } } } }, task: { select: { title: true } } },
  });
  const csv = toCsv(
    ["Date", "Team Member", "Client", "Project", "Task", "Company", "Start", "End", "Minutes", "Billable", "Status", "Note"],
    rows.map((e) => [e.start.toISOString().slice(0, 10), e.user.name, e.project?.client?.name ?? "Internal", e.project?.name, e.task?.title, e.companyId.toUpperCase(), e.start.toISOString(), e.end?.toISOString(), e.durationMin, e.billable ? "yes" : "no", e.status, e.note]),
  );
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="timesheet.csv"' } });
}
