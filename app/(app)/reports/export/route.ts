import { getRequestContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import { reportData } from "@/lib/metrics/reports";
import { readParams } from "@/lib/search-params";
import { toCsv } from "@/lib/csv";

/**
 * Report as CSV (opens in Excel).
 * shortcut: CSV instead of native .xlsx; add exceljs if formatted multi-sheet workbooks are needed.
 */
export async function GET(request: Request) {
  const ctx = await getRequestContext();
  assertCan(ctx.user, "view", "report");
  const p = readParams(Object.fromEntries(new URL(request.url).searchParams));
  const d = await reportData(ctx, p.period);
  const k = d.kpis;
  const rows: unknown[][] = [
    ["KPI", "Total", "VMH", "VTH"],
    ["Projects", k.projects.total, k.projects.vmh, k.projects.vth],
    ["Hours", (k.hours.total / 60).toFixed(2), (k.hours.vmh / 60).toFixed(2), (k.hours.vth / 60).toFixed(2)],
    ["Revenue collected (INR)", k.revenue.total, k.revenue.vmh, k.revenue.vth],
    ["Invoices sent", k.invoices.total, k.invoices.vmh, k.invoices.vth],
    ["Active clients", k.clients.total, k.clients.vmh, k.clients.vth],
    [],
    ["Week", "Revenue VMH", "Revenue VTH", "Hours VMH", "Hours VTH"],
    ...d.revenueWeeks.map((w, i) => [w.week, w.VMH, w.VTH, d.hoursWeeks[i]?.VMH, d.hoursWeeks[i]?.VTH]),
    [],
    ["Team member", "Hours", "Billable hours"],
    ...d.members.map((m) => [m.name, (m.minutes / 60).toFixed(2), (m.billable / 60).toFixed(2)]),
    [],
    ["Top client", "Collected (INR)"],
    ...d.topClients.map((c) => [c.name, c.amount]),
  ];
  return new Response(toCsv(rows[0] as string[], rows.slice(1)), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="report.csv"' } });
}
